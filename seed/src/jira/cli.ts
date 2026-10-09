// Punto de entrada: `npm run jira:preparar -w seed` y `npm run jira:cargar -w seed`.
// Agregar `-- --confirmar` para escribir en Jira; sin eso corre en modo simulación.
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ClienteJira } from './cliente.js';
import { cargar } from './cargar.js';
import { leerConfigJira } from './config.js';
import { leerCsvAnonimizado } from './csv-anonimizado.js';
import { CAMPOS, type ClaveCampo } from './definicion.js';
import { preparar } from './preparar.js';

const raiz = resolve(import.meta.dirname, '../../..');
const comando = process.argv[2];
const confirmar = process.argv.includes('--confirmar');
const log = (mensaje: string) => process.stdout.write(`${mensaje}\n`);

try {
  process.loadEnvFile(join(raiz, 'backend', '.env'));
  const cliente = new ClienteJira(leerConfigJira(process.env));
  const tickets = leerCsvAnonimizado(
    await readFile(join(raiz, 'data', 'anonimizado', 'tickets.csv'), 'utf8'),
  );
  log(confirmar ? 'Modo: ESCRITURA en Jira' : 'Modo: simulación (no se escribe nada)');

  if (comando === 'preparar') {
    const proyectos = new Map(tickets.map((t) => [t.proyecto_clave, t.proyecto_nombre]));
    const { campos } = await preparar(
      cliente,
      {
        proyectos: [...proyectos]
          .map(([clave, nombre]) => ({ clave, nombre }))
          .sort((a, b) => a.clave.localeCompare(b.clave)),
        tiposIncidencia: [...new Set(tickets.map((t) => t.tipo_incidencia))],
        prioridades: [...new Set(tickets.map((t) => t.prioridad).filter((p) => p !== ''))],
      },
      { confirmar, log },
    );
    log('\nIds de los campos (para backend/.env, los usa el sync):');
    for (const [clave, id] of Object.entries(campos) as [ClaveCampo, string][]) {
      log(`${CAMPOS[clave].variable}=${id}`);
    }
  } else if (comando === 'cargar') {
    await cargar(cliente, tickets, { confirmar, log });
  } else {
    throw new Error('Comando desconocido: usar "preparar" o "cargar"');
  }
} catch (error) {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : 'desconocido'}\n`);
  process.exitCode = 1;
}
