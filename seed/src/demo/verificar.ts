import { valoresSensibles } from '../anonimizar/anonimizar.js';
import type { TicketExport } from '../anonimizar/leer-export.js';

/**
 * Cuántos valores sensibles del export real aparecen en un texto (la foto de demo antes de
 * publicarla, ADR-0014). Devuelve solo la cantidad: nunca los valores.
 */
export function contarValoresOriginales(
  texto: string,
  originales: readonly TicketExport[],
): number {
  let encontrados = 0;
  for (const valor of valoresSensibles(originales)) {
    if (texto.includes(valor)) encontrados++;
  }
  return encontrados;
}
