/**
 * CSV pensado para abrirse con doble clic en Excel con configuración regional en español:
 * separador `;`, BOM UTF-8 y fin de línea CRLF.
 */
export const SEPARADOR = ';';
export const BOM = String.fromCharCode(0xfeff);

function escapar(valor: string): string {
  return /[";\r\n]/.test(valor) ? `"${valor.replaceAll('"', '""')}"` : valor;
}

export function aCsv<T extends object>(
  filas: readonly T[],
  columnas: readonly (keyof T & string)[],
): string {
  const lineas = [
    columnas.join(SEPARADOR),
    ...filas.map((fila) =>
      columnas.map((columna) => escapar(String(fila[columna]))).join(SEPARADOR),
    ),
  ];
  return `${BOM}${lineas.join('\r\n')}\r\n`;
}
