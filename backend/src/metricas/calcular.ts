import {
  DIMENSIONES,
  esAbierto,
  grupoDeEstado,
  SIN_DATO,
  type CycleTime,
  type Dashboard,
  type Dimension,
  type Filtros,
  type ItemDistribucion,
  type Kpis,
  type Opcion,
  type PuntoTendencia,
  type Ticket,
} from '@dashboard/shared';
import { diaLocal, mesesEntre, mesLocal } from './fechas.js';

const DIA_MS = 24 * 60 * 60 * 1000;
/** Un ticket abierto está estancado si lleva más de estos días sin cambios (ADR-0006). */
export const DIAS_PARA_ESTANCADO = 3;

const VALOR: Record<Dimension, (t: Ticket) => string> = {
  tipoIncidencia: (t) => t.tipo,
  proyecto: (t) => t.proyectoClave,
  tipoProyecto: (t) => t.tipoProyecto,
  estado: (t) => t.estado,
  prioridad: (t) => t.prioridad,
  informador: (t) => t.informador,
  responsable: (t) => t.responsable,
  responsableProyecto: (t) => t.responsableProyecto,
};

const comparar = (a: string, b: string) => a.localeCompare(b, 'es');
const etiqueta = (valor: string) => (valor === '' ? SIN_DATO : valor);
const redondear = (dias: number) => Math.round(dias * 10) / 10;

/** O dentro de una dimensión, Y entre dimensiones; fechas sobre la creación, inclusive. */
export function filtrar(tickets: readonly Ticket[], filtros: Filtros): Ticket[] {
  return tickets.filter((ticket) => {
    for (const dimension of DIMENSIONES) {
      const valores = filtros[dimension];
      if (valores && valores.length > 0 && !valores.includes(VALOR[dimension](ticket))) {
        return false;
      }
    }
    if (filtros.desde === undefined && filtros.hasta === undefined) return true;
    const dia = diaLocal(ticket.creada);
    if (dia === null) return false;
    return (
      (filtros.desde === undefined || dia >= filtros.desde) &&
      (filtros.hasta === undefined || dia <= filtros.hasta)
    );
  });
}

function calcularCycleTime(dias: number[]): CycleTime {
  if (dias.length === 0) return { promedioDias: null, medianaDias: null, tickets: 0 };
  const ordenados = [...dias].sort((a, b) => a - b);
  const medio = Math.floor(ordenados.length / 2);
  const mediana =
    ordenados.length % 2 === 1
      ? (ordenados[medio] ?? 0)
      : ((ordenados[medio - 1] ?? 0) + (ordenados[medio] ?? 0)) / 2;
  const promedio = ordenados.reduce((suma, d) => suma + d, 0) / ordenados.length;
  return {
    promedioDias: redondear(promedio),
    medianaDias: redondear(mediana),
    tickets: dias.length,
  };
}

export function calcularKpis(tickets: readonly Ticket[], ahora: Date): Kpis {
  const hoy = diaLocal(ahora.toISOString()) ?? '';
  const kpis = {
    total: tickets.length,
    abiertos: 0,
    enCurso: 0,
    enEspera: 0,
    completados: 0,
    descartados: 0,
    estancados: 0,
    vencidos: 0,
  };
  const dias: number[] = [];

  for (const ticket of tickets) {
    const grupo = grupoDeEstado(ticket.estado);
    if (grupo === 'En curso') kpis.enCurso++;
    if (grupo === 'En espera') kpis.enEspera++;
    if (grupo === 'Completado') kpis.completados++;
    if (grupo === 'Descartado') kpis.descartados++;

    if (esAbierto(grupo)) {
      kpis.abiertos++;
      const actualizada = Date.parse(ticket.actualizada);
      if (ahora.getTime() - actualizada > DIAS_PARA_ESTANCADO * DIA_MS) kpis.estancados++;
      if (ticket.vencimiento !== null && ticket.vencimiento < hoy) kpis.vencidos++;
    }

    if (grupo === 'Completado' && ticket.resuelta !== null) {
      const duracion = Date.parse(ticket.resuelta) - Date.parse(ticket.creada);
      if (!Number.isNaN(duracion)) dias.push(duracion / DIA_MS);
    }
  }

  return { ...kpis, cycleTime: calcularCycleTime(dias) };
}

