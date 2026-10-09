import { describe, expect, it } from 'vitest';
import {
  esAbierto,
  GRUPOS,
  grupoDeEstado,
  MAXIMO_CATEGORIAS_TORTA,
  tipoDeGrafico,
} from './index.js';

describe('grupoDeEstado', () => {
  it.each([
    ['Planificado', 'Por hacer'],
    ['Análisis y Estimación', 'En curso'],
    ['Análisis y Diseño funcional', 'En curso'],
    ['En curso', 'En curso'],
    ['Solicitud información a Usuario', 'En espera'],
    ['Pausado', 'En espera'],
    ['Cerrado', 'Completado'],
    ['Finalizado', 'Completado'],
    ['Finalizada', 'Completado'],
    ['Cancelado', 'Descartado'],
    ['Rechazado', 'Descartado'],
  ])('%s → %s', (estado, grupo) => {
    expect(grupoDeEstado(estado)).toBe(grupo);
  });

  it('ignora mayúsculas y espacios sobrantes', () => {
    expect(grupoDeEstado('  en   CURSO ')).toBe('En curso');
    expect(grupoDeEstado('análisis y diseño FUNCIONAL')).toBe('En curso');
  });

  it('clasifica los estados desconocidos como "Sin clasificar"', () => {
    expect(grupoDeEstado('Open')).toBe('Sin clasificar');
    expect(grupoDeEstado('')).toBe('Sin clasificar');
  });
});

describe('esAbierto', () => {
  it('solo Por hacer, En curso y En espera están abiertos', () => {
    expect(GRUPOS.filter(esAbierto)).toEqual(['Por hacer', 'En curso', 'En espera']);
  });
});

describe('tipoDeGrafico', () => {
  it('torta con 2 a 6 categorías; barras con una sola, con más de 6 o con ninguna', () => {
    expect(tipoDeGrafico(1)).toBe('barras');
    expect(tipoDeGrafico(2)).toBe('torta');
    expect(tipoDeGrafico(MAXIMO_CATEGORIAS_TORTA)).toBe('torta');
    expect(tipoDeGrafico(MAXIMO_CATEGORIAS_TORTA + 1)).toBe('barras');
    expect(tipoDeGrafico(0)).toBe('barras');
  });
});
