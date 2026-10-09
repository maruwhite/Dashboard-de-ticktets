import { describe, expect, it, vi } from 'vitest';
import { abrirBase } from '../db/base.js';
import { Repositorio } from '../db/repositorio.js';
import { ClienteJira, JiraError, type IssueJira } from '../jira/cliente.js';
import { createLogger } from '../logger.js';
import { ProgramadorDeSync } from './programador.js';
import { Sincronizador } from './sincronizador.js';

const campos = {
  creada: 'customfield_1',
  resuelta: 'customfield_2',
  idOrigen: 'customfield_3',
  tipoProyecto: 'customfield_4',
  responsable: 'customfield_5',
  informador: 'customfield_6',
  responsableProyecto: 'customfield_7',
};

const issue = (key: string, estado: string): IssueJira => ({
  key,
  fields: {
    summary: 'Título inventado',
    status: { name: estado },
    project: { key: key.split('-')[0], name: 'Proyecto' },
    customfield_1: '2025-01-10T09:00:00.000-0300',
    updated: '2025-01-11T09:00:00.000-0300',
  },
});

function preparar(buscar: (jql: string, campos: readonly string[]) => Promise<IssueJira[]>) {
  const lineas: string[] = [];
  const logger = createLogger('info', { write: (l: string) => lineas.push(l) });
  const repositorio = new Repositorio(abrirBase(':memory:'));
  const fechas = ['2026-10-09T12:00:00.000Z', '2026-10-09T12:00:02.000Z'];
  const sincronizador = new Sincronizador({
    cliente: { buscar: vi.fn(buscar), verificarCredenciales: vi.fn(() => Promise.resolve()) },
    repositorio,
    jira: { jql: 'project = PRJA', campos },
    logger,
    ahora: () => new Date(fechas.shift() ?? '2026-10-09T12:00:05.000Z'),
  });
  return { sincronizador, repositorio, lineas };
}

