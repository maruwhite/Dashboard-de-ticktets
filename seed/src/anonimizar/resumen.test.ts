import { describe, expect, it } from 'vitest';
import type { TicketAnonimizado } from './anonimizar.js';
import { generarResumen } from './resumen.js';

const ticket = (cambios: Partial<TicketAnonimizado> = {}): TicketAnonimizado => ({
  id_origen: 'T-001',
  tipo_incidencia: 'Tarea',
  estado: 'En curso',
  prioridad: 'Media',
  tipo_proyecto: 'software',
  proyecto_clave: 'PRJA',
  proyecto_nombre: 'Proyecto Alfa',
  responsable: 'Usuario 1',
  informador: 'Usuario 2',
  responsable_proyecto: 'Usuario 3',
  titulo: 'Preparar ambiente de pruebas',
  creada: '2026-10-01 10:00',
  resuelta: '',
  ...cambios,
});

const base = {
  personasOriginales: 3,
  proyectosOriginales: 1,
  columnasDescartadas: ['Comentarios'],
  generado: new Date(Date.UTC(2026, 9, 9, 12, 0)),
};

describe('generarResumen', () => {
  it('incluye totales, rango de fechas, conteos ordenados y columnas descartadas', () => {
    const resumen = generarResumen({
      ...base,
      tickets: [
        ticket({ resuelta: '2026-10-05 08:00' }),
        ticket({ id_origen: 'T-002', estado: 'Cerrado', creada: '2026-09-01 09:00' }),
        ticket({ id_origen: 'T-003', estado: 'Cerrado', responsable: '' }),
      ],
    });

    expect(resumen).toContain('- Generado: 2026-10-09 12:00 (UTC)');
    expect(resumen).toContain('- Tickets: 3');
    expect(resumen).toContain('- Tickets resueltos (con fecha de resolución): 1');
    expect(resumen).toContain(
      '- Informadores y responsables de proyecto distintos en el original: 3 → usuarios inventados: 2',
    );
    expect(resumen).toContain('- Responsables: repartidos entre 1 agentes ficticios');
    expect(resumen).toContain(
      '- Rango de fechas (ya corridas): 2026-09-01 09:00 → 2026-10-05 08:00',
    );
    expect(resumen.indexOf('| Cerrado | 2 |')).toBeLessThan(resumen.indexOf('| En curso | 1 |'));
    expect(resumen).toContain('| (vacío) | 1 |');
    expect(resumen).toContain('- Comentarios');
  });

  it('funciona sin tickets', () => {
    const resumen = generarResumen({ ...base, tickets: [] });
    expect(resumen).toContain('- Rango de fechas (ya corridas): - → -');
  });
});
