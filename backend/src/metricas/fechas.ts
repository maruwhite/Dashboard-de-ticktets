/**
 * Fechas en hora de Argentina (UTC−3, sin horario de verano desde 2009): "hoy", los días de
 * los filtros y los meses de la tendencia se calculan en esa zona (ADR-0006).
 */
const DESPLAZAMIENTO_MS = -3 * 60 * 60 * 1000;

function local(iso: string): string | null {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : new Date(ms + DESPLAZAMIENTO_MS).toISOString();
}

/** `AAAA-MM-DD` en hora de Argentina; null si la fecha no es válida. */
export function diaLocal(iso: string): string | null {
  return local(iso)?.slice(0, 10) ?? null;
}

/** `AAAA-MM` en hora de Argentina; null si la fecha no es válida. */
export function mesLocal(iso: string): string | null {
  return local(iso)?.slice(0, 7) ?? null;
}

/** Todos los meses (`AAAA-MM`) entre `desde` y `hasta`, inclusive. */
export function mesesEntre(desde: string, hasta: string): string[] {
  const meses: string[] = [];
  let [anio, mes] = desde.split('-').map(Number) as [number, number];
  for (;;) {
    const actual = `${String(anio)}-${String(mes).padStart(2, '0')}`;
    if (actual > hasta) return meses;
    meses.push(actual);
    mes++;
    if (mes > 12) {
      mes = 1;
      anio++;
    }
  }
}
