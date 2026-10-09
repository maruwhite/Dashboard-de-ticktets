import { describe, expect, it } from 'vitest';
import {
  aFecha,
  diasEntre,
  FechaInvalidaError,
  formatearFecha,
  parseFechaJira,
  sumarDias,
} from './fechas.js';

describe('parseFechaJira', () => {
  it.each([
    ['15/ene/26 9:30 AM', '2026-01-15 09:30'],
    ['15/ene/26 9:30 PM', '2026-01-15 21:30'],
    ['01/dic/25 12:05 AM', '2025-12-01 00:05'],
    ['01/dic/25 12:05 PM', '2025-12-01 12:05'],
    ['3/sept./25 11:05 p. m.', '2025-09-03 23:05'],
    ['3/SEP/2025 7:00 a.m.', '2025-09-03 07:00'],
    ['28/feb/24 10:00 am', '2024-02-28 10:00'],
  ])('%s → %s', (texto, esperado) => {
    expect(formatearFecha(parseFechaJira(texto))).toBe(esperado);
  });

  it.each(['', '2026-01-15', '15/xyz/26 9:30 AM', '31/feb/26 9:30 AM'])(
    'rechaza "%s" sin incluir el valor en el error',
    (texto) => {
      expect(() => parseFechaJira(texto)).toThrow(FechaInvalidaError);
      try {
        parseFechaJira(texto);
      } catch (error) {
        if (texto !== '') expect((error as Error).message).not.toContain(texto);
      }
    },
  );
});

describe('utilidades de fechas', () => {
  it('aFecha acepta fechas tipadas y texto', () => {
    const fecha = new Date(Date.UTC(2025, 0, 1));
    expect(aFecha(fecha)).toBe(fecha);
    expect(formatearFecha(aFecha('01/ene/25 1:00 PM'))).toBe('2025-01-01 13:00');
  });

  it('sumarDias conserva la hora y diasEntre ignora la hora', () => {
    const fecha = parseFechaJira('30/dic/25 11:45 PM');
    expect(formatearFecha(sumarDias(fecha, 3))).toBe('2026-01-02 23:45');
    expect(formatearFecha(sumarDias(fecha, -30))).toBe('2025-11-30 23:45');
    expect(diasEntre(fecha, parseFechaJira('02/ene/26 1:00 AM'))).toBe(3);
  });
});
