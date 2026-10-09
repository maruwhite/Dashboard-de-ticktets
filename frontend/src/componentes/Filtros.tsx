import type { Dimension, Filtros as TipoFiltros, Opcion } from '@dashboard/shared';
import { useEffect, useId, useRef } from 'react';
import {
  chipsDeFiltros,
  conFecha,
  conValores,
  hayFiltros,
  NOMBRES_DIMENSION,
} from '../filtros-url';
import { formatearNumero } from '../formato';

/** Segmentadores con selector propio (responsable del proyecto se filtra solo por clic). */
const SEGMENTADORES: readonly Dimension[] = [
  'proyecto',
  'tipoProyecto',
  'tipoIncidencia',
  'estado',
  'prioridad',
  'responsable',
  'informador',
];

interface Props {
  filtros: TipoFiltros;
  opciones: Partial<Record<Dimension, readonly Opcion[]>>;
  mostrados: number | undefined;
  total: number | undefined;
  cambiar: (filtros: TipoFiltros) => void;
}

function SelectorMultiple({
  nombre,
  opciones,
  elegidos,
  cambiar,
}: {
  nombre: string;
  opciones: readonly Opcion[];
  elegidos: readonly string[];
  cambiar: (valores: string[]) => void;
}) {
  const id = useId();
  const ref = useRef<HTMLDetailsElement>(null);

  // Se cierra al tocar afuera, como cualquier lista desplegable.
  useEffect(() => {
    const alTocarAfuera = (evento: PointerEvent) => {
      const detalles = ref.current;
      if (detalles?.open && !detalles.contains(evento.target as Node)) detalles.open = false;
    };
    document.addEventListener('pointerdown', alTocarAfuera);
    return () => {
      document.removeEventListener('pointerdown', alTocarAfuera);
    };
  }, []);

  return (
    <details
      className="selector"
      ref={ref}
      onKeyDown={(evento) => {
        const detalles = ref.current;
        if (evento.key === 'Escape' && detalles?.open) {
          detalles.open = false;
          detalles.querySelector('summary')?.focus();
        }
      }}
    >
      <summary>
        {nombre}
        {elegidos.length > 0 && <span className="contador">{elegidos.length}</span>}
      </summary>
      <fieldset className="selector-opciones" aria-labelledby={id}>
        <legend id={id} className="solo-lectores">
          {nombre}
        </legend>
        {opciones.length === 0 && <p className="secundario">Sin opciones</p>}
        {opciones.map((opcion) => (
          <label key={opcion.valor} className="opcion">
            <input
              type="checkbox"
              checked={elegidos.includes(opcion.valor)}
              onChange={(evento) => {
                cambiar(
                  evento.target.checked
                    ? [...elegidos, opcion.valor]
                    : elegidos.filter((v) => v !== opcion.valor),
                );
              }}
            />
            {opcion.etiqueta}
          </label>
        ))}
      </fieldset>
    </details>
  );
}

export function Filtros({ filtros, opciones, mostrados, total, cambiar }: Props) {
  const chips = chipsDeFiltros(filtros, opciones);
  return (
    <section className="filtros" aria-label="Filtros">
      <div className="fila-filtros">
        {SEGMENTADORES.map((dimension) => (
          <SelectorMultiple
            key={dimension}
            nombre={NOMBRES_DIMENSION[dimension]}
            opciones={opciones[dimension] ?? []}
            elegidos={filtros[dimension] ?? []}
            cambiar={(valores) => {
              cambiar(conValores(filtros, dimension, valores));
            }}
          />
        ))}
        <label className="fecha">
          Desde
          <input
            type="date"
            value={filtros.desde ?? ''}
            max={filtros.hasta}
            onChange={(e) => {
              cambiar(conFecha(filtros, 'desde', e.target.value));
            }}
          />
        </label>
        <label className="fecha">
          Hasta
          <input
            type="date"
            value={filtros.hasta ?? ''}
            min={filtros.desde}
            onChange={(e) => {
              cambiar(conFecha(filtros, 'hasta', e.target.value));
            }}
          />
        </label>
      </div>
      <div className="fila-chips">
        {chips.length > 0 && (
          <ul className="chips" aria-label="Filtros activos">
            {chips.map((chip) => (
              <li key={chip.clave}>
                <button
                  type="button"
                  className="chip"
                  onClick={() => {
                    cambiar(chip.quitar(filtros));
                  }}
                  aria-label={`Quitar filtro ${chip.texto}`}
                >
                  {chip.texto} <span aria-hidden="true">✕</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {hayFiltros(filtros) && (
          <button
            type="button"
            className="boton-enlace"
            onClick={() => {
              cambiar({});
            }}
          >
            Limpiar todo
          </button>
        )}
        {mostrados !== undefined && total !== undefined && (
          <p className="secundario conteo" aria-live="polite">
            Mostrando {formatearNumero(mostrados)} de {formatearNumero(total)} tickets
          </p>
        )}
      </div>
    </section>
  );
}
