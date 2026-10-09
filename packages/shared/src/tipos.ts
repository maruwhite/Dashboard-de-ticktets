import type { GrupoEstado } from './estados.js';

/** Ticket sincronizado desde Jira. Fechas en ISO 8601 UTC. */
export interface Ticket {
  clave: string;
  idOrigen: string;
  tipo: string;
  estado: string;
  prioridad: string;
  proyectoClave: string;
  proyectoNombre: string;
  tipoProyecto: string;
  responsable: string;
  informador: string;
  responsableProyecto: string;
  titulo: string;
  creada: string;
  resuelta: string | null;
  actualizada: string;
  /** Fecha de vencimiento (`AAAA-MM-DD`), si tiene. */
  vencimiento: string | null;
}

/** Dimensiones por las que se agrupa (gráficos) y se filtra (segmentadores y clics). */
export const DIMENSIONES = [
  'tipoIncidencia',
  'proyecto',
  'tipoProyecto',
  'estado',
  'prioridad',
  'informador',
  'responsable',
  'responsableProyecto',
] as const;

export type Dimension = (typeof DIMENSIONES)[number];

/**
 * Filtros del dashboard. Dentro de una dimensión los valores se combinan con O; entre
 * dimensiones, con Y. Las fechas (`AAAA-MM-DD`, hora de Argentina, inclusive) aplican sobre la
 * fecha de creación.
 */
export type Filtros = Partial<Record<Dimension, readonly string[]>> & {
  desde?: string;
  hasta?: string;
};

export interface CycleTime {
  promedioDias: number | null;
  medianaDias: number | null;
  /** Tickets completados con fecha de resolución que entran en el cálculo. */
  tickets: number;
}

export interface Kpis {
  total: number;
  abiertos: number;
  enCurso: number;
  enEspera: number;
  completados: number;
  descartados: number;
  estancados: number;
  vencidos: number;
  cycleTime: CycleTime;
}

export interface ItemDistribucion {
  /** Valor crudo (el que se usa para filtrar); puede ser vacío. */
  valor: string;
  /** Texto para mostrar: "(sin dato)" si el valor está vacío. */
  etiqueta: string;
  cantidad: number;
  /** Solo en la distribución por estado. */
  grupo?: GrupoEstado;
}

export interface PuntoTendencia {
  /** Mes, `AAAA-MM`. */
  periodo: string;
  creados: number;
  resueltos: number;
}

export interface Opcion {
  valor: string;
  etiqueta: string;
}

export interface Dashboard {
  totalSinFiltrar: number;
  kpis: Kpis;
  distribuciones: Record<Dimension, ItemDistribucion[]>;
  tendencia: PuntoTendencia[];
  opciones: Record<Dimension, Opcion[]>;
}

export const SIN_DATO = '(sin dato)';
