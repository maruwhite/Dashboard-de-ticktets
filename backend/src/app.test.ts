import type { RespuestaDashboard, Ticket } from '@dashboard/shared';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { Limitador } from './api/limitador.js';
import { createApp, type DependenciasApp } from './app.js';
import { abrirBase } from './db/base.js';
import { Repositorio } from './db/repositorio.js';
import { createLogger } from './logger.js';
import { calcularDashboard } from './metricas/calcular.js';
import type { ResultadoSync } from './sync/sincronizador.js';

const AHORA = new Date('2026-10-09T15:00:00.000Z');

let secuencia = 0;
function ticket(cambios: Partial<Ticket> = {}): Ticket {
  secuencia++;
  return {
    clave: `PRJA-${String(secuencia)}`,
    idOrigen: `T-${String(secuencia)}`,
    tipo: 'Tarea',
    estado: 'En curso',
    prioridad: 'Media',
    proyectoClave: 'PRJA',
    proyectoNombre: 'Proyecto Alfa',
    tipoProyecto: 'software',
    responsable: 'Agente 1',
    informador: 'Usuario 1',
    responsableProyecto: 'Usuario 2',
    titulo: 'Título inventado',
    creada: '2026-01-10T12:00:00.000Z',
    resuelta: null,
    actualizada: '2026-10-09T12:00:00.000Z',
    vencimiento: null,
    ...cambios,
  };
}

const TICKETS = [
  ticket({ proyectoClave: 'PRJA', estado: 'En curso', creada: '2025-03-10T12:00:00.000Z' }),
  ticket({ proyectoClave: 'PRJB', estado: 'Cerrado', creada: '2025-06-10T12:00:00.000Z' }),
  ticket({ proyectoClave: 'PRJC', estado: 'Pausado', responsable: '' }),
];

function construir(
  cambios: Partial<DependenciasApp> = {},
  sincronizar?: () => Promise<ResultadoSync>,
) {
  const repositorio = new Repositorio(abrirBase(':memory:'));
  repositorio.reemplazarTickets(TICKETS);
  const lineas: string[] = [];
  const deps: DependenciasApp = {
    repositorio,
    logger: createLogger('info', { write: (l: string) => lineas.push(l) }),
    sync: {
      activo: true,
      intervaloMinutos: 5,
      ...(sincronizar ? { sincronizador: { sincronizar: vi.fn(sincronizar) } } : {}),
    },
    ahora: () => AHORA,
    ...cambios,
  };
  return { app: createApp(deps), repositorio, lineas };
}

describe('GET /api/dashboard', () => {
  it('sin filtros devuelve el dashboard completo y el estado del sync', async () => {
    const { app, repositorio } = construir();
    repositorio.registrarSync({
      inicio: 'a',
      fin: '2026-10-09T14:55:00.000Z',
      ok: true,
      tickets: 3,
      error: null,
    });
    repositorio.registrarSync({
      inicio: 'b',
      fin: '2026-10-09T15:00:00.000Z',
      ok: false,
      tickets: null,
      error: 'Jira respondió 503',
    });

    const respuesta = await request(app).get('/api/dashboard');
    const cuerpo = respuesta.body as RespuestaDashboard;

    expect(respuesta.status).toBe(200);
    expect(cuerpo).toMatchObject(calcularDashboard(TICKETS, {}, AHORA));
    expect(cuerpo.sync).toEqual({
      activo: true,
      modoDemo: false,
      intervaloMinutos: 5,
      ultimoIntento: { fin: '2026-10-09T15:00:00.000Z', ok: false, error: 'Jira respondió 503' },
      ultimoExitoso: { fin: '2026-10-09T14:55:00.000Z', tickets: 3 },
    });
    expect(respuesta.headers['cache-control']).toBe('no-store');
  });

  it('sin syncs registrados informa null', async () => {
    const { app } = construir();
    const cuerpo = (await request(app).get('/api/dashboard')).body as RespuestaDashboard;
    expect(cuerpo.sync.ultimoIntento).toBeNull();
    expect(cuerpo.sync.ultimoExitoso).toBeNull();
  });

  it('aplica filtros con claves repetidas, igual que calcularDashboard', async () => {
    const { app } = construir();

    const respuesta = await request(app).get(
      '/api/dashboard?proyecto=PRJA&proyecto=PRJB&desde=2025-01-01&hasta=2025-12-31',
    );

    const esperado = calcularDashboard(
      TICKETS,
      { proyecto: ['PRJA', 'PRJB'], desde: '2025-01-01', hasta: '2025-12-31' },
      AHORA,
    );
    expect((respuesta.body as RespuestaDashboard).kpis).toEqual(esperado.kpis);
    expect((respuesta.body as RespuestaDashboard).kpis.total).toBe(2);
  });

  it('un valor vacío filtra por "(sin dato)"', async () => {
    const { app } = construir();
    const cuerpo = (await request(app).get('/api/dashboard?responsable='))
      .body as RespuestaDashboard;
    expect(cuerpo.kpis.total).toBe(1);
  });

  it.each([
    ['?color=rojo', 'Filtro inválido: color (parámetro desconocido)'],
    ['?desde=2025-13-01', 'Filtro inválido: desde (no es una fecha válida)'],
    ['?hasta=01/02/2025', 'Filtro inválido: hasta (debe tener el formato AAAA-MM-DD)'],
    [
      '?desde=2025-05-01&hasta=2025-04-01',
      'Filtro inválido: desde ("desde" no puede ser posterior a "hasta")',
    ],
    [
      `?estado=${'x'.repeat(201)}`,
      'Filtro inválido: estado (cada valor admite hasta 200 caracteres)',
    ],
    [
      `?estado=${Array.from({ length: 101 }, () => 'a').join('&estado=')}`,
      'Filtro inválido: estado (admite hasta 100 valores)',
    ],
  ])('rechaza %s con 400', async (query, mensaje) => {
    const { app } = construir();
    const respuesta = await request(app).get(`/api/dashboard${query}`);
    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toEqual({ error: mensaje });
  });
});

