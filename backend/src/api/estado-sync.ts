import type { EstadoSync } from '@dashboard/shared';
import type { Repositorio } from '../db/repositorio.js';

export function estadoSync(
  repositorio: Repositorio,
  config: { activo: boolean; intervaloMinutos: number; modoDemo?: boolean },
): EstadoSync {
  const intento = repositorio.ultimoSync();
  const exitoso = repositorio.ultimoSyncExitoso();
  return {
    activo: config.activo,
    modoDemo: config.modoDemo ?? false,
    intervaloMinutos: config.intervaloMinutos,
    ultimoIntento: intento ? { fin: intento.fin, ok: intento.ok, error: intento.error } : null,
    ultimoExitoso: exitoso ? { fin: exitoso.fin, tickets: exitoso.tickets ?? 0 } : null,
  };
}
