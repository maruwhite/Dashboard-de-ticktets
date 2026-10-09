import type { RespuestaDashboard } from '@dashboard/shared';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { dashboardDePrueba } from './fixtures';

interface Respuesta {
  status?: number;
  cuerpo: unknown;
  headers?: Record<string, string>;
}

/** API simulada: responde según método y ruta, y registra los pedidos. */
function simularApi(
  opciones: {
    dashboard?: (url: string) => Respuesta | Promise<Respuesta>;
    sync?: () => Respuesta;
  } = {},
) {
  const pedidos: string[] = [];
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET';
    pedidos.push(`${metodo} ${url}`);
    const r =
      metodo === 'POST'
        ? (opciones.sync?.() ?? { cuerpo: { tickets: 1234, sync: dashboardDePrueba().sync } })
        : await (opciones.dashboard?.(url) ?? { cuerpo: dashboardDePrueba() });
    return new Response(JSON.stringify(r.cuerpo), {
      status: r.status ?? 200,
      headers: r.headers ?? {},
    });
  });
  vi.stubGlobal('fetch', fetch);
  return { fetch, pedidos, dashboards: () => pedidos.filter((p) => p.startsWith('GET')) };
}

const tarjeta = (titulo: string) => {
  const encabezado = screen.getByRole('heading', { name: titulo });
  const contenedor = encabezado.closest('article');
  if (!contenedor) throw new Error(`No se encontró la tarjeta ${titulo}`);
  return within(contenedor);
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-09T15:00:00.000Z') });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('carga y KPIs', () => {
  it('muestra un esqueleto mientras carga y después los KPIs con formato argentino', async () => {
    let liberar: (r: Respuesta) => void = () => undefined;
    simularApi({ dashboard: () => new Promise((resolve) => (liberar = resolve)) });
    render(<App />);

    expect(screen.getByLabelText('Cargando el dashboard')).toBeInTheDocument();
    act(() => {
      liberar({ cuerpo: dashboardDePrueba() });
    });

    const total = await screen.findByRole('heading', { name: 'Total' });
    expect(total.nextElementSibling).toHaveTextContent('1.234');
    expect(screen.getByText('19,8 d')).toBeInTheDocument();
    expect(screen.getByText('promedio 71,6 d · sobre 132 tickets')).toBeInTheDocument();
    expect(screen.getByText('Requieren atención')).toBeInTheDocument(); // 5 estancados
    expect(screen.queryByText('Fuera de plazo')).not.toBeInTheDocument(); // 0 vencidos
    expect(screen.getByText('Mostrando 1.234 de 1.234 tickets')).toBeInTheDocument();
  });

  it('informa la antigüedad de los datos y el intervalo de sync', async () => {
    simularApi();
    render(<App />);
    expect(await screen.findByText('hace 3 min')).toHaveAttribute('title', '09/10/2026 11:57');
    expect(screen.getByText(/se sincroniza cada 5 min/)).toBeInTheDocument();
  });

  it('avisa si el último sync falló, mostrando la antigüedad de los datos', async () => {
    const base = dashboardDePrueba();
    simularApi({
      dashboard: () => ({
        cuerpo: dashboardDePrueba({
          sync: {
            ...base.sync,
            ultimoIntento: {
              fin: '2026-10-09T14:59:00.000Z',
              ok: false,
              error: 'Jira rechazó las credenciales (401)',
            },
          },
        }),
      }),
    });
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El último sync falló: Jira rechazó las credenciales (401). Se muestran los datos de hace 3 min.',
    );
  });
});

