import { describe, expect, it } from 'vitest';
import { anonimizar, COLUMNAS_SALIDA, contarFugas } from './anonimizar.js';
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
    });
    expect([ticket?.responsable, ticket?.informador, ticket?.responsable_proyecto]).toEqual(
      expect.arrayContaining(['Usuario 1', 'Usuario 2', 'Usuario 3']),
    );
    expect(ticket?.titulo).not.toBe('Titulo inventado uno');
    expect(Object.keys(ticket ?? {})).toEqual(COLUMNAS_SALIDA);
  });

  it('usa el mismo usuario para la misma persona en las tres columnas', () => {
    const { tickets } = anonimizar(
      [
        ticketDePrueba({ responsable: 'Ana Ficticia', informador: 'Beto Ficticio' }),
        ticketDePrueba({ responsable: 'Beto Ficticio', informador: 'Ana Ficticia' }),
      ],
      opciones,
    );
    expect(tickets[0]?.responsable).toBe(tickets[1]?.informador);
    expect(tickets[0]?.informador).toBe(tickets[1]?.responsable);
  });

  it('con más de 9 personas, las 8 más frecuentes tienen usuario propio y el resto comparte Usuario 9', () => {
    const informadores = Array.from({ length: 12 }, (_, i) => `Informador ${String(i)}`);
    const tickets = informadores.flatMap((nombre, i) =>
      // El informador i aparece 12 - i veces: el orden por frecuencia es predecible.
      Array.from({ length: 12 - i }, () =>
        ticketDePrueba({ informador: nombre, responsable: '', responsableProyecto: '' }),
      ),
    );

    const resultado = anonimizar(tickets, opciones);
    const usuarios = new Set(resultado.tickets.map((t) => t.informador));

    expect(resultado.personasOriginales).toBe(12);
    expect(usuarios.size).toBe(9);
    expect(resultado.tickets.filter((t) => t.informador === 'Usuario 1')).toHaveLength(12);
    expect(resultado.tickets.filter((t) => t.informador === 'Usuario 9')).toHaveLength(
      4 + 3 + 2 + 1,
    );
    expect(resultado.tickets.every((t) => t.responsable === '')).toBe(true);
  });

  it('con hasta 9 personas, cada una tiene usuario propio', () => {
    const tickets = Array.from({ length: 9 }, (_, i) =>
      ticketDePrueba({
        informador: `Persona ${String(i)}`,
        responsable: '',
        responsableProyecto: '',
      }),
    );
    const usuarios = new Set(anonimizar(tickets, opciones).tickets.map((t) => t.informador));
    expect(usuarios.size).toBe(9);
    expect(usuarios.has('Usuario 9')).toBe(true);
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
