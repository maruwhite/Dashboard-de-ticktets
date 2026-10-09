import {
  tipoDeGrafico,
  type Dimension,
  type ItemDistribucion,
  type Opcion,
} from '@dashboard/shared';
import { useId, useState } from 'react';
import { Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { COLOR_BARRA, COLOR_DE_GRUPO, colorDeEntidad } from '../colores';
import { formatearNumero, formatearPorcentaje } from '../formato';

interface Props {
  titulo: string;
  dimension: Dimension;
  items: readonly ItemDistribucion[];
  /** Opciones totales de la dimensión: fijan el color de cada entidad. */
  opciones: readonly Opcion[];
  /** Valores filtrados en esta dimensión (se resaltan). */
  seleccionados: readonly string[];
  /** Clic en una barra, porción o entrada de la leyenda. */
  alternar: (valor: string) => void;
}

function Barras({ dimension, items, seleccionados, alternar, total }: Props & { total: number }) {
  const maximo = Math.max(...items.map((i) => i.cantidad));
  return (
    <ul className="barras">
      {items.map((item) => {
        const activo = seleccionados.includes(item.valor);
        const color =
          dimension === 'estado' && item.grupo ? COLOR_DE_GRUPO[item.grupo] : COLOR_BARRA;
        const porcentaje = formatearPorcentaje(item.cantidad, total);
        return (
          <li key={item.valor}>
            <button
              type="button"
              className={activo ? 'barra activa' : 'barra'}
              aria-pressed={activo}
              title={`${item.etiqueta}: ${formatearNumero(item.cantidad)} (${porcentaje})`}
              onClick={() => {
                alternar(item.valor);
              }}
            >
              <span className="barra-etiqueta">
                {item.etiqueta}
                {dimension === 'estado' && item.grupo && (
                  <>
                    {' '}
                    <span className="barra-grupo">· {item.grupo}</span>
                  </>
                )}
              </span>
              <span className="barra-pista">
                <span
                  className="barra-relleno"
                  style={{ width: `${String((item.cantidad / maximo) * 100)}%`, background: color }}
                />
              </span>
              <span className="barra-valor">{formatearNumero(item.cantidad)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Torta({ items, opciones, seleccionados, alternar, total }: Props & { total: number }) {
  // Recharts toma `fill` y `fillOpacity` de cada dato para dibujar su porción.
  const datos = items.map((item) => {
    const color = colorDeEntidad(item.valor, opciones);
    const activo = seleccionados.length === 0 || seleccionados.includes(item.valor);
    return { ...item, color, fill: color, fillOpacity: activo ? 1 : 0.35 };
  });
  return (
    <div className="torta">
      <div className="torta-grafico" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={datos}
              dataKey="cantidad"
              nameKey="etiqueta"
              innerRadius="55%"
              outerRadius="90%"
              paddingAngle={1}
              stroke="var(--superficie)"
              strokeWidth={2}
              isAnimationActive={false}
              cursor="pointer"
              onClick={(_, indice) => {
                const item = datos[indice];
                if (item) alternar(item.valor);
              }}
            />
            <Tooltip
              formatter={(valor) => [
                `${formatearNumero(Number(valor))} (${formatearPorcentaje(Number(valor), total)})`,
                '',
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="leyenda">
        {datos.map((d) => (
          <li key={d.valor}>
            <button
              type="button"
              className={seleccionados.includes(d.valor) ? 'leyenda-item activa' : 'leyenda-item'}
              aria-pressed={seleccionados.includes(d.valor)}
              onClick={() => {
                alternar(d.valor);
              }}
            >
              <span className="muestra" style={{ background: d.color }} aria-hidden="true" />
              <span className="leyenda-etiqueta">{d.etiqueta}</span>
              <span className="leyenda-valor">
                {formatearNumero(d.cantidad)} · {formatearPorcentaje(d.cantidad, total)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TablaDistribucion({
  titulo,
  items,
  total,
}: {
  titulo: string;
  items: readonly ItemDistribucion[];
  total: number;
}) {
  return (
    <table className="tabla">
      <caption className="solo-lectores">{titulo}</caption>
      <thead>
        <tr>
          <th scope="col">Valor</th>
          <th scope="col" className="numero">
            Tickets
          </th>
          <th scope="col" className="numero">
            %
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.valor}>
            <th scope="row">{item.etiqueta}</th>
            <td className="numero">{formatearNumero(item.cantidad)}</td>
            <td className="numero">{formatearPorcentaje(item.cantidad, total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function GraficoDistribucion(props: Props) {
  const [verTabla, setVerTabla] = useState(false);
  const idTitulo = useId();
  const total = props.items.reduce((suma, i) => suma + i.cantidad, 0);
  const tipo = tipoDeGrafico(props.items.length);

  return (
    <article className="tarjeta" aria-labelledby={idTitulo} data-tipo={tipo}>
      <header className="tarjeta-encabezado">
        <h2 id={idTitulo}>{props.titulo}</h2>
        {props.items.length > 0 && (
          <button
            type="button"
            className="boton-enlace"
            aria-pressed={verTabla}
            onClick={() => {
              setVerTabla((v) => !v);
            }}
          >
            {verTabla ? 'Ver gráfico' : 'Ver tabla'}
          </button>
        )}
      </header>
      {props.items.length === 0 ? (
        <p className="secundario vacio">Sin datos para los filtros elegidos</p>
      ) : verTabla ? (
        <TablaDistribucion titulo={props.titulo} items={props.items} total={total} />
      ) : tipo === 'torta' ? (
        <Torta {...props} total={total} />
      ) : (
        <Barras {...props} total={total} />
      )}
    </article>
  );
}
