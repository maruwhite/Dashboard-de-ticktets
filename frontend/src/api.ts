import type { Filtros, RespuestaDashboard, RespuestaError, RespuestaSync } from '@dashboard/shared';
import { filtrosAUrl } from './filtros-url';

export class ErrorApi extends Error {
  override name = 'ErrorApi';

  constructor(
    readonly status: number,
    mensaje: string,
    /** Segundos a esperar (cabecera Retry-After), si la API la envía. */
    readonly reintentarEn?: number,
  ) {
    super(mensaje);
  }
}

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(url, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ErrorApi(0, 'No se pudo conectar con el servidor');
  }
  const cuerpo = (await respuesta.json().catch(() => null)) as unknown;
  if (!respuesta.ok) {
    const mensaje = (cuerpo as RespuestaError | null)?.error ?? `Error ${String(respuesta.status)}`;
    const retryAfter = Number(respuesta.headers.get('Retry-After'));
    throw new ErrorApi(respuesta.status, mensaje, retryAfter > 0 ? retryAfter : undefined);
  }
  return cuerpo as T;
}

export function obtenerDashboard(
  filtros: Filtros,
  signal?: AbortSignal,
): Promise<RespuestaDashboard> {
  return pedir(`/api/dashboard${filtrosAUrl(filtros)}`, signal ? { signal } : undefined);
}

export function sincronizarAhora(): Promise<RespuestaSync> {
  return pedir('/api/sync', { method: 'POST' });
}
