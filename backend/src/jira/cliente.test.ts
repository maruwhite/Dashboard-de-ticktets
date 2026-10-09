import { describe, expect, it, vi } from 'vitest';
import { ClienteJira, JiraError } from './cliente.js';

const credenciales = {
  baseUrl: 'https://sitio.atlassian.net',
  email: 'persona@example.com',
  token: 'token-secreto',
};

function clienteCon(...respuestas: Response[]) {
  const fetch = vi.fn<typeof globalThis.fetch>();
  for (const r of respuestas) fetch.mockResolvedValueOnce(r);
  const esperar = vi.fn(() => Promise.resolve());
  return {
    cliente: new ClienteJira(credenciales, { fetch, esperar, maxReintentos: 2 }),
    fetch,
    esperar,
  };
}

const pagina = (issues: { key: string }[], nextPageToken?: string) =>
  new Response(
    JSON.stringify({
      issues: issues.map((i) => ({ ...i, fields: {} })),
      ...(nextPageToken ? { nextPageToken } : {}),
    }),
  );

describe('ClienteJira.buscar', () => {
  it('pagina con nextPageToken y pide solo los campos indicados', async () => {
    const { cliente, fetch } = clienteCon(
      pagina([{ key: 'A-1' }], 'tok'),
      pagina([{ key: 'A-2' }]),
    );

    const issues = await cliente.buscar('project = A', ['summary', 'status']);

    expect(issues.map((i) => i.key)).toEqual(['A-1', 'A-2']);
    const cuerpos = fetch.mock.calls.map(([, init]) => JSON.parse(init?.body as string) as unknown);
    expect(cuerpos).toEqual([
      { jql: 'project = A', fields: ['summary', 'status'], maxResults: 100 },
      { jql: 'project = A', fields: ['summary', 'status'], maxResults: 100, nextPageToken: 'tok' },
    ]);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('https://sitio.atlassian.net/rest/api/3/search/jql');
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from('persona@example.com:token-secreto').toString('base64')}`,
    );
  });

  it('reintenta ante 429 (Retry-After) y 5xx con backoff', async () => {
    const { cliente, esperar } = clienteCon(
      new Response('', { status: 429, headers: { 'Retry-After': '2' } }),
      new Response('', { status: 502 }),
      pagina([]),
    );
    expect(await cliente.buscar('x', [])).toEqual([]);
    expect(esperar.mock.calls).toEqual([[2000], [2000]]);
  });

  it('se rinde después del máximo de reintentos', async () => {
    const { cliente, fetch } = clienteCon(
      new Response('', { status: 503 }),
      new Response('', { status: 503 }),
      new Response('', { status: 503 }),
    );
    await expect(cliente.buscar('x', [])).rejects.toThrow(
      'Jira respondió 503 en /rest/api/3/search/jql',
    );
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('no reintenta errores de credenciales y no expone el token', async () => {
    const { cliente, fetch } = clienteCon(new Response('{"errorMessages":["x"]}', { status: 401 }));

    const error = await cliente.buscar('x', []).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(JiraError);
    expect((error as Error).message).toBe(
      'Jira rechazó las credenciales (401) en /rest/api/3/search/jql',
    );
    expect((error as Error).message).not.toContain('token-secreto');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('verificarCredenciales consulta /myself con GET y falla con 401', async () => {
    const { cliente, fetch } = clienteCon(new Response('{}'), new Response('', { status: 401 }));

    await cliente.verificarCredenciales();
    await expect(cliente.verificarCredenciales()).rejects.toThrow(
      'Jira rechazó las credenciales (401) en /rest/api/3/myself',
    );

    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('https://sitio.atlassian.net/rest/api/3/myself');
    expect(init?.method).toBe('GET');
    expect(init).not.toHaveProperty('body');
  });

  it('usa fetch y espera reales por defecto', () => {
    expect(new ClienteJira(credenciales)).toBeInstanceOf(ClienteJira);
  });
});
