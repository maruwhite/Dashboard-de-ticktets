import { z } from 'zod';

// En un .env, `VARIABLE=` llega como string vacío: lo tratamos como "no definida".
const emptyToUndefined = (value: unknown): unknown => (value === '' ? undefined : value);
const opcional = <T extends z.ZodType>(schema: T) => z.preprocess(emptyToUndefined, schema);

const idDeCampo = z.string().regex(/^customfield_\d+$/, 'debe tener la forma customfield_NNNNN');

/** Campos personalizados de Jira que lee el sync (ADR-0004, ADR-0010). */
export const VARIABLES_DE_CAMPOS = {
  creada: 'JIRA_FIELD_CREADA',
  resuelta: 'JIRA_FIELD_RESUELTA',
  idOrigen: 'JIRA_FIELD_ID_ORIGEN',
  tipoProyecto: 'JIRA_FIELD_TIPO_PROYECTO',
  responsable: 'JIRA_FIELD_RESPONSABLE',
  informador: 'JIRA_FIELD_INFORMADOR',
  responsableProyecto: 'JIRA_FIELD_RESPONSABLE_PROYECTO',
} as const;

export type CampoPersonalizado = keyof typeof VARIABLES_DE_CAMPOS;

const OBLIGATORIAS_PARA_SYNC = [
  'JIRA_BASE_URL',
  'JIRA_EMAIL',
  'JIRA_API_TOKEN',
  ...Object.values(VARIABLES_DE_CAMPOS),
] as const;

const envSchema = z
  .object({
    PORT: opcional(z.coerce.number().int().min(1).max(65535).default(3000)),
    LOG_LEVEL: opcional(
      z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    ),
    DATABASE_PATH: opcional(z.string().default('data/dashboard.db')),
    SYNC_ENABLED: opcional(z.enum(['true', 'false']).default('true')).transform(
      (v) => v === 'true',
    ),
    SYNC_INTERVAL_MINUTES: opcional(z.coerce.number().int().min(1).max(1440).default(5)),
    JIRA_BASE_URL: opcional(z.url().optional()),
    JIRA_EMAIL: opcional(z.email().optional()),
    JIRA_API_TOKEN: opcional(z.string().optional()),
    JIRA_JQL: opcional(z.string().default('project in (PRJA, PRJB, PRJC, PRJD, PRJE)')),
    JIRA_FIELD_CREADA: opcional(idDeCampo.optional()),
    JIRA_FIELD_RESUELTA: opcional(idDeCampo.optional()),
    JIRA_FIELD_ID_ORIGEN: opcional(idDeCampo.optional()),
    JIRA_FIELD_TIPO_PROYECTO: opcional(idDeCampo.optional()),
    JIRA_FIELD_RESPONSABLE: opcional(idDeCampo.optional()),
    JIRA_FIELD_INFORMADOR: opcional(idDeCampo.optional()),
    JIRA_FIELD_RESPONSABLE_PROYECTO: opcional(idDeCampo.optional()),
  })
  .superRefine((env, ctx) => {
    if (!env.SYNC_ENABLED) return;
    for (const variable of OBLIGATORIAS_PARA_SYNC) {
      if (env[variable] === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [variable],
          message: 'obligatoria con el sync activado (SYNC_ENABLED=false para desactivarlo)',
        });
      }
    }
  });

export type Config = z.infer<typeof envSchema>;

export interface ConfigJira {
  baseUrl: string;
  email: string;
  token: string;
  jql: string;
  campos: Record<CampoPersonalizado, string>;
}

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

/** Datos de Jira para el sync. Solo se llama con el sync activado (ya validado). */
export function configJira(config: Config): ConfigJira {
  const requerir = (nombre: (typeof OBLIGATORIAS_PARA_SYNC)[number]): string => {
    const valor = config[nombre];
    if (valor === undefined) throw new ConfigError(`Falta ${nombre}`);
    return valor;
  };
  const baseUrl = requerir('JIRA_BASE_URL').replace(/\/+$/, '');
  const email = requerir('JIRA_EMAIL');
  const token = requerir('JIRA_API_TOKEN');
  const campos = Object.fromEntries(
    Object.entries(VARIABLES_DE_CAMPOS).map(([campo, variable]) => [campo, requerir(variable)]),
  ) as Record<CampoPersonalizado, string>;

  return { baseUrl, email, token, jql: config.JIRA_JQL, campos };
}
