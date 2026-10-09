import { COLUMNAS_SALIDA, type TicketAnonimizado } from '../anonimizar/anonimizar.js';
import { BOM, SEPARADOR } from '../anonimizar/csv.js';

/** Separa un CSV (`;`, comillas dobles, CRLF) en filas de celdas. */
function separarCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let entreComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const caracter = texto.charAt(i);
    if (entreComillas) {
      if (caracter === '"' && texto.charAt(i + 1) === '"') {
        celda += '"';
        i++;
      } else if (caracter === '"') {
        entreComillas = false;
      } else {
        celda += caracter;
      }
    } else if (caracter === '"') {
      entreComillas = true;
    } else if (caracter === SEPARADOR) {
      fila.push(celda);
      celda = '';
    } else if (caracter === '\n' || caracter === '\r') {
      if (caracter === '\r' && texto.charAt(i + 1) === '\n') i++;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = '';
    } else {
      celda += caracter;
    }
  }
  if (celda !== '' || fila.length > 0) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas;
}

/** Lee el `tickets.csv` generado por la anonimización y valida su estructura. */
export function leerCsvAnonimizado(texto: string): TicketAnonimizado[] {
  const [encabezado, ...filas] = separarCsv(texto.startsWith(BOM) ? texto.slice(1) : texto);
  if (encabezado?.join(SEPARADOR) !== COLUMNAS_SALIDA.join(SEPARADOR)) {
    throw new Error('El archivo no tiene las columnas esperadas de tickets.csv');
  }

  return filas
    .filter((fila) => fila.some((celda) => celda !== ''))
    .map((fila, i) => {
      if (fila.length !== COLUMNAS_SALIDA.length) {
        throw new Error(`La fila ${String(i + 2)} tiene ${String(fila.length)} columnas`);
      }
      return Object.fromEntries(
        COLUMNAS_SALIDA.map((columna, j) => [columna, fila[j] ?? '']),
      ) as unknown as TicketAnonimizado;
    });
}
