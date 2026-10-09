import type { Ticket } from '@dashboard/shared';
import { describe, expect, it } from 'vitest';
import {
  calcularDashboard,
  calcularDistribucion,
  calcularKpis,
  calcularOpciones,
  calcularTendencia,
  filtrar,
} from './calcular.js';
import { diaLocal, mesesEntre, mesLocal } from './fechas.js';

// "Ahora": 9/10/2026 12:00 en Argentina.
const AHORA = new Date('2026-10-09T15:00:00.000Z');

let secuencia = 0;
function ticket(cambios: Partial<Ticket> = {}): Ticket {
  secuencia++;
  return {
    clave: `PRJA-${String(secuencia)}`,
    idOrigen: `T-${String(secuencia)}`,
    tipo: 'Tarea',
    estado: 'En curso',
    prioridad: 'Media',
    proyectoClave: 'PRJA',
    proyectoNombre: 'Proyecto Alfa',
    tipoProyecto: 'software',
    responsable: 'Agente 1',
    informador: 'Usuario 1',
    responsableProyecto: 'Usuario 2',
    titulo: 'Título inventado',
    creada: '2026-01-10T12:00:00.000Z',
    resuelta: null,
    actualizada: '2026-10-09T12:00:00.000Z',
    vencimiento: null,
    ...cambios,
  };
}

describe('calcularKpis', () => {
  it('cuenta cada grupo; abiertos = por hacer + en curso + en espera', () => {
    const kpis = calcularKpis(
      [
        ticket({ estado: 'Planificado' }),
        ticket({ estado: 'En curso' }),
        ticket({ estado: 'Análisis y Estimación' }),
        ticket({ estado: 'Pausado' }),
        ticket({ estado: 'Finalizado', resuelta: '2026-01-11T12:00:00.000Z' }),
        ticket({ estado: 'Cerrado', resuelta: '2026-01-13T12:00:00.000Z' }),
        ticket({ estado: 'Cancelado', resuelta: '2026-01-10T13:00:00.000Z' }),
        ticket({ estado: 'Rechazado' }),
        ticket({ estado: 'Estado nuevo' }),
      ],
      AHORA,
    );

    expect(kpis).toMatchObject({
      total: 9,
      abiertos: 4,
      enCurso: 2,
      enEspera: 1,
      completados: 2,
      descartados: 2,
    });
  });

  it('estancados: abiertos con más de 3 días sin cambios (el límite exacto no cuenta)', () => {
    const hace = (dias: number) => new Date(AHORA.getTime() - dias * 86_400_000).toISOString();
    const kpis = calcularKpis(
      [
        ticket({ actualizada: hace(3) }),
        ticket({ actualizada: hace(3.01) }),
        ticket({ actualizada: hace(10), estado: 'Finalizado' }),
        ticket({ actualizada: '' }),
      ],
      AHORA,
    );
    expect(kpis.estancados).toBe(1);
  });

  it('vencidos: abiertos con vencimiento anterior a hoy (hora de Argentina)', () => {
    const kpis = calcularKpis(
      [
        ticket({ vencimiento: '2026-10-08' }),
        ticket({ vencimiento: '2026-10-09' }), // vence hoy: todavía no
        ticket({ vencimiento: null }),
        ticket({ vencimiento: '2026-01-01', estado: 'Cerrado' }),
      ],
      AHORA,
    );
    expect(kpis.vencidos).toBe(1);
  });

  it('cycle time: solo completados con fecha de resolución; promedio y mediana', () => {
    const kpis = calcularKpis(
      [
        ticket({ estado: 'Finalizado', resuelta: '2026-01-11T12:00:00.000Z' }), // 1 día
        ticket({ estado: 'Cerrado', resuelta: '2026-01-13T12:00:00.000Z' }), // 3 días
        ticket({ estado: 'Finalizado', resuelta: '2026-01-20T12:00:00.000Z' }), // 10 días
        ticket({ estado: 'Cancelado', resuelta: '2026-03-10T12:00:00.000Z' }), // descartado: no
        ticket({ estado: 'Finalizado', resuelta: null }), // sin resolución: no
        ticket({ estado: 'Finalizado', resuelta: 'fecha inválida' }),
      ],
      AHORA,
    );
    expect(kpis.cycleTime).toEqual({ promedioDias: 4.7, medianaDias: 3, tickets: 3 });
  });

  it('cycle time con cantidad par usa el promedio de los dos del medio', () => {
    const kpis = calcularKpis(
      [
        ticket({ estado: 'Finalizado', resuelta: '2026-01-11T12:00:00.000Z' }),
        ticket({ estado: 'Finalizado', resuelta: '2026-01-14T12:00:00.000Z' }),
      ],
      AHORA,
    );
    expect(kpis.cycleTime).toEqual({ promedioDias: 2.5, medianaDias: 2.5, tickets: 2 });
  });

  it('sin completados no hay cycle time', () => {
    expect(calcularKpis([ticket()], AHORA).cycleTime).toEqual({
      promedioDias: null,
      medianaDias: null,
      tickets: 0,
    });
  });
});

