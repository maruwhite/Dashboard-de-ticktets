import { describe, expect, it } from 'vitest';
import { CAMPOS, ESTADOS, NOMBRE_WORKFLOW } from './definicion.js';
import { JiraFalso } from './jira-falso.js';
import { armarPedidoDeWorkflow, preparar } from './preparar.js';

const datos = {
  proyectos: [
    { clave: 'PRJA', nombre: 'Proyecto Alfa' },
    { clave: 'PRJB', nombre: 'Proyecto Beta' },
  ],
  tiposIncidencia: ['Epic', 'Tarea', 'Incidente'],
  prioridades: ['Media'],
};

const ejecutar = (jira: JiraFalso, confirmar: boolean, log: string[] = []) =>
  preparar(jira.cliente(), datos, { confirmar, log: (m) => log.push(m) });

describe('preparar', () => {
  it('en simulación no escribe nada y lista los cambios', async () => {
    const jira = new JiraFalso();
    const log: string[] = [];

    const resultado = await ejecutar(jira, false, log);

    expect(jira.escrituras).toEqual([]);
    expect(resultado.campos.creada).toBe('(se crearía)');
    expect(log).toContain('  [simulación] Crear campo "Creada (histórica)"');
    expect(log).toContain('  [simulación] Crear proyecto PRJA "Proyecto Alfa"');
    expect(log).toContain('  Workflow validado por Jira');
    expect(log.at(-1)).toBe(`${String(resultado.cambios)} cambios pendientes.`);
  });

  it('con confirmar crea todo lo que falta', async () => {
    const jira = new JiraFalso();

    const { campos } = await ejecutar(jira, true);

    expect(jira.campos.map((c) => c.name)).toEqual(Object.values(CAMPOS).map((c) => c.nombre));
    expect(Object.values(campos).every((id) => id.startsWith('customfield_'))).toBe(true);
    expect([...jira.enPantalla].sort()).toEqual(Object.values(campos).sort());
    expect(jira.prioridades.map((p) => p.name)).toContain('Media');
    expect(jira.prioridadesEnEsquema.size).toBe(2);
    // "Tarea" existe solo como tipo de un proyecto (team-managed): se crea la global.
    expect(jira.tipos.filter((t) => !t.scope).map((t) => t.name)).toEqual([
      'Epic',
      'Tarea',
      'Incidente',
    ]);
    expect(jira.workflows).toEqual([NOMBRE_WORKFLOW]);
    expect(jira.esquemasWorkflow).toHaveLength(1);
    expect(jira.proyectos.map((p) => p.key)).toEqual(['PRJA', 'PRJB']);

    const pedidoProyecto = jira.llamadas.find((l) => l.ruta === '/rest/api/3/project')?.cuerpo;
    expect(pedidoProyecto).toMatchObject({
      projectTypeKey: 'software',
      leadAccountId: 'cuenta-falsa',
      workflowScheme: jira.esquemasWorkflow[0]?.id,
    });
  });

  it('asigna a los proyectos un esquema de tipos propio y el esquema de pantallas por defecto', async () => {
    const jira = new JiraFalso();
    const log: string[] = [];

    await ejecutar(jira, true, log);

    const [idEsquema, esquema] =
      [...jira.esquemasTipos].find(([, e]) => e.name === 'Dashboard de tickets') ?? [];
    const idsEsperados = jira.tipos.filter((t) => !t.scope).map((t) => t.id);
    expect([...(esquema?.tipos ?? [])].sort()).toEqual(idsEsperados.sort());
    for (const proyecto of jira.proyectos) {
      expect(jira.esquemaTiposDe.get(proyecto.id)).toBe(idEsquema);
      expect(jira.esquemaPantallasDe.get(proyecto.id)).toBe('1');
    }
    expect(log).toContain('  Asignar esquema de tipos "Dashboard de tickets" a PRJA');
  });

  it('en simulación anuncia las asignaciones para los proyectos que se crearían', async () => {
    const log: string[] = [];
    await ejecutar(new JiraFalso(), false, log);
    expect(log).toContain(
      '  [simulación] Asignar esquema de tipos "Dashboard de tickets" a 2 proyectos nuevos',
    );
  });

  it('completa el esquema de tipos si le falta alguno', async () => {
    const jira = new JiraFalso();
    await ejecutar(jira, true);
    const esquema = [...jira.esquemasTipos.values()].find((e) => e.name === 'Dashboard de tickets');
    const [quitado] = [...(esquema?.tipos ?? [])];
    esquema?.tipos.delete(quitado ?? '');

    const { cambios } = await ejecutar(jira, true);

    expect(cambios).toBe(1);
    expect(esquema?.tipos.has(quitado ?? '')).toBe(true);
  });

  it('asocia los campos al esquema de campos de los proyectos', async () => {
    const jira = new JiraFalso();
    jira.camposEnEsquema.add('summary');

    const { campos } = await ejecutar(jira, true);

    for (const id of Object.values(campos)) expect(jira.camposEnEsquema.has(id)).toBe(true);
    const pedido = jira.llamadas.find((l) => l.ruta === '/rest/api/3/config/fieldschemes/fields');
    expect(pedido?.cuerpo).toEqual(
      Object.fromEntries(Object.values(campos).map((id) => [id, [{ schemeIds: [1] }]])),
    );
  });

  it('en simulación anuncia la asociación de campos', async () => {
    const log: string[] = [];
    await ejecutar(new JiraFalso(), false, log);
    expect(log).toContain('  [simulación] Asociar 1 campos a los esquemas de campos 1');
  });

  it('en sitios sin esquemas de campos (modelo anterior) no los toca', async () => {
    const jira = new JiraFalso();
    jira.sinEsquemasDeCampos = true;

    await ejecutar(jira, true);

    expect(jira.llamadas.some((l) => l.ruta.includes('/config/fieldschemes/'))).toBe(false);
  });

  it('falla si hay tipos de incidencia globales duplicados', async () => {
    const jira = new JiraFalso();
    jira.tipos.push({ id: '9', name: 'Tarea' }); // la plantilla del proyecto crea otra "Tarea"
    await expect(ejecutar(jira, true)).rejects.toThrow(
      'Hay 2 tipos de incidencia globales llamados "Tarea"',
    );
  });

  it('es idempotente: la segunda ejecución no cambia nada', async () => {
    const jira = new JiraFalso();
    const primera = await ejecutar(jira, true);
    const escriturasPrevias = jira.escrituras.length;
    const log: string[] = [];

    const segunda = await ejecutar(jira, true, log);

    expect(segunda.cambios).toBe(0);
    expect(segunda.campos).toEqual(primera.campos);
    expect(jira.escrituras).toHaveLength(escriturasPrevias);
    expect(log.at(-1)).toBe('El sitio ya estaba preparado.');
  });

  it('falla si un campo existe con otro tipo', async () => {
    const jira = new JiraFalso();
    jira.campos.push({
      id: 'customfield_1',
      name: 'ID origen',
      custom: true,
      schema: { custom: 'otro:tipo' },
    });
    await expect(ejecutar(jira, false)).rejects.toThrow('"ID origen" ya existe con otro tipo');
  });

  it('falla si no encuentra la pantalla por defecto', async () => {
    const jira = new JiraFalso();
    jira.hayPantalla = false;
    await expect(ejecutar(jira, false)).rejects.toThrow('No se encontró la pantalla');
  });

  it('no crea el workflow si Jira lo rechaza en la validación', async () => {
    const jira = new JiraFalso();
    jira.erroresDeValidacion = [
      { level: 'WARNING', message: 'aviso' },
      { level: 'ERROR', message: 'transición inválida' },
    ];
    await expect(ejecutar(jira, true)).rejects.toThrow(
      'Jira rechazó el workflow: transición inválida',
    );
    expect(jira.workflows).toEqual([]);
  });
});

describe('armarPedidoDeWorkflow', () => {
  it('reutiliza estados existentes por nombre y crea los demás, con transiciones globales', () => {
    const pedido = armarPedidoDeWorkflow([
      { id: '77', name: 'en curso', statusCategory: 'IN_PROGRESS' },
    ]) as {
      statuses: { id?: string; name: string; statusReference: string }[];
      workflows: { transitions: { type: string; toStatusReference: string }[] }[];
    };

    expect(pedido.statuses).toHaveLength(ESTADOS.length);
    expect(pedido.statuses.find((s) => s.id === '77')).toMatchObject({
      name: 'en curso',
      statusReference: '77',
    });
    expect(pedido.statuses.filter((s) => s.id === undefined)).toHaveLength(ESTADOS.length - 1);

    const [workflow] = pedido.workflows;
    const iniciales = workflow?.transitions.filter((t) => t.type === 'INITIAL') ?? [];
    const planificado = pedido.statuses.find((s) => s.name === 'Planificado');
    expect(iniciales).toEqual([
      expect.objectContaining({ toStatusReference: planificado?.statusReference }),
    ]);
    expect(workflow?.transitions.filter((t) => t.type === 'GLOBAL')).toHaveLength(ESTADOS.length);
  });
});