describe('Sincronizador', () => {
  it('trae los tickets de Jira, los guarda y registra el sync', async () => {
    const buscar = vi.fn(() =>
      Promise.resolve([issue('PRJA-1', 'En curso'), issue('PRJA-2', 'Finalizado')]),
    );
    const { sincronizador, repositorio } = preparar(buscar);

    expect(await sincronizador.sincronizar()).toEqual({ estado: 'ok', tickets: 2 });

    expect(repositorio.listarTickets().map((t) => [t.clave, t.estado])).toEqual([
      ['PRJA-1', 'En curso'],
      ['PRJA-2', 'Finalizado'],
    ]);
    expect(repositorio.ultimoSync()).toEqual({
      inicio: '2026-10-09T12:00:00.000Z',
      fin: '2026-10-09T12:00:02.000Z',
      ok: true,
      tickets: 2,
      error: null,
    });
    const [jql, pedidos] = buscar.mock.calls[0] as unknown as [string, string[]];
    expect(jql).toBe('project = PRJA');
    expect(pedidos).toEqual(
      expect.arrayContaining(['summary', 'status', 'customfield_1', 'customfield_7']),
    );
  });

  it('refleja un cambio de estado en el siguiente sync', async () => {
    let estado = 'En curso';
    const { sincronizador, repositorio } = preparar(() =>
      Promise.resolve([issue('PRJA-1', estado)]),
    );
    await sincronizador.sincronizar();
    estado = 'Finalizado';

    await sincronizador.sincronizar();

    expect(repositorio.listarTickets()[0]?.estado).toBe('Finalizado');
  });

  it('si Jira falla, conserva los datos anteriores y registra el error', async () => {
    let falla = false;
    const { sincronizador, repositorio, lineas } = preparar(() =>
      falla
        ? Promise.reject(new JiraError(401, '/rest/api/3/search/jql'))
        : Promise.resolve([issue('PRJA-1', 'En curso')]),
    );
    await sincronizador.sincronizar();
    falla = true;

    const resultado = await sincronizador.sincronizar();

    expect(resultado).toEqual({
      estado: 'error',
      error: 'Jira rechazó las credenciales (401) en /rest/api/3/search/jql',
    });
    expect(repositorio.listarTickets()).toHaveLength(1);
    expect(repositorio.ultimoSync()?.ok).toBe(false);
    expect(repositorio.ultimoSyncExitoso()?.tickets).toBe(1);
    expect(lineas.join('')).toContain('Sync fallido');
  });

  it('registra errores inesperados sin su detalle', async () => {
    const { sincronizador, repositorio } = preparar(() =>
      Promise.reject(new TypeError('dato sensible')),
    );
    const resultado = await sincronizador.sincronizar();
    expect(resultado).toEqual({
      estado: 'error',
      error: 'TypeError: error inesperado durante el sync',
    });
    expect(repositorio.ultimoSync()?.error).not.toContain('dato sensible');

    const otro = preparar(() => Promise.reject(new Error('x')));
    vi.spyOn(otro.repositorio, 'registrarSync').mockImplementation(() => {
      throw new Error('base no disponible');
    });
    expect(await otro.sincronizador.sincronizar()).toMatchObject({ estado: 'error' });

    // Un valor rechazado que no es instancia de Error.
    const raro = preparar(() => Promise.reject(Object.create(null) as Error));
    expect(await raro.sincronizador.sincronizar()).toEqual({
      estado: 'error',
      error: 'Error inesperado durante el sync',
    });
  });

  it('no reemplaza la base si Jira devuelve 0 tickets y había datos', async () => {
    let vacio = false;
    const { sincronizador, repositorio } = preparar(() =>
      Promise.resolve(vacio ? [] : [issue('PRJA-1', 'En curso')]),
    );
    await sincronizador.sincronizar();
    vacio = true;

    const resultado = await sincronizador.sincronizar();

    expect(resultado).toEqual({
      estado: 'error',
      error:
        'Jira devolvió 0 tickets y la base tenía 1; no se reemplazan (revisar credenciales, permisos o JIRA_JQL)',
    });
    expect(repositorio.listarTickets()).toHaveLength(1);
  });

  it('acepta 0 tickets si la base estaba vacía', async () => {
    const { sincronizador } = preparar(() => Promise.resolve([]));
    expect(await sincronizador.sincronizar()).toEqual({ estado: 'ok', tickets: 0 });
  });

  it('con credenciales inválidas (Jira responde 200 vacío a la búsqueda) conserva los datos', async () => {
    const lineas: string[] = [];
    const repositorio = new Repositorio(abrirBase(':memory:'));
    repositorio.reemplazarTickets([]);
    let tokenValido = true;
    // Como Jira Cloud real: /myself responde 401, pero la búsqueda responde 200 sin resultados.
    const fetch = vi.fn((url: string) => {
      if (url.endsWith('/myself')) {
        return Promise.resolve(new Response('{}', { status: tokenValido ? 200 : 401 }));
      }
      const issues = tokenValido ? [issue('PRJA-1', 'En curso')] : [];
      return Promise.resolve(new Response(JSON.stringify({ issues })));
    });
    const sincronizador = new Sincronizador({
      cliente: new ClienteJira(
        { baseUrl: 'https://sitio.atlassian.net', email: 'persona@example.com', token: 't' },
        { fetch: fetch as unknown as typeof globalThis.fetch },
      ),
      repositorio,
      jira: { jql: 'x', campos },
      logger: createLogger('info', { write: (l: string) => lineas.push(l) }),
    });
    await sincronizador.sincronizar();
    tokenValido = false;

    const resultado = await sincronizador.sincronizar();

    expect(resultado).toEqual({
      estado: 'error',
      error: 'Jira rechazó las credenciales (401) en /rest/api/3/myself',
    });
    expect(repositorio.listarTickets()).toHaveLength(1);
  });

  it('nunca corre dos syncs a la vez', async () => {
    let liberar: (issues: IssueJira[]) => void = () => undefined;
    const buscar = vi.fn(
      () =>
        new Promise<IssueJira[]>((resolve) => {
          liberar = resolve;
        }),
    );
    const { sincronizador, lineas } = preparar(buscar);

    const primero = sincronizador.sincronizar();
    expect(await sincronizador.sincronizar()).toEqual({ estado: 'salteado' });
    liberar([]);

    expect(await primero).toEqual({ estado: 'ok', tickets: 0 });
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(lineas.join('')).toContain('Sync salteado');
    await sincronizador.esperar();
  });

  it('no deja el token de Jira en logs ni en la base', async () => {
    const lineas: string[] = [];
    const repositorio = new Repositorio(abrirBase(':memory:'));
    const fetch = vi.fn(() => Promise.resolve(new Response('', { status: 403 })));
    const sincronizador = new Sincronizador({
      cliente: new ClienteJira(
        {
          baseUrl: 'https://sitio.atlassian.net',
          email: 'persona@example.com',
          token: 'token-super-secreto',
        },
        { fetch },
      ),
      repositorio,
      jira: { jql: 'x', campos },
      logger: createLogger('trace', { write: (l: string) => lineas.push(l) }),
    });

    await sincronizador.sincronizar();

    expect(lineas.join('')).not.toContain('token-super-secreto');
    expect(JSON.stringify(repositorio.ultimoSync())).not.toContain('token-super-secreto');
  });
});

describe('ProgramadorDeSync', () => {
  it('sincroniza al iniciar y en cada intervalo, y al detener espera el sync en curso', async () => {
    vi.useFakeTimers();
    try {
      const sincronizador = {
        sincronizar: vi.fn(() => Promise.resolve({ estado: 'ok' as const, tickets: 0 })),
        esperar: vi.fn(() => Promise.resolve()),
      };
      const programador = new ProgramadorDeSync(sincronizador, 5 * 60_000);

      programador.iniciar();
      programador.iniciar(); // idempotente
      expect(sincronizador.sincronizar).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(5 * 60_000);
      expect(sincronizador.sincronizar).toHaveBeenCalledTimes(2);

      await programador.detener();
      await vi.advanceTimersByTimeAsync(15 * 60_000);
      expect(sincronizador.sincronizar).toHaveBeenCalledTimes(2);
      expect(sincronizador.esperar).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
