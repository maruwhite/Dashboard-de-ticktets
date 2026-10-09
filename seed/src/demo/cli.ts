// `npm run demo:verificar -w seed`: confirma que la foto de demo no contiene datos reales.
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { leerExport } from '../anonimizar/leer-export.js';
import { contarValoresOriginales } from './verificar.js';

const raiz = resolve(import.meta.dirname, '../../..');

try {
  const { tickets: originales } = await leerExport(join(raiz, 'data', 'Tickets_jira.xlsx'));
  const foto = await readFile(join(raiz, 'backend', 'demo', 'tickets.json'), 'utf8');
  const encontrados = contarValoresOriginales(foto, originales);
  if (encontrados > 0) {
    process.stderr.write(
      `La foto de demo contiene ${String(encontrados)} valores del export real. No la publiques.\n`,
    );
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `Verificación OK: ningún valor real en la foto de demo (${String(originales.length)} tickets del export revisados).\n`,
    );
  }
} catch (error) {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : 'desconocido'}\n`);
  process.exitCode = 1;
}
