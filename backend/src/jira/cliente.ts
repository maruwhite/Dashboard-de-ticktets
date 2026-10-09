export interface CredencialesJira {
  baseUrl: string;
  email: string;
  token: string;
}

export interface OpcionesCliente {
  fetch?: typeof fetch;
  esperar?: (ms: number) => Promise<void>;
  maxReintentos?: number;
}

export interface IssueJira {
  key: string;
  fields: Record<string, unknown>;
}

interface PaginaDeBusqueda {
  issues: IssueJira[];
  nextPageToken?: string;
}

/** Error de la API de Jira: solo status y ruta, nunca cabeceras, credenciales ni datos. */
export class JiraError extends Error {
  override name = 'JiraError';

  constructor(
    readonly status: number,
    readonly ruta: string,
  ) {
    super(
      status === 401 || status === 403
        ? `Jira rechazó las credenciales (${String(status)}) en ${ruta}`
        : `Jira respondió ${String(status)} en ${ruta}`,
    );
  }
}

const esperarMs = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** Cliente mínimo de solo lectura para el sync. */
export class ClienteJira {
  private readonly autorizacion: string;
  private readonly fetch: typeof fetch;
  private readonly esperar: (ms: number) => Promise<void>;
  private readonly maxReintentos: number;

  constructor(
    private readonly credenciales: CredencialesJira,
    opciones: OpcionesCliente = {},
  ) {
    this.autorizacion = `Basic ${Buffer.from(`${credenciales.email}:${credenciales.token}`).toString('base64')}`;
    this.fetch = opciones.fetch ?? globalThis.fetch;
    this.esperar = opciones.esperar ?? esperarMs;
    this.maxReintentos = opciones.maxReintentos ?? 4;
  }

  /**
   * Confirma que las credenciales son válidas. Hace falta porque, con credenciales inválidas,
   * la búsqueda de Jira Cloud no responde 401: responde 200 sin resultados (como anónimo).
   */
  async verificarCredenciales(): Promise<void> {
    await this.request('GET', '/rest/api/3/myself');
  }

  /**
   * Trae todos los issues del JQL con `POST /rest/api/3/search/jql`, paginando con
   * `nextPageToken`. Pide solo los campos indicados.
   */
  async buscar(jql: string, campos: readonly string[]): Promise<IssueJira[]> {
    const issues: IssueJira[] = [];
    let nextPageToken: string | undefined;
    do {
      const pagina = await this.request<PaginaDeBusqueda>('POST', '/rest/api/3/search/jql', {
        jql,
        fields: campos,
        maxResults: 100,
        ...(nextPageToken ? { nextPageToken } : {}),
      });
      issues.push(...pagina.issues);
      nextPageToken = pagina.nextPageToken;
    } while (nextPageToken);
    return issues;
  }

  /** Reintenta ante 429 (respetando Retry-After) y 5xx; no reintenta errores de credenciales. */
  private async request<T>(metodo: 'GET' | 'POST', ruta: string, cuerpo?: unknown): Promise<T> {
    for (let intento = 0; ; intento++) {
      const respuesta = await this.fetch(`${this.credenciales.baseUrl}${ruta}`, {
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
      if (!respuesta.ok) throw new JiraError(respuesta.status, ruta);
      return (await respuesta.json()) as T;
    }
  }
}
