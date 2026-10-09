import type { Kpis as TipoKpis } from '@dashboard/shared';
import { formatearDecimal, formatearNumero } from '../formato';

interface Tarjeta {
  titulo: string;
  valor: string;
  detalle?: string;
  /** Aviso con ícono y texto (nunca solo color). */
  alerta?: string;
}

function tarjetas(k: TipoKpis): Tarjeta[] {
  const { cycleTime } = k;
  return [
    { titulo: 'Total', valor: formatearNumero(k.total) },
    { titulo: 'Abiertos', valor: formatearNumero(k.abiertos) },
    { titulo: 'En curso', valor: formatearNumero(k.enCurso) },
    { titulo: 'En espera', valor: formatearNumero(k.enEspera) },
    { titulo: 'Completados', valor: formatearNumero(k.completados) },
    { titulo: 'Descartados', valor: formatearNumero(k.descartados) },
    {
      titulo: 'Estancados',
      valor: formatearNumero(k.estancados),
      detalle: 'más de 3 días sin cambios',
      ...(k.estancados > 0 ? { alerta: 'Requieren atención' } : {}),
    },
    {
      titulo: 'Vencidos',
      valor: formatearNumero(k.vencidos),
      detalle: 'según fecha de vencimiento',
      ...(k.vencidos > 0 ? { alerta: 'Fuera de plazo' } : {}),
    },
    {
      titulo: 'Cycle time (mediana)',
      valor: cycleTime.medianaDias === null ? '—' : `${formatearDecimal(cycleTime.medianaDias)} d`,
      detalle:
        cycleTime.promedioDias === null
          ? 'sin tickets completados con fecha de resolución'
          : `promedio ${formatearDecimal(cycleTime.promedioDias)} d · sobre ${formatearNumero(cycleTime.tickets)} tickets`,
    },
  ];
}

export function Kpis({ kpis }: { kpis: TipoKpis }) {
  return (
    <section className="kpis" aria-label="Indicadores">
      {tarjetas(kpis).map((t) => (
        <article key={t.titulo} className={t.alerta ? 'kpi kpi-alerta' : 'kpi'}>
          <h2 className="kpi-titulo">{t.titulo}</h2>
          <p className="kpi-valor">{t.valor}</p>
          {t.alerta && (
            <p className="kpi-aviso">
              <span aria-hidden="true">⚠</span> {t.alerta}
            </p>
          )}
          {t.detalle && <p className="kpi-detalle">{t.detalle}</p>}
        </article>
      ))}
    </section>
  );
}
