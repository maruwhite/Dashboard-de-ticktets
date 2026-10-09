export const MAXIMO_CATEGORIAS_TORTA = 6;

/**
 * Torta solo con 6 categorías o menos; si no, barras. Con una sola categoría también barras:
 * una torta llena no compara nada.
 */
export function tipoDeGrafico(cantidadDeCategorias: number): 'torta' | 'barras' {
  return cantidadDeCategorias >= 2 && cantidadDeCategorias <= MAXIMO_CATEGORIAS_TORTA
    ? 'torta'
    : 'barras';
}