/** Cantidad por valor, de mayor a menor (a igual cantidad, alfabético). */
export function calcularDistribucion(
  tickets: readonly Ticket[],
  dimension: Dimension,
): ItemDistribucion[] {
  const conteo = new Map<string, number>();
  for (const ticket of tickets) {
    const valor = VALOR[dimension](ticket);
    conteo.set(valor, (conteo.get(valor) ?? 0) + 1);
  }
  return [...conteo.entries()]
    .map(([valor, cantidad]): ItemDistribucion => ({
      valor,
      etiqueta: etiqueta(valor),
      cantidad,
      ...(dimension === 'estado' ? { grupo: grupoDeEstado(valor) } : {}),
    }))
    .sort((a, b) => b.cantidad - a.cantidad || comparar(a.etiqueta, b.etiqueta));
}

/** Creados y resueltos (solo Completado) por mes, con todos los meses del rango. */
export function calcularTendencia(tickets: readonly Ticket[]): PuntoTendencia[] {
  const creados = new Map<string, number>();
  const resueltos = new Map<string, number>();
  for (const ticket of tickets) {
    const mesCreado = mesLocal(ticket.creada);
    if (mesCreado !== null) creados.set(mesCreado, (creados.get(mesCreado) ?? 0) + 1);
    if (grupoDeEstado(ticket.estado) === 'Completado' && ticket.resuelta !== null) {
      const mesResuelto = mesLocal(ticket.resuelta);
      if (mesResuelto !== null) resueltos.set(mesResuelto, (resueltos.get(mesResuelto) ?? 0) + 1);
    }
  }
  const meses = [...creados.keys(), ...resueltos.keys()].sort();
  const [primero] = meses;
  const ultimo = meses.at(-1);
  if (primero === undefined || ultimo === undefined) return [];
  return mesesEntre(primero, ultimo).map((periodo) => ({
    periodo,
    creados: creados.get(periodo) ?? 0,
    resueltos: resueltos.get(periodo) ?? 0,
  }));
}

/** Valores posibles de cada segmentador, sobre todos los tickets (no los filtrados). */
export function calcularOpciones(tickets: readonly Ticket[]): Record<Dimension, Opcion[]> {
  const nombreDeProyecto = new Map(tickets.map((t) => [t.proyectoClave, t.proyectoNombre]));
  const opciones = {} as Record<Dimension, Opcion[]>;
  for (const dimension of DIMENSIONES) {
    const valores = [...new Set(tickets.map(VALOR[dimension]))].sort(comparar);
    opciones[dimension] = valores.map((valor) => {
      const nombre = dimension === 'proyecto' ? nombreDeProyecto.get(valor) : undefined;
      return { valor, etiqueta: nombre ? `${valor} — ${nombre}` : etiqueta(valor) };
    });
  }
  return opciones;
}

/** Todo lo que muestra el dashboard para un conjunto de filtros (spec de la etapa 5). */
export function calcularDashboard(
  tickets: readonly Ticket[],
  filtros: Filtros,
  ahora: Date,
): Dashboard {
  const filtrados = filtrar(tickets, filtros);
  const distribuciones = {} as Record<Dimension, ItemDistribucion[]>;
  for (const dimension of DIMENSIONES) {
    distribuciones[dimension] = calcularDistribucion(filtrados, dimension);
  }
  return {
    totalSinFiltrar: tickets.length,
    kpis: calcularKpis(filtrados, ahora),
    distribuciones,
    tendencia: calcularTendencia(filtrados),
    opciones: calcularOpciones(tickets),
  };
}
