import type { Filtros, RespuestaDashboard } from '@dashboard/shared';
import { useCallback, useEffect, useState } from 'react';
import { ErrorApi, obtenerDashboard } from './api';
import { filtrosAUrl, filtrosDesdeUrl } from './filtros-url';

/** Filtros guardados en la URL: se pueden compartir y sobreviven a recargar la página. */
export function useFiltrosUrl(): [Filtros, (filtros: Filtros) => void] {
  const [filtros, setFiltros] = useState<Filtros>(() => filtrosDesdeUrl(window.location.search));

  useEffect(() => {
    const alVolver = () => {
      setFiltros(filtrosDesdeUrl(window.location.search));
    };
    window.addEventListener('popstate', alVolver);
    return () => {
      window.removeEventListener('popstate', alVolver);
    };
  }, []);

  const cambiar = useCallback((nuevos: Filtros) => {
    const url = `${window.location.pathname}${filtrosAUrl(nuevos)}`;
    window.history.pushState(null, '', url);
    setFiltros(nuevos);
  }, []);

  return [filtros, cambiar];
}

export interface EstadoDashboard {
  datos: RespuestaDashboard | undefined;
  cargando: boolean;
  error: string | undefined;
  recargar: () => void;
}

/**
 * Pide el dashboard cada vez que cambian los filtros (cancelando el pedido anterior) y lo
 * recarga solo según el intervalo de sync que informa la API. Si falla, conserva los datos.
 */
export function useDashboard(filtros: Filtros): EstadoDashboard {
  const [datos, setDatos] = useState<RespuestaDashboard>();
  const [error, setError] = useState<string>();
  const [version, setVersion] = useState(0);
  /** Último pedido que terminó (bien o mal): si no es el actual, está cargando. */
  const [resuelto, setResuelto] = useState<string>();
  const clave = filtrosAUrl(filtros);
  const pedido = `${clave}#${String(version)}`;

  useEffect(() => {
    const control = new AbortController();
    obtenerDashboard(filtrosDesdeUrl(clave), control.signal)
      .then((respuesta) => {
        setDatos(respuesta);
        setError(undefined);
        setResuelto(pedido);
      })
      .catch((causa: unknown) => {
        if (control.signal.aborted) return;
        setError(
          causa instanceof ErrorApi ? causa.message : 'Error inesperado al cargar los datos',
        );
        setResuelto(pedido);
      });
    return () => {
      control.abort();
    };
  }, [clave, pedido]);

  const cargando = resuelto !== pedido;

  const intervaloMs = (datos?.sync.intervaloMinutos ?? 0) * 60_000;
  useEffect(() => {
    if (intervaloMs <= 0) return;
    const timer = setInterval(() => {
      setVersion((v) => v + 1);
    }, intervaloMs);
    return () => {
      clearInterval(timer);
    };
  }, [intervaloMs]);

  const recargar = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  return { datos, cargando, error, recargar };
}

/** La hora actual, actualizada cada minuto (para "hace N min"). */
export function useAhora(): Date {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setAhora(new Date());
    }, 60_000);
    return () => {
      clearInterval(timer);
    };
  }, []);
  return ahora;
}

export type Tema = 'claro' | 'oscuro';
const CLAVE_TEMA = 'dashboard-tema';

function leerTemaGuardado(): Tema | undefined {
  try {
    const valor = window.localStorage.getItem(CLAVE_TEMA);
    return valor === 'claro' || valor === 'oscuro' ? valor : undefined;
  } catch {
    return undefined;
  }
}

function temaDelSistema(): Tema {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
}

/** Sigue al sistema operativo hasta que se elige uno; la elección se recuerda. */
export function useTema(): [Tema, () => void] {
  const [tema, setTema] = useState<Tema>(() => leerTemaGuardado() ?? temaDelSistema());

  useEffect(() => {
    document.documentElement.dataset.theme = tema === 'oscuro' ? 'dark' : 'light';
  }, [tema]);

  const alternar = useCallback(() => {
    setTema((actual) => {
      const nuevo = actual === 'oscuro' ? 'claro' : 'oscuro';
      try {
        window.localStorage.setItem(CLAVE_TEMA, nuevo);
      } catch {
        // Sin almacenamiento disponible: el tema vale solo para esta visita.
      }
      return nuevo;
    });
  }, []);

  return [tema, alternar];
}
