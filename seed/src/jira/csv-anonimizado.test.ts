import { describe, expect, it } from 'vitest';
import { COLUMNAS_SALIDA, type TicketAnonimizado } from '../anonimizar/anonimizar.js';
import { aCsv, BOM } from '../anonimizar/csv.js';
import { leerCsvAnonimizado } from './csv-anonimizado.js';

const ticket: TicketAnonimizado = {
  id_origen: 'T-001',
  tipo_incidencia: 'Tarea',
  estado: 'En curso',
  prioridad: 'Media',
  tipo_proyecto: 'software',
  proyecto_clave: 'PRJA',
  proyecto_nombre: 'Proyecto Alfa',
  responsable: 'Agente 1',
  informador: 'Usuario 2',
  responsable_proyecto: 'Usuario 3',
  titulo: 'Título con ; punto y coma, "comillas"\ny salto',
  creada: '2025-01-10 09:00',
  resuelta: '',
};

describe('leerCsvAnonimizado', () => {
  it('lee lo que escribe la anonimización (ida y vuelta)', () => {
    const otro = { ...ticket, id_origen: 'T-002', titulo: 'Simple' };
    expect(leerCsvAnonimizado(aCsv([ticket, otro], COLUMNAS_SALIDA))).toEqual([ticket, otro]);
  });

  it('acepta archivos sin BOM, con LF y sin salto final', () => {
    const csv = aCsv([ticket], COLUMNAS_SALIDA)
      .slice(BOM.length)
      .replaceAll('\r\n', '\n')
      .trimEnd();
    expect(leerCsvAnonimizado(csv)).toEqual([ticket]);
  });

  it('ignora líneas vacías', () => {
    expect(leerCsvAnonimizado(`${aCsv([ticket], COLUMNAS_SALIDA)}\r\n\r\n`)).toHaveLength(1);
  });

  it('rechaza encabezados distintos', () => {
    expect(() => leerCsvAnonimizado('a;b\r\n1;2\r\n')).toThrow('no tiene las columnas esperadas');
    expect(() => leerCsvAnonimizado('')).toThrow('no tiene las columnas esperadas');
  });

  it('rechaza filas con otra cantidad de columnas', () => {
    expect(() => leerCsvAnonimizado(`${COLUMNAS_SALIDA.join(';')}\r\nT-1;Tarea\r\n`)).toThrow(
      'La fila 2 tiene 2 columnas',
    );
  });
});
