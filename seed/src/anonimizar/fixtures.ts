// Datos de prueba inventados. Nunca copiar valores del export real acá.
import ExcelJS from 'exceljs';
import { COLUMNAS, HOJA, type TicketExport } from './leer-export.js';

export function ticketDePrueba(cambios: Partial<TicketExport> = {}): TicketExport {
  return {
    tipoIncidencia: 'Tarea',
    clave: 'ZZZ-1',
    resumen: 'Titulo inventado uno',
    responsable: 'Persona Ficticia',
    informador: 'Otra Ficticia',
    estado: 'En curso',
    creada: '10/ene/24 9:00 AM',
    proyectoClave: 'ZZZ',
    proyectoNombre: 'Proyecto Inventado',
    tipoProyecto: 'software',
    responsableProyecto: 'Lider Ficticio',
    resuelta: null,
    prioridad: 'Media',
    ...cambios,
  };
}

/** Escribe un .xlsx sintético con las columnas del export más algunas extra. */
export async function escribirExportDePrueba(
  ruta: string,
  tickets: readonly TicketExport[],
  opciones: { hoja?: string; sinColumna?: keyof typeof COLUMNAS } = {},
): Promise<void> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet(opciones.hoja ?? HOJA);
  const campos = (Object.keys(COLUMNAS) as (keyof typeof COLUMNAS)[]).filter(
    (campo) => campo !== opciones.sinColumna,
  );

  hoja.addRow([...campos.map((campo) => COLUMNAS[campo]), 'Comentarios', 'ID de la incidencia']);
  for (const ticket of tickets) {
    hoja.addRow([...campos.map((campo) => ticket[campo]), 'comentario secreto', 12345]);
  }
  await libro.xlsx.writeFile(ruta);
}
