import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';

try {
  process.loadEnvFile();
} catch (error) {
  // Sin archivo .env se usan las variables del entorno; cualquier otro error se propaga.
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

const config = loadConfig(process.env);
const logger = createLogger(config.LOG_LEVEL);

createApp().listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'Backend escuchando');
});
