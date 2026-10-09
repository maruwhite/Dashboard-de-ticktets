import type { Dimension } from '@dashboard/shared';
import { Encabezado } from './componentes/Encabezado';
import { Filtros } from './componentes/Filtros';
import { GraficoDistribucion } from './componentes/GraficoDistribucion';
import { Kpis } from './componentes/Kpis';
import { Tendencia } from './componentes/Tendencia';
import { alternarValor, hayFiltros } from './filtros-url';
import { formatearNumero } from './formato';
import { useAhora, useDashboard, useFiltrosUrl, useTema } from './hooks';

const GRAFICOS: readonly { dimension: Dimension; titulo: string }[] = [
  { dimension: 'estado', titulo: 'Por estado' },
  { dimension: 'tipoIncidencia', titulo: 'Por tipo de incidencia' },
  { dimension: 'proyecto', titulo: 'Por proyecto' },
  { dimension: 'tipoProyecto', titulo: 'Por tipo de proyecto' },
  { dimension: 'prioridad', titulo: 'Por prioridad' },
  { dimension: 'responsable', titulo: 'Por responsable' },
  { dimension: 'informador', titulo: 'Por informador' },
  { dimension: 'responsableProyecto', titulo: 'Por responsable del proyecto' },
];

function Esqueleto() {
  return (
    <div className="esqueleto" aria-busy="true" aria-label="Cargando el dashboard">
      <div className="esqueleto-fila" />
      <div className="esqueleto-bloque" />
      <div className="esqueleto-grilla">
        <div className="esqueleto-bloque" />
        <div className="esqueleto-bloque" />
      </div>
    </div>
  );
}

export function App() {
  const [filtros, cambiarFiltros] = useFiltrosUrl();
  const { datos, cargando, error, recargar } = useDashboard(filtros);
  const ahora = useAhora();
  const [tema, alternarTema] = useTema();

  return (
    <div className="pagina">
      <Encabezado
        sync={datos?.sync}
        ahora={ahora}
        tema={tema}
        alternarTema={alternarTema}
        alSincronizar={recargar}
      />
      <Filtros
        filtros={filtros}
        opciones={datos?.opciones ?? {}}
        mostrados={datos?.kpis.total}
        total={datos?.totalSinFiltrar}
        cambiar={cambiarFiltros}
      />

      <main aria-busy={cargando}>
        {error && (
          <div className="aviso aviso-error" role="alert">
            <span aria-hidden="true">⚠</span> {error}
            {datos ? ' Se muestran los últimos datos cargados.' : ''}{' '}
            <button type="button" className="boton-enlace" onClick={recargar}>
              Reintentar
            </button>
          </div>
        )}

        {!datos && !error && <Esqueleto />}

        {datos?.kpis.total === 0 && (
          <div className="vacio-general">
            <p>No hay tickets para los filtros elegidos.</p>
            {hayFiltros(filtros) && (
              <button
                type="button"
                className="boton-primario"
                onClick={() => {
                  cambiarFiltros({});
                }}
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}

        {datos && datos.kpis.total > 0 && (
          <>
            <Kpis kpis={datos.kpis} />
            <Tendencia puntos={datos.tendencia} resueltosConFecha={datos.kpis.cycleTime.tickets} />
            <section className="grilla-graficos" aria-label="Distribuciones">
              {GRAFICOS.map(({ dimension, titulo }) => (
                <GraficoDistribucion
                  key={dimension}
                  titulo={titulo}
                  dimension={dimension}
                  items={datos.distribuciones[dimension]}
                  opciones={datos.opciones[dimension]}
                  seleccionados={filtros[dimension] ?? []}
                  alternar={(valor) => {
                    cambiarFiltros(alternarValor(filtros, dimension, valor));
                  }}
                />
              ))}
            </section>
          </>
        )}
      </main>

      <footer className="notas">
        <p>
          Datos reales anonimizados, sincronizados desde Jira. El <strong>responsable</strong> de
          cada ticket es un dato ficticio (ADR-0011).
          {datos &&
            ` El cycle time y los resueltos se calculan sobre los ${formatearNumero(datos.kpis.cycleTime.tickets)} tickets completados con fecha de resolución.`}
        </p>
      </footer>
    </div>
  );
}