describe('gráficos', () => {
  it('usa torta con 2 a 6 categorías y barras en los demás casos', async () => {
    simularApi();
    render(<App />);
    await screen.findByRole('heading', { name: 'Por estado' });

    const tipo = (titulo: string) =>
      screen.getByRole('heading', { name: titulo }).closest('article')?.getAttribute('data-tipo');
    expect(tipo('Por estado')).toBe('barras'); // 7 categorías
    expect(tipo('Por proyecto')).toBe('torta'); // 2
    expect(tipo('Por prioridad')).toBe('barras'); // 1
  });

  it('en el gráfico por estado muestra el grupo de cada barra en texto', async () => {
    simularApi();
    render(<App />);
    await screen.findByRole('heading', { name: 'Por estado' });
    expect(
      tarjeta('Por estado').getByRole('button', { name: /Pausado · En espera/ }),
    ).toBeInTheDocument();
  });

  it('el color de cada entidad sale de las opciones totales, no del ranking', async () => {
    simularApi();
    render(<App />);
    await screen.findByRole('heading', { name: 'Por proyecto' });
    const muestra = (texto: string) =>
      tarjeta('Por proyecto')
        .getByRole('button', { name: new RegExp(texto) })
        .querySelector('.muestra');
    // PRJB tiene más tickets (aparece primero) pero conserva el segundo color.
    expect(muestra('PRJB')).toHaveStyle({ background: 'var(--serie-2)' });
    expect(muestra('PRJA')).toHaveStyle({ background: 'var(--serie-1)' });
  });

  it('"Ver tabla" muestra los mismos datos como tabla', async () => {
    const usuario = userEvent.setup();
    simularApi();
    render(<App />);
    await screen.findByRole('heading', { name: 'Por tipo de incidencia' });

    await usuario.click(
      tarjeta('Por tipo de incidencia').getByRole('button', { name: 'Ver tabla' }),
    );

    const tabla = tarjeta('Por tipo de incidencia').getByRole('table');
    expect(within(tabla).getByRole('rowheader', { name: 'Tarea' }).parentElement).toHaveTextContent(
      'Tarea1.00081 %',
    );
    await usuario.click(
      tarjeta('Por tipo de incidencia').getByRole('button', { name: 'Ver gráfico' }),
    );
    expect(tarjeta('Por tipo de incidencia').queryByRole('table')).not.toBeInTheDocument();
  });

  it('la tendencia tiene leyenda y vista de tabla por mes', async () => {
    const usuario = userEvent.setup();
    simularApi();
    render(<App />);
    const titulo = 'Tendencia: creados vs. resueltos por mes';
    await screen.findByRole('heading', { name: titulo });
    expect(tarjeta(titulo).getByRole('list', { name: 'Series' })).toHaveTextContent(
      'CreadosResueltos',
    );

    await usuario.click(tarjeta(titulo).getByRole('button', { name: 'Ver tabla' }));

    const filas = tarjeta(titulo).getAllByRole('row');
    expect(filas).toHaveLength(4);
    expect(filas[3]).toHaveTextContent(/mar 2026\s*37/);
  });
});

