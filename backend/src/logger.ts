import { pino, type DestinationStream, type LevelWithSilent, type Logger } from 'pino';

const SENSITIVE_KEYS = [
  'authorization',
  'token',
  'apiToken',
  'password',
  'secret',
  'JIRA_API_TOKEN',
];

/** Rutas que el logger reemplaza por "[REDACTED]", en el primer y segundo nivel del objeto. */
export const REDACTED_PATHS = [
  ...SENSITIVE_KEYS,
  ...SENSITIVE_KEYS.map((key) => `*.${key}`),
  'headers.authorization',
  '*.headers.authorization',
];

export function createLogger(level: LevelWithSilent, destination?: DestinationStream): Logger {
  const options = { level, redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' } };
  return destination ? pino(options, destination) : pino(options);
}
