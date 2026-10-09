import { describe, expect, it } from 'vitest';
import type { TicketAnonimizado } from '../anonimizar/anonimizar.js';
import { cargar } from './cargar.js';
import { JiraFalso } from './jira-falso.js';
import { preparar } from './preparar.js';

let secuencia = 0;
function ticket(cambios: Partial<TicketAnonimizado> = {}): TicketAnonimizado {
  secuencia++;
  return {
    id_origen: `T-${String(secuencia).padStart(3, '0')}`,
    tipo_incidencia: 'Tarea',
    estado: 'Finalizado',
    prioridad: 'Media',
    tipo_proyecto: 'service_desk',
    proyecto_clave: 'PRJA',
    proyecto_nombre: 'Proyecto Alfa',
    responsable: 'Agente 1',
    informador: 'Usuario 2',
    responsable_proyecto: 'Usuario 3',
    titulo: `Título ${String(secuencia)}`,
    creada: '2025-01-10 09:00',
    resuelta: '2025-01-12 17:30',
    ...cambios,
  };
}

async function jiraPreparado(): Promise<JiraFalso> {
  const jira = new JiraFalso();
  await preparar(
    jira.cliente(),
    {
      proyectos: [
        { clave: 'PRJA', nombre: 'Proyecto Alfa' },
        { clave: 'PRJB', nombre: 'Proyecto Beta' },
      ],
      tiposIncidencia: ['Tarea', 'Incidente'],
      prioridades: ['Media'],
    },
    { confirmar: true, log: () => undefined },
  );
  jira.llamadas = [];
  return jira;
}

const ejecutar = (
  jira: JiraFalso,
  tickets: TicketAnonimizado[],
  confirmar: boolean,
  log: string[] = [],
) => cargar(jira.cliente(), tickets, { confirmar, log: (m) => log.push(m), tamanioLote: 2 });

describe('cargar', () => {
  it('crea los tickets con sus campos y los lleva a su estado', async () => {
    const jira = await jiraPreparado();
    const tickets = [
      ticket(),
      ticket({ estado: 'Planificado', resuelta: '', responsable: '', proyecto_clave: 'PRJB' }),
      ticket({ estado: 'En curso', tipo_incidencia: 'Incidente', prioridad: '' }),
    ];

    const resumen = await ejecutar(jira, tickets, true);

    expect(resumen).toEqual({ total: 3, yaExistian: 0, creados: 3, transicionados: 2, errores: 0 });
    expect(jira.issues.map((i) => (i.fields.status as { name: string }).name)).toEqual([
      'Finalizado',
      'Planificado',
      'En curso',
    ]);
    const campo = (nombre: string) => jira.campos.find((c) => c.name === nombre)?.id ?? '';
    const [primero, segundo, tercero] = jira.issues;
    expect(primero?.fields).toMatchObject({
      summary: tickets[0]?.titulo,
      priority: { name: 'Media' },
      [campo('Creada (histórica)')]: '2025-01-10T09:00:00.000-0300',
      [campo('Resuelta (histórica)')]: '2025-01-12T17:30:00.000-0300',
      [campo('ID origen')]: tickets[0]?.id_origen,
      [campo('Responsable (dato)')]: 'Agente 1',
    });
    expect(segundo?.fields).not.toHaveProperty(campo('Resuelta (histórica)'));
    expect(segundo?.fields).not.toHaveProperty(campo('Responsable (dato)'));
    expect(tercero?.fields).not.toHaveProperty('priority');
  });

  it('es idempotente: no duplica tickets y completa transiciones pendientes', async () => {
    const jira = await jiraPreparado();
    const tickets = [ticket(), ticket(), ticket({ estado: 'Cancelado' })];
    await ejecutar(jira, tickets, true);
    // Simula una carga cortada: un ticket quedó en el estado inicial.
    const pendiente = jira.issues[2];
    if (pendiente) pendiente.fields.status = { name: 'Planificado' };

    const resumen = await ejecutar(jira, tickets, true);

    expect(resumen).toEqual({ total: 3, yaExistian: 3, creados: 0, transicionados: 1, errores: 0 });
    expect(jira.issues).toHaveLength(3);
    expect((jira.issues[2]?.fields.status as { name: string }).name).toBe('Cancelado');
  });

  it('en simulación informa el plan sin escribir', async () => {
    const jira = await jiraPreparado();
    const log: string[] = [];

    await ejecutar(jira, [ticket(), ticket({ estado: 'Planificado' })], false, log);

    expect(jira.escrituras).toEqual([]);
    expect(log).toContain(
      '2 tickets en el archivo: 0 ya están en Jira, 2 por crear, 1 por llevar a su estado.',
    );
  });

  it('sin la configuración de Jira: en simulación avisa, con confirmar falla', async () => {
    const jira = new JiraFalso();
    const log: string[] = [];

    await ejecutar(jira, [ticket()], false, log);
    expect(log[0]).toContain('Corré primero jira:preparar');
    expect(log[0]).toContain('proyecto PRJA');
    expect(log[0]).toContain('tipo "Tarea"');
    await expect(ejecutar(jira, [ticket()], true)).rejects.toThrow('Falta configuración en Jira');
  });

  it('cuenta los errores de creación y de transición sin cortar la carga', async () => {
    const jira = await jiraPreparado();
    jira.estadosSinTransicion.add('Rechazado');
    const log: string[] = [];
    const tickets = [ticket({ titulo: 'FALLA' }), ticket(), ticket({ estado: 'Rechazado' })];
    jira.titulosQueFallan.add('FALLA');

    const resumen = await ejecutar(jira, tickets, true, log);

    expect(resumen).toMatchObject({ creados: 2, transicionados: 1, errores: 2 });
    expect(log).toContain(`  Error al crear ${tickets[0]?.id_origen ?? ''}: summary: inválido`);
    expect(log).toContain(
      `  Error al mover ${tickets[2]?.id_origen ?? ''} a "Rechazado": no hay transición hacia "Rechazado"`,
    );
  });
});
