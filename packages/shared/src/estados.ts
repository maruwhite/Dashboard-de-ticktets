/** Grupos de estado (ADR-0005, ajustado por ADR-0010). Único lugar con esta tabla. */
export const GRUPOS = [
  'Por hacer',
  'En curso',
  'En espera',
  'Completado',
  'Descartado',
  'Sin clasificar',
] as const;

export type GrupoEstado = (typeof GRUPOS)[number];

const ESTADOS_POR_GRUPO: Record<Exclude<GrupoEstado, 'Sin clasificar'>, readonly string[]> = {
  'Por hacer': ['Planificado'],
  'En curso': ['Análisis y Estimación', 'Análisis y Diseño funcional', 'En curso'],
  'En espera': ['Solicitud información a Usuario', 'Pausado'],
  // "Finalizada" se unifica en "Finalizado" al anonimizar; se reconoce igual por si aparece
  // en un ticket creado a mano en Jira.
  Completado: ['Cerrado', 'Finalizado', 'Finalizada'],
  Descartado: ['Cancelado', 'Rechazado'],
};

const normalizar = (texto: string) => texto.trim().replace(/\s+/g, ' ').toLowerCase();

const GRUPO_POR_ESTADO = new Map<string, GrupoEstado>(
  Object.entries(ESTADOS_POR_GRUPO).flatMap(([grupo, estados]) =>
    estados.map((estado) => [normalizar(estado), grupo as GrupoEstado]),
  ),
);

/** Grupo de un estado de Jira. Un estado desconocido es "Sin clasificar", nunca otro grupo. */
export function grupoDeEstado(estado: string): GrupoEstado {
  return GRUPO_POR_ESTADO.get(normalizar(estado)) ?? 'Sin clasificar';
}

/** Abiertos: Por hacer + En curso + En espera (ADR-0006). */
export function esAbierto(grupo: GrupoEstado): boolean {
  return grupo === 'Por hacer' || grupo === 'En curso' || grupo === 'En espera';
}
