import type { RespuestaDashboard, RespuestaError, RespuestaSync } from '@dashboard/shared';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import { estadoSync } from './api/estado-sync.js';
import { parsearFiltros } from './api/filtros.js';
import { Limitador } from './api/limitador.js';
import type { Repositorio } from './db/repositorio.js';
import { calcularDashboard } from './metricas/calcular.js';
import type { Sincronizador } from './sync/sincronizador.js';

export interface DependenciasApp {
  repositorio: Repositorio;
  logger: Logger;
  sync: {
    activo: boolean;
    intervaloMinutos: number;
    /** Se muestran los datos de la foto anonimizada (ADR-0014). */
    modoDemo?: boolean;
    /** Ausente si el sync está desactivado. */
    sincronizador?: Pick<Sincronizador, 'sincronizar'>;
  };
  /** Límite del botón "Sincronizar ahora" (por defecto, uno por minuto). */
  limitador?: Limitador;
  ahora?: () => Date;
}

const error = (res: Response, status: number, mensaje: string) => {
  res.status(status).json({ error: mensaje } satisfies RespuestaError);
};

export function createApp(deps: DependenciasApp): Express {
  const { repositorio, logger } = deps;
  const ahora = deps.ahora ?? (() => new Date());
  const limitador = deps.limitador ?? new Limitador(60_000);
  const sync = () => estadoSync(repositorio, deps.sync);

  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use((req, res, next) => {
    const inicio = performance.now();
    res.on('finish', () => {
      logger.info(
        {
          metodo: req.method,
          ruta: req.path,
          status: res.statusCode,
          ms: Math.round(performance.now() - inicio),
        },
        'Pedido',
      );
    });
    next();
  });
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/dashboard', (req, res) => {
    const filtros = parsearFiltros(req.query);
    if (!filtros.ok) {
      error(res, 400, filtros.error);
      return;
    }
    const dashboard = calcularDashboard(repositorio.listarTickets(), filtros.filtros, ahora());
    res.json({ ...dashboard, sync: sync() } satisfies RespuestaDashboard);
  });

  app.post('/api/sync', async (_req, res) => {
    const { sincronizador } = deps.sync;
    if (!deps.sync.activo || !sincronizador) {
      error(res, 409, 'El sync con Jira está desactivado');
      return;
    }
    const permiso = limitador.intentar();
    if (!permiso.permitido) {
      res.setHeader('Retry-After', String(permiso.esperarSegundos));
      error(
        res,
        429,
        `Se puede sincronizar a mano una vez por minuto; probá en ${String(permiso.esperarSegundos)} s`,
      );
      return;
    }
    const resultado = await sincronizador.sincronizar();
    if (resultado.estado === 'salteado') {
      error(res, 409, 'Ya hay un sync en curso');
    } else if (resultado.estado === 'error') {
      error(res, 502, `No se pudo sincronizar con Jira: ${resultado.error}`);
    } else {
      res.json({ tickets: resultado.tickets, sync: sync() } satisfies RespuestaSync);
    }
  });

  app.use('/api', (_req, res) => {
    error(res, 404, 'Ruta inexistente');
  });

  // Errores no controlados: el detalle va al log, nunca al cliente.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, 'Error no controlado');
    error(res, 500, 'Error interno');
  });

  return app;
}
