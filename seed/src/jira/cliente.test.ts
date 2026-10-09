import { describe, expect, it, vi } from 'vitest';
import { ClienteJira, JiraError } from './cliente.js';
import { leerConfigJira } from './config.js';
import { aFechaJira, mismoNombre } from './definicion.js';

const config = {
  baseUrl: 'https://sitio.atlassian.net',
  email: 'persona@example.com',
  token: 'token-secreto',
};

function clienteCon(...respuestas: Response[]) {
  const fetch = vi.fn<typeof globalThis.fetch>();
  for (const r of respuestas) fetch.mockResolvedValueOnce(r);
  const esperar = vi.fn(() => Promise.resolve());
  return { cliente: new ClienteJira(config, { fetch, esperar, maxReintentos: 2 }), fetch, esperar };
}

describe('ClienteJira', () => {
  it('autentica con Basic y parsea JSON', async () => {
    const { cliente, fetch } = clienteCon(new Response('{"ok":true}'));

    expect(await cliente.get('/rest/api/3/myself')).toEqual({ ok: true });

    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('https://sitio.atlassian.net/rest/api/3/myself');
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from('persona@example.com:token-secreto').toString('base64')}`,
    );
    expect(headers).not.toHaveProperty('Content-Type');
  });

  it('envía cuerpo JSON en POST y PUT, y acepta respuestas vacías', async () => {
    const { cliente, fetch } = clienteCon(new Response(null, { status: 204 }), new Response(''));

    expect(await cliente.post('/a', { x: 1 })).toBeUndefined();
    expect(await cliente.put('/b', { y: 2 })).toBeUndefined();

    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', body: '{"x":1}' });
    expect(fetch.mock.calls[1]?.[1]).toMatchObject({ method: 'PUT', body: '{"y":2}' });
  });

  it('resume los errores de Jira sin incluir credenciales', async () => {
    const { cliente } = clienteCon(
      new Response(
        JSON.stringify({ errorMessages: ['No existe'], errors: { summary: 'requerido' } }),
        { status: 400 },
      ),
    );

    const error = await cliente.get('/x').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(JiraError);
    expect((error as JiraError).status).toBe(400);
    expect((error as Error).message).toBe(
      'Jira respondió 400 en /x: No existe; summary: requerido',
    );
    expect((error as Error).message).not.toContain('token-secreto');
  });

  it('tolera cuerpos de error que no son JSON', async () => {
    const { cliente } = clienteCon(new Response('<html>', { status: 401 }));
    await expect(cliente.get('/x')).rejects.toThrow(/^Jira respondió 401 en \/x$/);
  });

  it('reintenta ante 429 respetando Retry-After y ante 5xx con backoff', async () => {
    const { cliente, esperar } = clienteCon(
      new Response('', { status: 429, headers: { 'Retry-After': '3' } }),
      new Response('', { status: 503 }),
      new Response('{"ok":1}'),
    );

    expect(await cliente.get('/x')).toEqual({ ok: 1 });
    expect(esperar.mock.calls).toEqual([[3000], [2000]]);
  });

  it('se rinde después del máximo de reintentos', async () => {
    const { cliente, fetch } = clienteCon(
      new Response('', { status: 500 }),
      new Response('', { status: 500 }),
      new Response('', { status: 500 }),
    );
    await expect(cliente.get('/x')).rejects.toThrow('Jira respondió 500');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('usa fetch y espera reales por defecto', () => {
    expect(new ClienteJira(config)).toBeInstanceOf(ClienteJira);
  });
});

describe('leerConfigJira', () => {
  const env = {
    JIRA_BASE_URL: 'https://sitio.atlassian.net/',
    JIRA_EMAIL: ' persona@example.com ',
    JIRA_API_TOKEN: 'x',
  };

  it('lee y normaliza las variables', () => {
    expect(leerConfigJira(env)).toEqual({
      baseUrl: 'https://sitio.atlassian.net',
      email: 'persona@example.com',
      token: 'x',
    });
  });

  it('nombra la variable faltante sin mostrar valores', () => {
    expect(() => leerConfigJira({ ...env, JIRA_API_TOKEN: ' ' })).toThrow(
      'Falta la variable JIRA_API_TOKEN',
    );
  });

  it('rechaza URLs que no son la raíz del sitio', () => {
    expect(() =>
      leerConfigJira({ ...env, JIRA_BASE_URL: 'https://sitio.atlassian.net/jira/software' }),
    ).toThrow('JIRA_BASE_URL debe ser la URL del sitio');
  });
});

describe('definicion', () => {
  it('convierte fechas al formato de Jira con la zona de Argentina', () => {
    expect(aFechaJira('2022-07-02 10:21')).toBe('2022-07-02T10:21:00.000-0300');
    expect(() => aFechaJira('02/07/2022')).toThrow('Fecha con formato inesperado');
  });

  it('compara nombres sin distinguir mayúsculas ni espacios', () => {
    expect(mismoNombre(' En Curso', 'en curso ')).toBe(true);
    expect(mismoNombre('Cerrado', 'Finalizado')).toBe(false);
  });
});
