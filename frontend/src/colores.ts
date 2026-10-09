import type { GrupoEstado, Opcion } from '@dashboard/shared';

/**
 * Colores por rol (ADR-0013). Los valores reales están en `styles.css` como variables, con
 * versión clara y oscura validadas.
 */
export const CANTIDAD_SERIES = 8;
export const COLOR_SIN_SERIE = 'var(--serie-otros)';

/**
 * Color categórico de una entidad: depende de su posición en las opciones totales (orden
 * fijo), no del ranking del momento, así un valor conserva su color al filtrar. Nunca se
 * cicla: más allá de la octava, gris.
 */
export function colorDeEntidad(valor: string, opciones: readonly Opcion[]): string {
  const indice = opciones.findIndex((o) => o.valor === valor);
  return indice >= 0 && indice < CANTIDAD_SERIES
    ? `var(--serie-${String(indice + 1)})`
    : COLOR_SIN_SERIE;
}

/** Solo tres grupos llevan color (validados todos contra todos); el resto, grises. */
export const COLOR_DE_GRUPO: Record<GrupoEstado, string> = {
  'En curso': 'var(--serie-1)',
  'En espera': 'var(--serie-2)',
  Completado: 'var(--serie-3)',
  'Por hacer': 'var(--gris-1)',
  Descartado: 'var(--gris-2)',
  'Sin clasificar': 'var(--gris-3)',
};

export const COLOR_BARRA = 'var(--acento)';
