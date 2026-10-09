import { createApp } from './app.js';
import { configJira, loadConfig } from './config.js';
import { abrirBase } from './db/base.js';
import { cargarDemo } from './demo/cargar.js';
import { Repositorio } from './db/repositorio.js';
import { ClienteJira } from './jira/cliente.js';
import { createLogger } from './logger.js';
import { ProgramadorDeSync } from './sync/programador.js';
import { Sincronizador } from './sync/sincronizador.js';

try {
  process.loadEnvFile();
} catch (error) {
  // Sin archivo .env se usan las variables del entorno; cualquier otro error se propaga.
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

const config = loadConfig(process.env);
const logger = createLogger(config.LOG_LEVEL);
const db = abrirBase(config.DATABASE_PATH);
const repositorio = new Repositorio(db);

let programador: ProgramadorDeSync | undefined;
let sincronizador: Sincronizador | undefined;
if (config.SYNC_ENABLED) {
  const jira = configJira(config);
  sincronizador = new Sincronizador({
    cliente: new ClienteJira(jira),
    repositorio,
    jira,
    logger,
  });
  programador = new ProgramadorDeSync(sincronizador, config.SYNC_INTERVAL_MINUTES * 60_000);
  programador.iniciar();
  logger.info({ cadaMinutos: config.SYNC_INTERVAL_MINUTES }, 'Sync con Jira activado');
}

// Sin Jira: modo demo con la foto anonimizada del repo (ADR-0014).
let modoDemo = false;
if (!config.SYNC_ENABLED) {
  try {
    const cantidad = await cargarDemo(repositorio);
    modoDemo = true;
    logger.warn({ tickets: cantidad }, 'Modo demo: sin Jira, se cargó la foto anonimizada');
  } catch (error) {
    logger.warn({ err: error }, 'Sync desactivado y sin foto de demo disponible');
  }
}

const app = createApp({
  repositorio,
  logger,
  sync: {
    activo: config.SYNC_ENABLED,
    intervaloMinutos: config.SYNC_INTERVAL_MINUTES,
    modoDemo,
    ...(sincronizador ? { sincronizador } : {}),
  },
});

const servidor = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'Backend escuchando');
});

async function apagar(senal: string): Promise<void> {
  logger.info({ senal }, 'Apagando');
  servidor.close();
  await programador?.detener();
  db.close();
  process.exit(0);
}
process.once('SIGINT', () => void apagar('SIGINT'));
process.once('SIGTERM', () => void apagar('SIGTERM'));