describe('filtrar', () => {
  const a = ticket({
    proyectoClave: 'PRJA',
    prioridad: 'Media',
    creada: '2026-03-01T02:00:00.000Z',
  });
  const b = ticket({
    proyectoClave: 'PRJB',
    prioridad: 'Alta',
    creada: '2026-03-02T12:00:00.000Z',
  });
  const c = ticket({
    proyectoClave: 'PRJC',
    prioridad: 'Media',
    creada: '2026-03-31T12:00:00.000Z',
  });
  const todos = [a, b, c];

  it('sin filtros (o con filtros vacíos) devuelve todo', () => {
    expect(filtrar(todos, {})).toEqual(todos);
    expect(filtrar(todos, { proyecto: [] })).toEqual(todos);
  });

  it('O dentro de una dimensión, Y entre dimensiones', () => {
    expect(filtrar(todos, { proyecto: ['PRJA', 'PRJB'] })).toEqual([a, b]);
    expect(filtrar(todos, { proyecto: ['PRJA', 'PRJB'], prioridad: ['Media'] })).toEqual([a]);
  });

  it('filtra por cada dimensión', () => {
    const t = ticket({
      tipo: 'Incidente',
      tipoProyecto: 'service_desk',
      estado: 'Pausado',
      responsable: 'Agente 9',
      informador: 'Usuario 9',
      responsableProyecto: 'Usuario 8',
    });
    const filtros = [
      { tipoIncidencia: ['Incidente'] },
      { tipoProyecto: ['service_desk'] },
      { estado: ['Pausado'] },
      { responsable: ['Agente 9'] },
      { informador: ['Usuario 9'] },
      { responsableProyecto: ['Usuario 8'] },
    ];
    for (const f of filtros) expect(filtrar([...todos, t], f)).toEqual([t]);
  });

  it('rango de fechas inclusive, en hora de Argentina', () => {
    // a se creó el 1/3 a las 02:00 UTC = 28/2 23:00 en Argentina.
    expect(filtrar(todos, { desde: '2026-03-01' })).toEqual([b, c]);
    expect(filtrar(todos, { desde: '2026-02-28', hasta: '2026-03-02' })).toEqual([a, b]);
    expect(filtrar(todos, { hasta: '2026-03-31' })).toEqual(todos);
    expect(filtrar([ticket({ creada: '' })], { desde: '2000-01-01' })).toEqual([]);
  });
});

describe('calcularDistribucion', () => {
  it('cuenta por valor, de mayor a menor y alfabético a igual cantidad', () => {
    const tickets = [
      ticket({ prioridad: 'Media' }),
      ticket({ prioridad: 'Alta' }),
      ticket({ prioridad: 'Media' }),
      ticket({ prioridad: 'Baja' }),
    ];
    expect(calcularDistribucion(tickets, 'prioridad')).toEqual([
      { valor: 'Media', etiqueta: 'Media', cantidad: 2 },
      { valor: 'Alta', etiqueta: 'Alta', cantidad: 1 },
      { valor: 'Baja', etiqueta: 'Baja', cantidad: 1 },
    ]);
  });

  it('muestra "(sin dato)" para valores vacíos y agrega el grupo en estados', () => {
    expect(calcularDistribucion([ticket({ responsable: '' })], 'responsable')).toEqual([
      { valor: '', etiqueta: '(sin dato)', cantidad: 1 },
    ]);
    expect(calcularDistribucion([ticket({ estado: 'Pausado' })], 'estado')).toEqual([
      { valor: 'Pausado', etiqueta: 'Pausado', cantidad: 1, grupo: 'En espera' },
    ]);
  });
});

