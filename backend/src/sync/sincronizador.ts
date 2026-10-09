import type { Logger } from 'pino';
import type { ConfigJira } from '../config.js';
import type { Repositorio } from '../db/repositorio.js';
import { JiraError, type ClienteJira } from '../jira/cliente.js';
import { aTicket, CAMPOS_NATIVOS } from '../jira/mapeo.js';

export type ResultadoSync =
  { estado: 'ok'; tickets: number } | { estado: 'error'; error: string } | { estado: 'salteado' };

export interface DependenciasSync {
  cliente: Pick<ClienteJira, 'buscar' | 'verificarCredenciales'>;
  repositorio: Repositorio;
  jira: Pick<ConfigJira, 'jql' | 'campos'>;
  logger: Logger;
  ahora?: () => Date;
}

/** Sync que se descarta a propósito para no pisar datos buenos con un resultado sospechoso. */
export class SyncRechazadoError extends Error {
  override name = 'SyncRechazadoError';
}

/** Mensaje de error apto para logs y para la base: sin datos de tickets ni secretos. */
function describirError(error: unknown): string {
  if (error instanceof JiraError || error instanceof SyncRechazadoError) return error.message;
  if (error instanceof Error) return `${error.name}: error inesperado durante el sync`;
  return 'Error inesperado durante el sync';
}

/**
 * Sync completo Jira → SQLite (ADR-0002, spec de la etapa 4). Nunca corre dos veces en
 * paralelo y nunca rechaza: los errores se registran y la base conserva el último dato bueno.
 */
export class Sincronizador {
  private enCurso: Promise<ResultadoSync> | undefined;
  private readonly ahora: () => Date;

  constructor(private readonly deps: DependenciasSync) {
    this.ahora = deps.ahora ?? (() => new Date());
  }

  sincronizar(): Promise<ResultadoSync> {
    if (this.enCurso) {
      this.deps.logger.warn('Sync salteado: el anterior sigue en curso');
      return Promise.resolve({ estado: 'salteado' });
    }
    this.enCurso = this.ejecutar().finally(() => {
      this.enCurso = undefined;
    });
    return this.enCurso;
  }

  /** Espera a que termine el sync en curso, si hay uno (para el apagado limpio). */
  async esperar(): Promise<void> {
    await this.enCurso;
  }

  private async ejecutar(): Promise<ResultadoSync> {
    const { cliente, repositorio, jira, logger } = this.deps;
    const inicio = this.ahora().toISOString();
    try {
      await cliente.verificarCredenciales();
      const campos = [...CAMPOS_NATIVOS, ...Object.values(jira.campos)];
      const issues = await cliente.buscar(jira.jql, campos);
      const tickets = issues.map((issue) => aTicket(issue, jira.campos));
      const anteriores = repositorio.contarTickets();
      if (tickets.length === 0 && anteriores > 0) {
        throw new SyncRechazadoError(
          `Jira devolvió 0 tickets y la base tenía ${String(anteriores)}; no se reemplazan (revisar credenciales, permisos o JIRA_JQL)`,
        );
      }
      repositorio.reemplazarTickets(tickets);
      repositorio.registrarSync({
        inicio,
        fin: this.ahora().toISOString(),
        ok: true,
        tickets: tickets.length,
        error: null,
      });
      logger.info({ tickets: tickets.length }, 'Sync completado');
      return { estado: 'ok', tickets: tickets.length };
    } catch (error) {
      const mensaje = describirError(error);
      try {
        repositorio.registrarSync({
          inicio,
          fin: this.ahora().toISOString(),
          ok: false,
          tickets: null,
          error: mensaje,
        });
      } catch {
        // Si tampoco se puede registrar, alcanza con el log.
      }
      logger.error({ error: mensaje }, 'Sync fallido; se conservan los datos anteriores');
      return { estado: 'error', error: mensaje };
    }
  }
}
