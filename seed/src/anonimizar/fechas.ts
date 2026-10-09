/**
 * Fechas "naive" (sin zona horaria): el export de Jira no indica zona, así que se trabajan
 * como UTC y se escriben sin zona. Correr todas las fechas por días enteros conserva las
 * horas y las duraciones.
 */

const MESES: Record<string, number> = {
  ene: 0,
  feb: 1,
  mar: 2,
  abr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  sep: 8,
  sept: 8,
  set: 8,
  oct: 9,
  nov: 10,
  dic: 11,
};

const DIA_MS = 24 * 60 * 60 * 1000;

// Ejemplos: "15/ene/26 9:30 AM", "03/sept./25 11:05 p. m."
const FORMATO_JIRA =
  /^(\d{1,2})\/([a-záéíóú]+)\.?\/(\d{2}|\d{4})\s+(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?$/i;

export class FechaInvalidaError extends Error {
  override name = 'FechaInvalidaError';
}

/** Parsea una fecha del export de Jira. El error no incluye el valor original. */
export function parseFechaJira(texto: string): Date {
  const match = FORMATO_JIRA.exec(texto.trim());
  if (!match) throw new FechaInvalidaError('Formato de fecha no reconocido');

  const [, dia, mesTexto, anioTexto, horaTexto, minutos, meridiano] = match;
  const mes = MESES[(mesTexto ?? '').toLowerCase()];
  if (mes === undefined) throw new FechaInvalidaError('Mes no reconocido');

  const anio = Number(anioTexto);
  let hora = Number(horaTexto) % 12;
  if ((meridiano ?? '').toLowerCase() === 'p') hora += 12;

  const fecha = new Date(
    Date.UTC(anio < 100 ? 2000 + anio : anio, mes, Number(dia), hora, Number(minutos)),
  );
  if (fecha.getUTCDate() !== Number(dia)) throw new FechaInvalidaError('Día inexistente');
  return fecha;
}

/** Acepta una fecha ya tipada (celda de Excel) o un texto con el formato de Jira. */
export function aFecha(valor: Date | string): Date {
  return valor instanceof Date ? valor : parseFechaJira(valor);
}

export function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * DIA_MS);
}

/** Días enteros entre las fechas (sin hora) de `desde` y `hasta`. */
export function diasEntre(desde: Date, hasta: Date): number {
  const inicio = Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate());
  const fin = Date.UTC(hasta.getUTCFullYear(), hasta.getUTCMonth(), hasta.getUTCDate());
  return Math.round((fin - inicio) / DIA_MS);
}

/** Formato de salida: `AAAA-MM-DD HH:mm`. */
export function formatearFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 16).replace('T', ' ');
}
