import { randomInt } from 'node:crypto';
import { join, resolve } from 'node:path';
import { run } from './run.js';

const raiz = resolve(import.meta.dirname, '../../..');

try {
  await run({
    entrada: join(raiz, 'data', 'Tickets_jira.xlsx'),
    salidaDir: join(raiz, 'data', 'anonimizado'),
    hoy: new Date(),
    diasAntesDeHoy: randomInt(1, 8),
    log: (mensaje) => process.stdout.write(`${mensaje}\n`),
  });
} catch (error) {
  // Los mensajes de error del proceso nunca incluyen valores del export.
  process.stderr.write(`Error: ${error instanceof Error ? error.message : 'desconocido'}\n`);
  process.exitCode = 1;
}
