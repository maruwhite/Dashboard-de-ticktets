import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorApi, obtenerDashboard, sincronizarAhora } from './api';
import { COLOR_SIN_SERIE, colorDeEntidad } from './colores';
import {
  alternarValor,
  chipsDeFiltros,
  conFecha,
  conValores,
  filtrosAUrl,
  filtrosDesdeUrl,
  hayFiltros,
} from './filtros-url';
import {
  formatearDecimal,
  formatearFechaHora,
  formatearMes,
  formatearNumero,
  formatearPorcentaje,
  haceCuanto,
} from './formato';

describe('filtros en la URL', () => {
  it('lee y escribe los mismos parámetros que la API, con claves repetidas', () => {
    const filtros = filtrosDesdeUrl('?proyecto=PRJA&proyecto=PRJB&estado=&desde=2025-01-01&otro=x');
    expect(filtros).toEqual({ proyecto: ['PRJA', 'PRJB'], estado: [''], desde: '2025-01-01' });
    expect(filtrosAUrl(filtros)).toBe('?proyecto=PRJA&proyecto=PRJB&estado=&desde=2025-01-01');
    expect(filtrosAUrl({})).toBe('');
    expect(filtrosDesdeUrl('?hasta=2025-12-31')).toEqual({ hasta: '2025-12-31' });
  });

  it('alterna valores, reemplaza dimensiones y fechas', () => {
    const conA = alternarValor({}, 'proyecto', 'PRJA');
    expect(conA).toEqual({ proyecto: ['PRJA'] });
    expect(alternarValor(conA, 'proyecto', 'PRJB')).toEqual({ proyecto: ['PRJA', 'PRJB'] });
    expect(alternarValor(conA, 'proyecto', 'PRJA')).toEqual({});
    expect(conValores(conA, 'proyecto', [])).toEqual({});
    expect(conFecha({}, 'desde', '2025-01-01')).toEqual({ desde: '2025-01-01' });
    expect(conFecha({ desde: '2025-01-01' }, 'desde', '')).toEqual({});
    expect(hayFiltros({})).toBe(false);
    expect(hayFiltros(conA)).toBe(true);
  });

  it('arma chips con la etiqueta de las opciones y cada uno quita su filtro', () => {
    const filtros = {
      proyecto: ['PRJA'],
      responsable: [''],
      estado: ['Raro'],
      desde: '2025-03-01',
      hasta: '2025-03-31',
    };
    const chips = chipsDeFiltros(filtros, {
      proyecto: [{ valor: 'PRJA', etiqueta: 'PRJA — Proyecto Alfa' }],
    });

    expect(chips.map((c) => c.texto)).toEqual([
      'Proyecto: PRJA — Proyecto Alfa',
      'Estado: Raro',
      'Responsable: (sin dato)',
      'Desde: 01/03/2025',
      'Hasta: 31/03/2025',
    ]);
    expect(chips[0]?.quitar(filtros)).not.toHaveProperty('proyecto');
    expect(chips[3]?.quitar(filtros)).not.toHaveProperty('desde');
  });
});

describe('formato argentino', () => {
  it('números, decimales y porcentajes', () => {
    expect(formatearNumero(1234)).toBe('1.234');
    expect(formatearDecimal(19.8)).toBe('19,8');
    expect(formatearPorcentaje(1, 3)).toBe('33,3 %');
    expect(formatearPorcentaje(0, 0)).toBe('0 %');
  });

  it('fechas en hora de Argentina y meses', () => {
    expect(formatearFechaHora('2026-10-09T19:45:00.000Z')).toBe('09/10/2026 16:45');
    expect(formatearMes('2026-03')).toMatch(/^mar 2026$/);
  });

  it('antigüedad relativa', () => {
    const ahora = new Date('2026-10-09T15:00:00.000Z');
    const hace = (min: number) => new Date(ahora.getTime() - min * 60_000).toISOString();
    expect(haceCuanto(hace(0), ahora)).toBe('hace instantes');
    expect(haceCuanto(hace(3), ahora)).toBe('hace 3 min');
    expect(haceCuanto(hace(125), ahora)).toBe('hace 2 h');
    expect(haceCuanto(hace(60 * 24), ahora)).toBe('hace 1 día');
    expect(haceCuanto(hace(60 * 24 * 4), ahora)).toBe('hace 4 días');
  });
});

describe('colores', () => {
  const opciones = Array.from({ length: 10 }, (_, i) => ({
    valor: `V${String(i)}`,
    etiqueta: `V${String(i)}`,
  }));

  it('asigna el color por la posición en las opciones totales, sin ciclar', () => {
    expect(colorDeEntidad('V0', opciones)).toBe('var(--serie-1)');
    expect(colorDeEntidad('V7', opciones)).toBe('var(--serie-8)');
    expect(colorDeEntidad('V8', opciones)).toBe(COLOR_SIN_SERIE);
    expect(colorDeEntidad('no existe', opciones)).toBe(COLOR_SIN_SERIE);
  });
});

describe('api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pide el dashboard con los filtros en la query string', async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response('{"ok":true}')));
    vi.stubGlobal('fetch', fetch);

    expect(await obtenerDashboard({ proyecto: ['PRJA'] })).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith('/api/dashboard?proyecto=PRJA', undefined);
  });

  it('convierte errores de la API en ErrorApi con mensaje y Retry-After', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response('{"error":"Probá más tarde"}', {
            status: 429,
            headers: { 'Retry-After': '15' },
          }),
        ),
      ),
    );
    const error = (await sincronizarAhora().catch((e: unknown) => e)) as ErrorApi;
    expect(error).toBeInstanceOf(ErrorApi);
    expect(error).toMatchObject({ status: 429, message: 'Probá más tarde', reintentarEn: 15 });
  });

  it('usa un mensaje genérico si la respuesta no es JSON, y avisa si no hay conexión', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('<html>', { status: 502 }))),
    );
    await expect(obtenerDashboard({})).rejects.toMatchObject({ message: 'Error 502' });

    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('failed to fetch'))),
    );
    await expect(obtenerDashboard({})).rejects.toMatchObject({
      status: 0,
      message: 'No se pudo conectar con el servidor',
    });
  });

  it('deja pasar la cancelación de pedidos', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new DOMException('cancelado', 'AbortError'))),
    );
    await expect(obtenerDashboard({}, new AbortController().signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
