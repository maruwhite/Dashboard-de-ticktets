import { describe, expect, it } from 'vitest';
import { anonimizar, COLUMNAS_SALIDA, contarFugas, MAX_USUARIOS } from './anonimizar.js';
import { parseFechaJira } from './fechas.js';
import { ticketDePrueba } from './fixtures.js';

const HOY = new Date(Date.UTC(2026, 9, 9, 12, 0));
const opciones = { hoy: HOY, diasAntesDeHoy: 3 };

describe('anonimizar', () => {
  it('reemplaza personas, proyectos, títulos y claves', () => {
    const { tickets } = anonimizar([ticketDePrueba()], opciones);
    const [ticket] = tickets;

    expect(ticket).toMatchObject({
      id_origen: 'T-001',
      tipo_incidencia: 'Tarea',
      estado: 'En curso',
      prioridad: 'Media',
      tipo_proyecto: 'software',
      proyecto_clave: 'PRJA',
      proyecto_nombre: 'Proyecto Alfa',
      informador: 'Usuario 2',
      responsable_proyecto: 'Usuario 1',
    });
    expect(ticket?.responsable).toMatch(/^Agente [1-5]$/);
    expect(ticket?.titulo).not.toBe('Titulo inventado uno');
    expect(Object.keys(ticket ?? {})).toEqual(COLUMNAS_SALIDA);
  });

  it('usa el mismo usuario para la misma persona como informador y responsable de proyecto', () => {
    const { tickets } = anonimizar(
      [
        ticketDePrueba({ informador: 'Ana Ficticia', responsableProyecto: 'Beto Ficticio' }),
        ticketDePrueba({ informador: 'Beto Ficticio', responsableProyecto: 'Ana Ficticia' }),
      ],
      opciones,
    );
    expect(tickets[0]?.informador).toBe(tickets[1]?.responsable_proyecto);
    expect(tickets[0]?.responsable_proyecto).toBe(tickets[1]?.informador);
    expect(tickets[0]?.informador).not.toBe(tickets[0]?.responsable_proyecto);
  });

  it(`con más de ${String(MAX_USUARIOS)} personas, las reparte equilibrando la carga`, () => {
    // 30 informadores: el i-ésimo aparece 30 - i veces.
    const tickets = Array.from({ length: 30 }, (_, i) =>
      Array.from({ length: 30 - i }, () =>
        ticketDePrueba({ informador: `Informador ${String(i)}`, responsableProyecto: '' }),
      ),
    ).flat();

    const resultado = anonimizar(tickets, opciones);
    const carga = new Map<string, number>();
    for (const t of resultado.tickets) carga.set(t.informador, (carga.get(t.informador) ?? 0) + 1);
    const cargas = [...carga.values()];

    expect(resultado.personasOriginales).toBe(30);
    expect(carga.size).toBe(MAX_USUARIOS);
    expect(Math.max(...cargas) - Math.min(...cargas)).toBeLessThanOrEqual(10);
    expect(carga.get('Usuario 1')).toBe(Math.max(...cargas));
  });

  it(`con hasta ${String(MAX_USUARIOS)} personas, cada una tiene usuario propio`, () => {
    const tickets = Array.from({ length: 5 }, (_, i) =>
      ticketDePrueba({ informador: `Persona ${String(i)}`, responsableProyecto: '' }),
    );
    const usuarios = new Set(anonimizar(tickets, opciones).tickets.map((t) => t.informador));
    expect(usuarios).toEqual(
      new Set(['Usuario 1', 'Usuario 2', 'Usuario 3', 'Usuario 4', 'Usuario 5']),
    );
  });

  it('reparte los responsables entre 5 agentes ficticios, de forma desigual y determinística', () => {
    const tickets = Array.from({ length: 300 }, () => ticketDePrueba());
    const primera = anonimizar(tickets, opciones).tickets.map((t) => t.responsable);
    const segunda = anonimizar(tickets, opciones).tickets.map((t) => t.responsable);

    const conteo = new Map<string, number>();
    for (const agente of primera) conteo.set(agente, (conteo.get(agente) ?? 0) + 1);

    expect(primera).toEqual(segunda);
    expect([...conteo.keys()].sort()).toEqual([
      'Agente 1',
      'Agente 2',
      'Agente 3',
      'Agente 4',
      'Agente 5',
    ]);
    expect(conteo.get('Agente 1')).toBeGreaterThan(conteo.get('Agente 5') ?? 0);
  });

  it('deja sin responsable los tickets que no lo tenían', () => {
    const { tickets } = anonimizar([ticketDePrueba({ responsable: '' })], opciones);
    expect(tickets[0]?.responsable).toBe('');
  });

  it('asigna PRJA al proyecto con más tickets', () => {
    const { tickets } = anonimizar(
      [
        ticketDePrueba({ proyectoClave: 'MENOS', proyectoNombre: 'Menos' }),
        ticketDePrueba({ proyectoClave: 'MAS', proyectoNombre: 'Mas' }),
        ticketDePrueba({ proyectoClave: 'MAS', proyectoNombre: 'Mas' }),
      ],
      opciones,
    );
    expect(tickets.map((t) => t.proyecto_clave).sort()).toEqual(['PRJA', 'PRJA', 'PRJB']);
    expect(tickets.find((t) => t.proyecto_clave === 'PRJB')?.proyecto_nombre).toBe('Proyecto Beta');
  });

  it('rechaza más proyectos de los que se pueden nombrar', () => {
    const tickets = Array.from({ length: 25 }, (_, i) =>
      ticketDePrueba({ proyectoClave: `P${String(i)}` }),
    );
    expect(() => anonimizar(tickets, opciones)).toThrow('Demasiados proyectos (25)');
  });

  it('unifica "Finalizada" en "Finalizado", mantiene "Cerrado" y convierte subtareas en tareas', () => {
    const { tickets } = anonimizar(
      [
        ticketDePrueba({ estado: 'Finalizada', creada: '01/ene/24 1:00 AM' }),
        ticketDePrueba({ estado: 'Cerrado', creada: '02/ene/24 1:00 AM' }),
        ticketDePrueba({ tipoIncidencia: 'subtarea', creada: '03/ene/24 1:00 AM' }),
      ],
      opciones,
    );
    expect(tickets.map((t) => t.estado)).toEqual(['Finalizado', 'Cerrado', 'En curso']);
    expect(tickets[2]?.tipo_incidencia).toBe('Tarea');
  });

  it('numera por fecha de creación', () => {
    const { tickets } = anonimizar(
      [
        ticketDePrueba({ creada: '05/ene/24 1:00 AM', tipoIncidencia: 'Incidente' }),
        ticketDePrueba({ creada: '01/ene/24 1:00 AM', tipoIncidencia: 'Consulta' }),
      ],
      opciones,
    );
    expect(tickets.map((t) => [t.id_origen, t.tipo_incidencia])).toEqual([
      ['T-001', 'Consulta'],
      ['T-002', 'Incidente'],
    ]);
  });

  it('corre todas las fechas el mismo offset: conserva duraciones y deja la más reciente N días antes de hoy', () => {
    const originales = [
      ticketDePrueba({ creada: '01/mar/25 9:00 AM', resuelta: '04/mar/25 5:30 PM' }),
      ticketDePrueba({ creada: '10/jun/25 8:15 AM', resuelta: '20/jun/25 10:00 AM' }),
      ticketDePrueba({ creada: '01/jul/25 1:00 PM', resuelta: null }),
    ];
    const { tickets } = anonimizar(originales, opciones);

    const duracion = (desde: string, hasta: string) =>
      new Date(`${hasta}Z`).getTime() - new Date(`${desde}Z`).getTime();
    const original = (texto: string) => parseFechaJira(texto).getTime();

    expect(duracion(tickets[0]?.creada ?? '', tickets[0]?.resuelta ?? '')).toBe(
      original('04/mar/25 5:30 PM') - original('01/mar/25 9:00 AM'),
    );
    expect(duracion(tickets[1]?.creada ?? '', tickets[1]?.resuelta ?? '')).toBe(
      original('20/jun/25 10:00 AM') - original('10/jun/25 8:15 AM'),
    );
    expect(tickets[2]?.resuelta).toBe('');
    expect(tickets[2]?.creada).toBe('2026-10-06 13:00');
  });

  it('nunca deja las fechas iguales a las originales (offset distinto de 0)', () => {
    const { tickets } = anonimizar(
      [ticketDePrueba({ creada: '06/oct/26 1:00 PM' })],
      opciones, // la fecha más reciente ya está 3 días antes de HOY
    );
    expect(tickets[0]?.creada).toBe('2026-10-05 13:00');

    const conSiete = anonimizar([ticketDePrueba({ creada: '02/oct/26 1:00 PM' })], {
      hoy: HOY,
      diasAntesDeHoy: 7,
    });
    expect(conSiete.tickets[0]?.creada).toBe('2026-10-03 13:00');
  });

  it('acepta fechas tipadas de Excel', () => {
    const { tickets } = anonimizar(
      [
        ticketDePrueba({
          creada: new Date(Date.UTC(2025, 0, 1, 10, 0)),
          resuelta: new Date(Date.UTC(2025, 0, 2, 10, 0)),
        }),
      ],
      opciones,
    );
    expect(tickets[0]?.resuelta).toBe('2026-10-06 10:00');
  });

  it('falla si no hay tickets', () => {
    expect(() => anonimizar([], opciones)).toThrow('El export no tiene tickets');
  });

  it('usa títulos genéricos para tipos desconocidos', () => {
    const { tickets } = anonimizar([ticketDePrueba({ tipoIncidencia: 'Otro tipo' })], opciones);
    expect(tickets[0]?.titulo).toBe('Revisión general del sistema');
  });
});

describe('contarFugas', () => {
  it('no encuentra fugas en una salida anonimizada', () => {
    const originales = [ticketDePrueba(), ticketDePrueba({ clave: 'ZZZ-2' })];
    const { tickets } = anonimizar(originales, opciones);
    expect(contarFugas(tickets, originales)).toBe(0);
  });

  it('detecta personas, proyectos y títulos originales en la salida', () => {
    const originales = [ticketDePrueba()];
    const { tickets } = anonimizar(originales, opciones);
    const [base] = tickets;
    if (!base) throw new Error('sin tickets');

    const conFugas = [
      { ...base, responsable: 'Persona Ficticia' },
      { ...base, titulo: 'Seguimiento: Titulo inventado uno' },
      { ...base, proyecto_nombre: 'Proyecto Inventado' },
    ];
    expect(contarFugas(conFugas, originales)).toBe(3);
  });

  it('ignora valores conservados y valores muy cortos', () => {
    const originales = [ticketDePrueba({ resumen: 'Tarea', responsable: 'Al' })];
    const { tickets } = anonimizar(originales, opciones);
    expect(contarFugas(tickets, originales)).toBe(0);
  });
});
