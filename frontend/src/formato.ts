/** Formatos argentinos para números, porcentajes y fechas (spec de la etapa 7). */
const ZONA = 'America/Argentina/Buenos_Aires';

const entero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
const fechaHora = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: ZONA,
});
const mes = new Intl.DateTimeFormat('es-AR', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export const formatearNumero = (valor: number): string => entero.format(valor);

export const formatearDecimal = (valor: number): string => decimal.format(valor);

export function formatearPorcentaje(parte: number, total: number): string {
  return `${decimal.format(total === 0 ? 0 : (parte / total) * 100)} %`;
}

/** `09/10/2026 16:45`, en hora de Argentina. */
export function formatearFechaHora(iso: string): string {
  return fechaHora.format(new Date(iso)).replace(',', '');
}

/** `2026-03` → `mar 2026`. */
export function formatearMes(periodo: string): string {
  return mes.format(new Date(`${periodo}-01T00:00:00Z`)).replace('.', '');
}

/** "hace instantes", "hace 3 min", "hace 2 h", "hace 4 días". */
export function haceCuanto(iso: string, ahora: Date): string {
  const minutos = Math.floor((ahora.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutos < 1) return 'hace instantes';
  if (minutos < 60) return `hace ${String(minutos)} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${String(horas)} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${String(dias)} ${dias === 1 ? 'día' : 'días'}`;
}