describe('calcularTendencia', () => {
  it('creados y resueltos (solo completados) por mes, completando con ceros', () => {
    const tendencia = calcularTendencia([
      ticket({
        creada: '2026-01-15T12:00:00.000Z',
        estado: 'Finalizado',
        resuelta: '2026-03-02T12:00:00.000Z',
      }),
      ticket({
        creada: '2026-01-20T12:00:00.000Z',
        estado: 'Cancelado',
        resuelta: '2026-03-05T12:00:00.000Z',
      }),
      // 1/4 a las 01:00 UTC = 31/3 22:00 en Argentina: cuenta en marzo.
      ticket({ creada: '2026-04-01T01:00:00.000Z' }),
      ticket({ creada: '' }),
    ]);
    expect(tendencia).toEqual([
      { periodo: '2026-01', creados: 2, resueltos: 0 },
      { periodo: '2026-02', creados: 0, resueltos: 0 },
      { periodo: '2026-03', creados: 1, resueltos: 1 },
    ]);
  });

  it('sin tickets no hay tendencia', () => {
    expect(calcularTendencia([])).toEqual([]);
  });
});

describe('calcularOpciones', () => {
  it('lista valores únicos ordenados; los proyectos incluyen el nombre', () => {
    const opciones = calcularOpciones([
      ticket({ proyectoClave: 'PRJB', proyectoNombre: 'Proyecto Beta', informador: '' }),
      ticket({ proyectoClave: 'PRJA', proyectoNombre: 'Proyecto Alfa' }),
      ticket({ proyectoClave: 'PRJA', proyectoNombre: 'Proyecto Alfa' }),
    ]);
    expect(opciones.proyecto).toEqual([
      { valor: 'PRJA', etiqueta: 'PRJA — Proyecto Alfa' },
      { valor: 'PRJB', etiqueta: 'PRJB — Proyecto Beta' },
    ]);
    expect(opciones.informador).toEqual([
      { valor: '', etiqueta: '(sin dato)' },
      { valor: 'Usuario 1', etiqueta: 'Usuario 1' },
    ]);
  });
});

describe('orden natural', () => {
  it('ordena "Usuario 2" antes que "Usuario 10" en las opciones', () => {
    const opciones = calcularOpciones(
      ['Usuario 10', 'Usuario 2', 'Usuario 1'].map((informador) => ticket({ informador })),
    );
    expect(opciones.informador.map((o) => o.valor)).toEqual([
      'Usuario 1',
      'Usuario 2',
      'Usuario 10',
    ]);
  });
});

describe('calcularDashboard', () => {
  it('aplica los filtros a KPIs, distribuciones y tendencia, pero no a las opciones', () => {
    const tickets = [
      ticket({ proyectoClave: 'PRJA', estado: 'En curso' }),
      ticket({ proyectoClave: 'PRJB', proyectoNombre: 'Proyecto Beta', estado: 'Cerrado' }),
    ];

    const dashboard = calcularDashboard(tickets, { proyecto: ['PRJA'] }, AHORA);

    expect(dashboard.totalSinFiltrar).toBe(2);
    expect(dashboard.kpis.total).toBe(1);
    expect(dashboard.distribuciones.estado).toEqual([
      { valor: 'En curso', etiqueta: 'En curso', cantidad: 1, grupo: 'En curso' },
    ]);
    expect(dashboard.tendencia).toEqual([{ periodo: '2026-01', creados: 1, resueltos: 0 }]);
    expect(dashboard.opciones.proyecto.map((o) => o.valor)).toEqual(['PRJA', 'PRJB']);
    expect(Object.keys(dashboard.distribuciones)).toHaveLength(8);
  });
});

describe('fechas en hora de Argentina', () => {
  it('convierte días y meses, y tolera fechas inválidas', () => {
    expect(diaLocal('2026-03-01T02:59:59.000Z')).toBe('2026-02-28');
    expect(diaLocal('2026-03-01T03:00:00.000Z')).toBe('2026-03-01');
    expect(mesLocal('2026-01-01T00:00:00.000Z')).toBe('2025-12');
    expect(diaLocal('')).toBeNull();
    expect(mesLocal('no es fecha')).toBeNull();
  });

  it('lista los meses de un rango, cruzando años', () => {
    expect(mesesEntre('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(mesesEntre('2026-03', '2026-03')).toEqual(['2026-03']);
  });
});