describe('POST /api/sync', () => {
  it('sincroniza y devuelve la cantidad de tickets y el estado del sync', async () => {
    const { app, repositorio } = construir({}, () => {
      repositorio.registrarSync({
        inicio: 'a',
        fin: '2026-10-09T15:00:01.000Z',
        ok: true,
        tickets: 3,
        error: null,
      });
      return Promise.resolve({ estado: 'ok', tickets: 3 });
    });

    const respuesta = await request(app).post('/api/sync');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ tickets: 3, sync: { ultimoExitoso: { tickets: 3 } } });
  });

  it('responde 502 si Jira falla', async () => {
    const { app } = construir({}, () =>
      Promise.resolve({ estado: 'error', error: 'Jira respondió 503' }),
    );
    const respuesta = await request(app).post('/api/sync');
    expect(respuesta.status).toBe(502);
    expect(respuesta.body).toEqual({
      error: 'No se pudo sincronizar con Jira: Jira respondió 503',
    });
  });

  it('responde 409 si ya hay un sync en curso', async () => {
    const { app } = construir({}, () => Promise.resolve({ estado: 'salteado' }));
    const respuesta = await request(app).post('/api/sync');
    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toEqual({ error: 'Ya hay un sync en curso' });
  });

  it('responde 409 si el sync está desactivado', async () => {
    const { app } = construir({ sync: { activo: false, intervaloMinutos: 5 } });
    const respuesta = await request(app).post('/api/sync');
    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toEqual({ error: 'El sync con Jira está desactivado' });
  });

  it('permite como máximo un sync manual por minuto (429 con Retry-After)', async () => {
    let ms = 0;
    const { app } = construir({ limitador: new Limitador(60_000, () => ms) }, () =>
      Promise.resolve({ estado: 'ok', tickets: 3 }),
    );

    expect((await request(app).post('/api/sync')).status).toBe(200);
    ms = 45_500;
    const segunda = await request(app).post('/api/sync');
    ms = 60_000;
    const tercera = await request(app).post('/api/sync');

    expect(segunda.status).toBe(429);
    expect(segunda.headers['retry-after']).toBe('15');
    expect(segunda.body).toEqual({
      error: 'Se puede sincronizar a mano una vez por minuto; probá en 15 s',
    });
    expect(tercera.status).toBe(200);
  });
});

describe('transversal', () => {
  it('GET /api/health responde ok', async () => {
    const { app } = construir();
    const respuesta = await request(app).get('/api/health');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ status: 'ok' });
  });

  it('agrega cabeceras de seguridad y no expone la tecnología', async () => {
    const { app } = construir();
    const respuesta = await request(app).get('/api/health');
    expect(respuesta.headers['x-powered-by']).toBeUndefined();
    expect(respuesta.headers['x-content-type-options']).toBe('nosniff');
    expect(respuesta.headers['content-security-policy']).toBeDefined();
  });

  it('responde 404 en JSON para rutas /api inexistentes', async () => {
    const { app } = construir();
    const respuesta = await request(app).get('/api/no-existe');
    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toEqual({ error: 'Ruta inexistente' });
  });

  it('ante un error inesperado responde 500 genérico y lo registra en el log', async () => {
    const { app, repositorio, lineas } = construir();
    vi.spyOn(repositorio, 'listarTickets').mockImplementation(() => {
      throw new Error('detalle interno /ruta/secreta');
    });

    const respuesta = await request(app).get('/api/dashboard');

    expect(respuesta.status).toBe(500);
    expect(respuesta.body).toEqual({ error: 'Error interno' });
    expect(JSON.stringify(respuesta.body)).not.toContain('secreta');
    expect(lineas.join('')).toContain('Error no controlado');
  });

  it('registra cada pedido con método, ruta y status', async () => {
    const { app, lineas } = construir();
    await request(app).get('/api/health');
    const registro = JSON.parse(lineas.find((l) => l.includes('"Pedido"')) ?? '{}') as Record<
      string,
      unknown
    >;
    expect(registro).toMatchObject({ metodo: 'GET', ruta: '/api/health', status: 200 });
  });
});
