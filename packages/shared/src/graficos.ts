export const MAXIMO_CATEGORIAS_TORTA = 6;

/** Torta solo con 6 categorías o menos; si no, barras. */
export function tipoDeGrafico(cantidadDeCategorias: number): 'torta' | 'barras' {
  return cantidadDeCategorias > 0 && cantidadDeCategorias <= MAXIMO_CATEGORIAS_TORTA
    ? 'torta'
    : 'barras';
}
