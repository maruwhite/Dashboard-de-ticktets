// `npm run demo:exportar -w backend`: genera la foto de demo desde la base sincronizada.
// Antes de commitearla, correr `npm run demo:verificar -w seed` (ADR-0014).
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { abrirBase } from '../db/base.js';
import { Repositorio } from '../db/repositorio.js';
import { RUTA_DEMO, serializarDemo } from './cargar.js';

const repositorio = new Repositorio(abrirBase(process.env.DATABASE_PATH ?? 'data/dashboard.db'));
const tickets = repositorio.listarTickets();
if (tickets.length === 0) {
  process.stderr.write('La base está vacía: corré primero el backend con el sync activado.\n');
  process.exitCode = 1;
} else {
  await mkdir(dirname(RUTA_DEMO), { recursive: true });
  await writeFile(RUTA_DEMO, serializarDemo(tickets), 'utf8');
  process.stdout.write(
    `Foto de demo generada: ${String(tickets.length)} tickets en ${RUTA_DEMO}\n`,
  );
}
