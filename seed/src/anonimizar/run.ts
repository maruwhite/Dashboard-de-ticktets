import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { anonimizar, COLUMNAS_SALIDA, contarFugas } from './anonimizar.js';
import { aCsv } from './csv.js';
import { leerExport } from './leer-export.js';
import { generarResumen } from './resumen.js';

export interface OpcionesRun {
  entrada: string;
  salidaDir: string;
  hoy: Date;
  diasAntesDeHoy: number;
  /** Solo recibe conteos y rutas: nunca valores del export. */
  log: (mensaje: string) => void;
}

export interface ResultadoRun {
  archivoTickets: string;
  archivoResumen: string;
  cantidad: number;
}

export async function run(opciones: OpcionesRun): Promise<ResultadoRun> {
  const { tickets: originales, columnasDescartadas } = await leerExport(opciones.entrada);
  opciones.log(
    `Leídos ${String(originales.length)} tickets (${String(columnasDescartadas.length)} columnas descartadas).`,
  );

  const resultado = anonimizar(originales, {
    hoy: opciones.hoy,
    diasAntesDeHoy: opciones.diasAntesDeHoy,
  });

  const fugas = contarFugas(resultado.tickets, originales);
  if (fugas > 0) {
    throw new Error(
      `Se detectaron ${String(fugas)} celdas con valores originales en la salida. No se escribió nada.`,
    );
  }

  await mkdir(opciones.salidaDir, { recursive: true });
  const archivoTickets = join(opciones.salidaDir, 'tickets.csv');
  const archivoResumen = join(opciones.salidaDir, 'resumen.md');

  await writeFile(archivoTickets, aCsv(resultado.tickets, COLUMNAS_SALIDA), 'utf8');
  await writeFile(
    archivoResumen,
    generarResumen({ ...resultado, columnasDescartadas, generado: opciones.hoy }),
    'utf8',
  );

  opciones.log(
    `Anonimizados ${String(resultado.tickets.length)} tickets: ${String(resultado.personasOriginales)} personas y ${String(resultado.proyectosOriginales)} proyectos reemplazados.`,
  );
  opciones.log(`Archivos generados en ${opciones.salidaDir}: tickets.csv y resumen.md`);
  opciones.log('Revisalos antes de cargar nada a Jira.');

  return { archivoTickets, archivoResumen, cantidad: resultado.tickets.length };
}
