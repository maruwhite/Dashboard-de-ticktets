import { describe, expect, it } from 'vitest';
import { aCsv, BOM } from './csv.js';

describe('aCsv', () => {
  it('genera CSV con BOM, separador ; y CRLF', () => {
    const csv = aCsv([{ a: 'uno', b: 'dos' }], ['a', 'b']);
    expect(csv).toBe(BOM + 'a;b\r\nuno;dos\r\n');
  });

  it('escapa separadores, comillas y saltos de línea', () => {
    const csv = aCsv([{ a: 'con;punto y coma', b: 'con "comillas"\ny salto' }], ['a', 'b']);
    expect(csv).toBe(BOM + 'a;b\r\n"con;punto y coma";"con ""comillas""\ny salto"\r\n');
  });

  it('respeta el orden de columnas indicado', () => {
    expect(aCsv([{ a: '1', b: '2' }], ['b', 'a'])).toBe(BOM + 'b;a\r\n2;1\r\n');
  });
});
