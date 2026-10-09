import type { ConfigJira } from './config.js';

export type Metodo = 'GET' | 'POST' | 'PUT';

export interface OpcionesCliente {
  fetch?: typeof fetch;
  esperar?: (ms: number) => Promise<void>;
  maxReintentos?: number;
}

/** Error de la API de Jira. Nunca incluye cabeceras ni credenciales. */
export class JiraError extends Error {
  override name = 'JiraError';

  constructor(
    readonly status: number,
    readonly ruta: string,
    detalle: string,
    /** Cuerpo de la respuesta ya parseado (si era JSON), para errores con estructura propia. */
    readonly cuerpo?: unknown,
  ) {
    super(`Jira respondió ${String(status)} en ${ruta}${detalle ? `: ${detalle}` : ''}`);
  }
}

interface CuerpoDeError {
  errorMessages?: unknown;
  errors?: unknown;
}

/** Junta los mensajes de error de Jira; ignora lo que no sea texto. */
export function resumirMensajes(cuerpo: CuerpoDeError | undefined): string {
  const mensajes = Array.isArray(cuerpo?.errorMessages)
    ? cuerpo.errorMessages.filter((m): m is string => typeof m === 'string')
    : [];
  const errores =
    cuerpo?.errors !== null && typeof cuerpo?.errors === 'object' && !Array.isArray(cuerpo.errors)
      ? Object.entries(cuerpo.errors as Record<string, unknown>)
          .filter((entrada): entrada is [string, string] => typeof entrada[1] === 'string')
          .map(([campo, mensaje]) => `${campo}: ${mensaje}`)
      : [];
  return [...mensajes, ...errores].join('; ').slice(0, 500);
}

function parsear(texto: string): unknown {
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return undefined;
  }
}

const esperarMs = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export class ClienteJira {
  private readonly autorizacion: string;
  private readonly fetch: typeof fetch;
  private readonly esperar: (ms: number) => Promise<void>;
  private readonly maxReintentos: number;

  constructor(
    private readonly config: ConfigJira,
    opciones: OpcionesCliente = {},
  ) {
    this.autorizacion = `Basic ${Buffer.from(`${config.email}:${config.token}`).toString('base64')}`;
    this.fetch = opciones.fetch ?? globalThis.fetch;
    this.esperar = opciones.esperar ?? esperarMs;
    this.maxReintentos = opciones.maxReintentos ?? 4;
  }

  get<T>(ruta: string): Promise<T> {
    return this.request<T>('GET', ruta);
  }

  post<T>(ruta: string, cuerpo: unknown): Promise<T> {
    return this.request<T>('POST', ruta, cuerpo);
  }

  put<T>(ruta: string, cuerpo: unknown): Promise<T> {
    return this.request<T>('PUT', ruta, cuerpo);
  }

  /** Reintenta ante 429 (respetando Retry-After) y errores 5xx, con backoff exponencial. */
  async request<T>(metodo: Metodo, ruta: string, cuerpo?: unknown): Promise<T> {
    for (let intento = 0; ; intento++) {
      const respuesta = await this.fetch(`${this.config.baseUrl}${ruta}`, {
        method: metodo,
        headers: {
          Authorization: this.autorizacion,
          Accept: 'application/json',
          ...(cuerpo === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
      });

      const reintentable = respuesta.status === 429 || respuesta.status >= 500;
      if (reintentable && intento < this.maxReintentos) {
        const retryAfter = Number(respuesta.headers.get('retry-after'));
        await this.esperar(retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** intento);
        continue;
      }

      const texto = await respuesta.text();
      if (!respuesta.ok) {
        const cuerpoError = parsear(texto);
        throw new JiraError(
          respuesta.status,
          ruta,
          resumirMensajes(cuerpoError as CuerpoDeError | undefined),
          cuerpoError,
        );
      }
      return (texto === '' ? undefined : JSON.parse(texto)) as T;
    }
  }
}
