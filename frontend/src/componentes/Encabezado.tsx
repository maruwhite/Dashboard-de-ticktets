import type { EstadoSync } from '@dashboard/shared';
import { useState } from 'react';
import { ErrorApi, sincronizarAhora } from '../api';
import { formatearFechaHora, haceCuanto } from '../formato';
import type { Tema } from '../hooks';

interface Props {
  sync: EstadoSync | undefined;
  ahora: Date;
  tema: Tema;
  alternarTema: () => void;
  /** Se llama después de un sync manual exitoso, para recargar el dashboard. */
  alSincronizar: () => void;
}

type EstadoBoton =
  | { tipo: 'listo' }
  | { tipo: 'sincronizando' }
  | { tipo: 'mensaje'; texto: string; error: boolean };

export function Encabezado({ sync, ahora, tema, alternarTema, alSincronizar }: Props) {
  const [boton, setBoton] = useState<EstadoBoton>({ tipo: 'listo' });

  const sincronizar = async () => {
    setBoton({ tipo: 'sincronizando' });
    try {
      const respuesta = await sincronizarAhora();
      setBoton({
        tipo: 'mensaje',
        texto: `Sincronizado: ${String(respuesta.tickets)} tickets`,
        error: false,
      });
      alSincronizar();
    } catch (error) {
      const texto =
        error instanceof ErrorApi && error.status === 429 && error.reintentarEn !== undefined
          ? `Probá en ${String(error.reintentarEn)} s`
          : error instanceof ErrorApi
            ? error.message
            : 'No se pudo sincronizar';
      setBoton({ tipo: 'mensaje', texto, error: true });
    }
  };

  const exitoso = sync?.ultimoExitoso;
  const intento = sync?.ultimoIntento;
  const fallo =
    intento && !intento.ok && (!exitoso || intento.fin > exitoso.fin) ? intento : undefined;

  return (
    <header className="encabezado">
      <div>
        <h1>Dashboard de tickets</h1>
        <p className="secundario" aria-live="polite">
          {exitoso ? (
            <>
              Actualizado{' '}
              <time dateTime={exitoso.fin} title={formatearFechaHora(exitoso.fin)}>
                {haceCuanto(exitoso.fin, ahora)}
              </time>
              {sync.activo ? ` · se sincroniza cada ${String(sync.intervaloMinutos)} min` : ''}
            </>
          ) : (
            'Todavía no hay datos sincronizados'
          )}
        </p>
        {fallo && (
          <p className="aviso aviso-error" role="alert">
            <span aria-hidden="true">⚠</span> El último sync falló:{' '}
            {fallo.error ?? 'error desconocido'}.
            {exitoso ? ` Se muestran los datos de ${haceCuanto(exitoso.fin, ahora)}.` : ''}
          </p>
        )}
      </div>
      <div className="acciones">
        {boton.tipo === 'mensaje' && (
          <span className={boton.error ? 'texto-error' : 'secundario'} role="status">
            {boton.texto}
          </span>
        )}
        <button
          type="button"
          className="boton-primario"
          onClick={() => void sincronizar()}
          disabled={!sync?.activo || boton.tipo === 'sincronizando'}
          title={sync?.activo ? undefined : 'El sync con Jira está desactivado'}
        >
          <span aria-hidden="true">⟳</span>{' '}
          {boton.tipo === 'sincronizando' ? 'Sincronizando…' : 'Sincronizar ahora'}
        </button>
        <button
          type="button"
          className="boton-secundario"
          onClick={alternarTema}
          aria-label={tema === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          <span aria-hidden="true">{tema === 'oscuro' ? '☀' : '☾'}</span>
        </button>
      </div>
    </header>
  );
}
