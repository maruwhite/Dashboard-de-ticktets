import { z } from 'zod';

// En un .env, `VARIABLE=` llega como string vacío: lo tratamos como "no definida".
const emptyToUndefined = (value: unknown): unknown => (value === '' ? undefined : value);

const envSchema = z.object({
  PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(65535).default(3000)),
  LOG_LEVEL: z.preprocess(
    emptyToUndefined,
    z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  ),
  // Jira: opcionales hasta la etapa de sync.
  JIRA_BASE_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  JIRA_EMAIL: z.preprocess(emptyToUndefined, z.email().optional()),
  JIRA_API_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
});

export type Config = z.infer<typeof envSchema>;

export class ConfigError extends Error {
  override name = 'ConfigError';
}

/**
 * Valida las variables de entorno. Si algo es inválido, el error nombra la variable y el
 * problema, nunca el valor (que podría ser un secreto).
 */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new ConfigError(`Configuración inválida → ${problems}`);
  }
  return result.data;
}
