import type { PuntoTendencia } from '@dashboard/shared';
import { useId, useState } from 'react';
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatearMes, formatearNumero } from '../formato';

const SERIES = [
  { clave: 'creados', nombre: 'Creados', color: 'var(--serie-1)' },
  { clave: 'resueltos', nombre: 'Resueltos', color: 'var(--serie-2)' },
] as const;

/** Etiqueta directa solo en el último punto de cada línea (nunca un número en cada punto). */
function etiquetaFinal(nombre: string, ultimo: number) {
  function Etiqueta(props: {
    x?: number | string | undefined;
    y?: number | string | undefined;
    index?: number | undefined;
    value?: unknown;
  }) {
    if (props.index !== ultimo) return null;
    return (
      <text x={Number(props.x) + 8} y={Number(props.y) + 4} className="etiqueta-directa">
        {nombre}: {formatearNumero(Number(props.value))}
      </text>
    );
  }
  return Etiqueta;
}

export function Tendencia({
  puntos,
  resueltosConFecha,
}: {
  puntos: readonly PuntoTendencia[];
  resueltosConFecha: number;
}) {
  const [verTabla, setVerTabla] = useState(false);
  const idTitulo = useId();
  const ultimo = puntos.length - 1;

  return (
    <article className="tarjeta tarjeta-ancha" aria-labelledby={idTitulo}>
      <header className="tarjeta-encabezado">
        <div>
          <h2 id={idTitulo}>Tendencia: creados vs. resueltos por mes</h2>
          <p className="secundario">
            Resueltos: tickets completados con fecha de resolución (
            {formatearNumero(resueltosConFecha)}).
          </p>
        </div>
        {puntos.length > 0 && (
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
      {puntos.length === 0 ? (
        <p className="secundario vacio">Sin tickets para los filtros elegidos</p>
      ) : verTabla ? (
        <table className="tabla">
          <caption className="solo-lectores">Creados y resueltos por mes</caption>
          <thead>
            <tr>
              <th scope="col">Mes</th>
              <th scope="col" className="numero">
                Creados
              </th>
              <th scope="col" className="numero">
                Resueltos
              </th>
            </tr>
          </thead>
          <tbody>
            {puntos.map((p) => (
              <tr key={p.periodo}>
                <th scope="row">{formatearMes(p.periodo)}</th>
                <td className="numero">{formatearNumero(p.creados)}</td>
                <td className="numero">{formatearNumero(p.resueltos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <ul className="leyenda leyenda-horizontal" aria-label="Series">
            {SERIES.map((s) => (
              <li key={s.clave}>
                <span
                  className="muestra muestra-linea"
                  style={{ background: s.color }}
                  aria-hidden="true"
                />
                {s.nombre}
              </li>
            ))}
          </ul>
          <div className="tendencia-grafico" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[...puntos]} margin={{ top: 8, right: 120, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--grilla)" vertical={false} />
                <XAxis
                  dataKey="periodo"
                  tickFormatter={formatearMes}
                  stroke="var(--eje)"
                  tick={{ fill: 'var(--texto-tenue)', fontSize: 12 }}
                  minTickGap={24}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="var(--eje)"
                  tick={{ fill: 'var(--texto-tenue)', fontSize: 12 }}
                  width={32}
                />
                <Tooltip
                  labelFormatter={(periodo) =>
                    typeof periodo === 'string' ? formatearMes(periodo) : periodo
                  }
                  formatter={(valor, nombre) => [formatearNumero(Number(valor)), nombre]}
                  cursor={{ stroke: 'var(--eje)' }}
                />
                {SERIES.map((s) => (
                  <Line
                    key={s.clave}
                    type="monotone"
                    dataKey={s.clave}
                    name={s.nombre}
                    stroke={s.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  >
                    <LabelList dataKey={s.clave} content={etiquetaFinal(s.nombre, ultimo)} />
                  </Line>
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </article>
  );
}
