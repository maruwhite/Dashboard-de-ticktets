import { describe, expect, it } from 'vitest';
import { assertNever } from './index.js';

describe('assertNever', () => {
  it('lanza un error con el valor no contemplado', () => {
    expect(() => assertNever('inesperado' as never)).toThrow('Valor no contemplado: inesperado');
  });
});