describe('filtros', () => {
  it('clic en una barra filtra, actualiza la URL y muestra un chip removible', async () => {
    const usuario = userEvent.setup();
    const api = simularApi();
    render(<App />);
    await screen.findByRole('heading', { name: 'Por estado' });

    await usuario.click(tarjeta('Por estado').getByRole('button', { name: /^Cerrado/ }));

    await waitFor(() => {
      expect(api.dashboards().at(-1)).toBe('GET /api/dashboard?estado=Cerrado');
    });
    expect(window.location.search).toBe('?estado=Cerrado');
    const chip = screen.getByRole('button', { name: 'Quitar filtro Estado: Cerrado' });
    expect(tarjeta('Por estado').getByRole('button', { name: /^Cerrado/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await usuario.click(chip);

    await waitFor(() => {
      expect(window.location.search).toBe('');
    });
    expect(api.dashboards().at(-1)).toBe('GET /api/dashboard');
  });

  it('clic en la leyenda de una torta filtra por ese valor', async () => {
    const usuario = userEvent.setup();
    simularApi();
    render(<App />);
    await screen.findByRole('heading', { name: 'Por responsable del proyecto' });

    await usuario.click(
      tarjeta('Por responsable del proyecto').getByRole('button', { name: /Usuario 3/ }),
    );

    expect(window.location.search).toBe('?responsableProyecto=Usuario+3');
    expect(
      screen.getByRole('button', { name: 'Quitar filtro Responsable del proyecto: Usuario 3' }),
    ).toBeInTheDocument();
  });

  it('los segmentadores y las fechas filtran; "Limpiar todo" quita todo', async () => {
    const usuario = userEvent.setup();
    const api = simularApi();
    render(<App />);
    await screen.findByRole('heading', { name: 'Total' });

    await usuario.click(screen.getByText('Proyecto', { selector: 'summary' }));
    await usuario.click(screen.getByRole('checkbox', { name: 'PRJA — Proyecto Alfa' }));
    await usuario.click(screen.getByRole('checkbox', { name: 'PRJB — Proyecto Beta' }));
    await usuario.click(screen.getByRole('checkbox', { name: 'PRJA — Proyecto Alfa' }));
    await usuario.type(screen.getByLabelText('Desde'), '2026-01-15');
    await usuario.type(screen.getByLabelText('Hasta'), '2026-03-31');

    await waitFor(() => {
      expect(window.location.search).toBe('?proyecto=PRJB&desde=2026-01-15&hasta=2026-03-31');
    });
    expect(api.dashboards().at(-1)).toBe(
      'GET /api/dashboard?proyecto=PRJB&desde=2026-01-15&hasta=2026-03-31',
    );
    expect(
      screen.getByRole('button', { name: 'Quitar filtro Desde: 15/01/2026' }),
    ).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Limpiar todo' }));

    expect(window.location.search).toBe('');
    expect(screen.queryByRole('list', { name: 'Filtros activos' })).not.toBeInTheDocument();
  });

  it('los selectores se cierran con Escape y al tocar afuera', async () => {
    const usuario = userEvent.setup();
    simularApi();
    render(<App />);
    await screen.findByRole('heading', { name: 'Total' });
    const resumen = screen.getByText('Proyecto', { selector: 'summary' });
    const selector = resumen.closest('details');

    await usuario.click(resumen);
    expect(selector).toHaveAttribute('open');
    await usuario.keyboard('{Escape}');
    expect(selector).not.toHaveAttribute('open');
    expect(resumen).toHaveFocus();

    await usuario.click(resumen);
    await usuario.click(screen.getByRole('heading', { name: 'Dashboard de tickets' }));
    expect(selector).not.toHaveAttribute('open');
  });

  it('respeta los filtros de la URL al abrir y al volver atrás en el historial', async () => {
    window.history.replaceState(null, '', '/?proyecto=PRJA');
    const api = simularApi();
    render(<App />);
    await screen.findByRole('heading', { name: 'Total' });
    expect(api.dashboards()[0]).toBe('GET /api/dashboard?proyecto=PRJA');

    act(() => {
      window.history.pushState(null, '', '/?estado=Pausado');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    await waitFor(() => {
      expect(api.dashboards().at(-1)).toBe('GET /api/dashboard?estado=Pausado');
    });
  });

  it('sin resultados ofrece limpiar los filtros', async () => {
    const usuario = userEvent.setup();
    window.history.replaceState(null, '', '/?estado=Inexistente');
    const vacio = dashboardDePrueba();
    simularApi({
      dashboard: (url) => ({
        cuerpo: url.includes('?') ? { ...vacio, kpis: { ...vacio.kpis, total: 0 } } : vacio,
      }),
    });
    render(<App />);

    expect(
      await screen.findByText('No hay tickets para los filtros elegidos.'),
    ).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    expect(await screen.findByRole('heading', { name: 'Total' })).toBeInTheDocument();
    expect(screen.queryByText('No hay tickets para los filtros elegidos.')).not.toBeInTheDocument();
  });
});

describe('errores', () => {
  it('si la primera carga falla, permite reintentar', async () => {
    const usuario = userEvent.setup();
    let falla = true;
    simularApi({
      dashboard: () =>
        falla
          ? { status: 500, cuerpo: { error: 'Error interno' } }
          : { cuerpo: dashboardDePrueba() },
    });
    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Error interno');
    falla = false;
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { name: 'Total' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('si falla una recarga, conserva los datos anteriores y lo avisa', async () => {
    const usuario = userEvent.setup();
    simularApi({
      dashboard: (url) =>
        url.includes('estado')
          ? { status: 400, cuerpo: { error: 'Filtro inválido' } }
          : { cuerpo: dashboardDePrueba() },
    });
    render(<App />);
    await screen.findByRole('heading', { name: 'Por estado' });

    await usuario.click(tarjeta('Por estado').getByRole('button', { name: /^Cerrado/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Filtro inválido Se muestran los últimos datos cargados.',
    );
    expect(screen.getByRole('heading', { name: 'Total' })).toBeInTheDocument();
  });
});

describe('sincronizar ahora', () => {
  it('sincroniza, informa el resultado y recarga el dashboard', async () => {
    const usuario = userEvent.setup();
    const api = simularApi();
    render(<App />);
    await screen.findByRole('heading', { name: 'Total' });
    const antes = api.dashboards().length;

    await usuario.click(screen.getByRole('button', { name: /Sincronizar ahora/ }));

    expect(await screen.findByText('Sincronizado: 1234 tickets')).toBeInTheDocument();
    expect(api.pedidos).toContain('POST /api/sync');
    await waitFor(() => {
      expect(api.dashboards().length).toBe(antes + 1);
    });
  });

  it('con 429 indica cuántos segundos esperar, y muestra otros errores', async () => {
    const usuario = userEvent.setup();
    let respuesta: Respuesta = {
      status: 429,
      cuerpo: { error: 'Una vez por minuto' },
      headers: { 'Retry-After': '42' },
    };
    simularApi({ sync: () => respuesta });
    render(<App />);
    await screen.findByRole('heading', { name: 'Total' });

    await usuario.click(screen.getByRole('button', { name: /Sincronizar ahora/ }));
    expect(await screen.findByText('Probá en 42 s')).toBeInTheDocument();

    respuesta = {
      status: 502,
      cuerpo: { error: 'No se pudo sincronizar con Jira: Jira respondió 503' },
    };
    await usuario.click(screen.getByRole('button', { name: /Sincronizar ahora/ }));
    expect(
      await screen.findByText('No se pudo sincronizar con Jira: Jira respondió 503'),
    ).toBeInTheDocument();
  });

  it('está deshabilitado si el sync está desactivado', async () => {
    const base = dashboardDePrueba();
    simularApi({
      dashboard: () => ({ cuerpo: dashboardDePrueba({ sync: { ...base.sync, activo: false } }) }),
    });
    render(<App />);
    await screen.findByRole('heading', { name: 'Total' });
    expect(screen.getByRole('button', { name: /Sincronizar ahora/ })).toBeDisabled();
    expect(screen.queryByText(/se sincroniza cada/)).not.toBeInTheDocument();
  });
});

describe('recarga automática y tema', () => {
  it('recarga el dashboard según el intervalo de sync', async () => {
    vi.useRealTimers();
    vi.useFakeTimers({
      toFake: ['setInterval', 'clearInterval', 'Date'],
      now: new Date('2026-10-09T15:00:00.000Z'),
    });
    const api = simularApi();
    render(<App />);
    await screen.findByRole('heading', { name: 'Total' });
    const antes = api.dashboards().length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000);
    });

    await waitFor(() => {
      expect(api.dashboards().length).toBe(antes + 1);
    });
  });

  it('alterna entre modo claro y oscuro y lo recuerda', async () => {
    const usuario = userEvent.setup();
    simularApi();
    render(<App />);

    await usuario.click(screen.getByRole('button', { name: 'Cambiar a modo oscuro' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('dashboard-tema')).toBe('oscuro');
    await usuario.click(screen.getByRole('button', { name: 'Cambiar a modo claro' }));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('respeta el tema guardado', () => {
    window.localStorage.setItem('dashboard-tema', 'oscuro');
    simularApi();
    render(<App />);
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});

export type { RespuestaDashboard };
