/** Configuración que el sitio de Jira necesita para recibir los tickets (ADR-0004, 0005, 0010). */

export type CategoriaEstado = 'TODO' | 'IN_PROGRESS' | 'DONE';

/** Estados del workflow. "Planificado" es el inicial. "Finalizada" ya viene unificada. */
export const ESTADOS: readonly { nombre: string; categoria: CategoriaEstado }[] = [
  { nombre: 'Planificado', categoria: 'TODO' },
  { nombre: 'Análisis y Estimación', categoria: 'IN_PROGRESS' },
  { nombre: 'Análisis y Diseño funcional', categoria: 'IN_PROGRESS' },
  { nombre: 'En curso', categoria: 'IN_PROGRESS' },
  { nombre: 'Solicitud información a Usuario', categoria: 'IN_PROGRESS' },
  { nombre: 'Pausado', categoria: 'IN_PROGRESS' },
  { nombre: 'Cerrado', categoria: 'DONE' },
  { nombre: 'Finalizado', categoria: 'DONE' },
  { nombre: 'Cancelado', categoria: 'DONE' },
  { nombre: 'Rechazado', categoria: 'DONE' },
];

export const ESTADO_INICIAL = 'Planificado';
export const NOMBRE_WORKFLOW = 'Dashboard de tickets';
export const NOMBRE_ESQUEMA_WORKFLOW = 'Dashboard de tickets';
export const NOMBRE_PANTALLA = 'Default Screen';

export type TipoCampo = 'fecha' | 'texto';

export const TIPOS_DE_CAMPO: Record<TipoCampo, { type: string; searcherKey: string }> = {
  fecha: {
    type: 'com.atlassian.jira.plugin.system.customfieldtypes:datetime',
    searcherKey: 'com.atlassian.jira.plugin.system.customfieldtypes:datetimerange',
  },
  texto: {
    type: 'com.atlassian.jira.plugin.system.customfieldtypes:textfield',
    searcherKey: 'com.atlassian.jira.plugin.system.customfieldtypes:textsearcher',
  },
};

export const CAMPOS = {
  creada: { nombre: 'Creada (histórica)', tipo: 'fecha', variable: 'JIRA_FIELD_CREADA' },
  resuelta: { nombre: 'Resuelta (histórica)', tipo: 'fecha', variable: 'JIRA_FIELD_RESUELTA' },
  idOrigen: { nombre: 'ID origen', tipo: 'texto', variable: 'JIRA_FIELD_ID_ORIGEN' },
  tipoProyecto: {
    nombre: 'Tipo de proyecto',
    tipo: 'texto',
    variable: 'JIRA_FIELD_TIPO_PROYECTO',
  },
  responsable: {
    nombre: 'Responsable (dato)',
    tipo: 'texto',
    variable: 'JIRA_FIELD_RESPONSABLE',
  },
  informador: { nombre: 'Informador (dato)', tipo: 'texto', variable: 'JIRA_FIELD_INFORMADOR' },
  responsableProyecto: {
    nombre: 'Responsable del proyecto (dato)',
    tipo: 'texto',
    variable: 'JIRA_FIELD_RESPONSABLE_PROYECTO',
  },
} as const satisfies Record<string, { nombre: string; tipo: TipoCampo; variable: string }>;

export type ClaveCampo = keyof typeof CAMPOS;
export type IdsDeCampos = Record<ClaveCampo, string>;

/**
 * Zona horaria de las fechas del export (Argentina, UTC−3 sin horario de verano desde
 * 2009). Las fechas anonimizadas son "naive" y se envían a Jira con esta zona.
 */
export const ZONA_HORARIA = '-0300';

/** `2022-07-02 10:21` → `2022-07-02T10:21:00.000-0300` (formato de campos fecha-hora de Jira). */
export function aFechaJira(fecha: string): string {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(fecha)) {
    throw new Error('Fecha con formato inesperado en el archivo anonimizado');
  }
  return `${fecha.replace(' ', 'T')}:00.000${ZONA_HORARIA}`;
}

export function mismoNombre(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
