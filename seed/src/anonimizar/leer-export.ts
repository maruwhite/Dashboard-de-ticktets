import ExcelJS from 'exceljs';

export const HOJA = 'Jira';

/** Lista blanca: las únicas columnas del export que se leen. El resto se ignora. */
export const COLUMNAS = {
  tipoIncidencia: 'Tipo de Incidencia',
  clave: 'Clave de incidencia',
  resumen: 'Resumen',
  responsable: 'Persona asignada',
  informador: 'Informador',
  estado: 'Estado',
  creada: 'Creada',
  proyectoClave: 'Clave del proyecto',
  proyectoNombre: 'Nombre del proyecto',
  tipoProyecto: 'Tipo de proyecto',
  responsableProyecto: 'Responsable del proyecto',
  resuelta: 'Campo personalizado (Fecha de Resolución)',
  prioridad: 'Prioridad',
} as const;

type Campo = keyof typeof COLUMNAS;
type CampoTexto = Exclude<Campo, 'creada' | 'resuelta'>;

export type TicketExport = Record<CampoTexto, string> & {
  creada: Date | string;
  resuelta: Date | string | null;
};

export interface LecturaExport {
  tickets: TicketExport[];
  /** Nombres de las columnas del export que no se leyeron (no son datos sensibles). */
  columnasDescartadas: string[];
}

type Valor = string | Date | null;

function valorDeCelda(value: ExcelJS.CellValue): Valor {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if ('richText' in value) return value.richText.map((parte) => parte.text).join('');
  if ('hyperlink' in value) return value.text;
  if ('result' in value) return valorDeCelda(value.result);
  return null;
}

function texto(valor: Valor): string {
  if (valor === null) return '';
  return valor instanceof Date ? valor.toISOString() : valor.trim();
}

export async function leerExport(ruta: string): Promise<LecturaExport> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.readFile(ruta);

  const hoja = libro.getWorksheet(HOJA);
  if (!hoja) throw new Error(`El archivo no tiene una hoja llamada "${HOJA}"`);

  const indicePorEncabezado = new Map<string, number>();
  hoja.getRow(1).eachCell((celda, columna) => {
    indicePorEncabezado.set(texto(valorDeCelda(celda.value)), columna);
  });

  const indices = {} as Record<Campo, number>;
  const faltantes: string[] = [];
  for (const [campo, encabezado] of Object.entries(COLUMNAS) as [Campo, string][]) {
    const indice = indicePorEncabezado.get(encabezado);
    if (indice === undefined) faltantes.push(encabezado);
    else indices[campo] = indice;
  }
  if (faltantes.length > 0) {
    throw new Error(`Faltan columnas en el export: ${faltantes.join(', ')}`);
  }

  const usadas = new Set<string>(Object.values(COLUMNAS));
  const columnasDescartadas = [...indicePorEncabezado.keys()].filter(
    (nombre) => !usadas.has(nombre),
  );

  const tickets: TicketExport[] = [];
  for (let numeroFila = 2; numeroFila <= hoja.rowCount; numeroFila++) {
    const fila = hoja.getRow(numeroFila);
    const leer = (campo: Campo): Valor => valorDeCelda(fila.getCell(indices[campo]).value);

    if (texto(leer('clave')) === '') continue; // fila vacía

    const creada = leer('creada');
    if (creada === null)
      throw new Error(`Ticket sin fecha de creación (fila ${String(numeroFila)})`);
    const resuelta = leer('resuelta');

    tickets.push({
      tipoIncidencia: texto(leer('tipoIncidencia')),
      clave: texto(leer('clave')),
      resumen: texto(leer('resumen')),
      responsable: texto(leer('responsable')),
      informador: texto(leer('informador')),
      estado: texto(leer('estado')),
      proyectoClave: texto(leer('proyectoClave')),
      proyectoNombre: texto(leer('proyectoNombre')),
      tipoProyecto: texto(leer('tipoProyecto')),
      responsableProyecto: texto(leer('responsableProyecto')),
      prioridad: texto(leer('prioridad')),
      creada: creada instanceof Date ? creada : creada.trim(),
      resuelta: resuelta === null || resuelta instanceof Date ? resuelta : resuelta.trim() || null,
    });
  }

  return { tickets, columnasDescartadas };
}
