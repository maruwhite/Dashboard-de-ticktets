import type { CampoPersonalizado } from '../config.js';
import type { IssueJira } from './cliente.js';

/** Ticket tal como se guarda en SQLite. Fechas en ISO 8601 UTC. */
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

/** Campos nativos que el sync pide a Jira, además de los personalizados. */
export const CAMPOS_NATIVOS = [
  'summary',
  'status',
  'issuetype',
  'priority',
  'project',
  'assignee',
  'reporter',
  'created',
  'updated',
  'resolutiondate',
  'duedate',
] as const;

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

/** `name` o `displayName` de un objeto de Jira (estado, tipo, usuario…). */
function nombre(valor: unknown): string {
  if (valor === null || typeof valor !== 'object') return '';
  const objeto = valor as { name?: unknown; displayName?: unknown };
  return texto(objeto.name) || texto(objeto.displayName);
}

/** Fecha-hora de Jira (`2022-07-02T10:21:00.000-0300`) → ISO UTC. Inválida o vacía → null. */
export function fechaIso(valor: unknown): string | null {
  const crudo = texto(valor);
  if (crudo === '') return null;
  const fecha = new Date(crudo.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
}

/**
 * Convierte un issue de Jira en un Ticket. Usa los campos personalizados de la carga
 * (fechas históricas, personas "(dato)") y, si un ticket no los tiene —por ejemplo, uno
 * creado a mano en Jira después de la carga—, cae en los campos nativos equivalentes.
 */
export function aTicket(issue: IssueJira, campos: Record<CampoPersonalizado, string>): Ticket {
  const f = issue.fields;
  const proyecto = (f.project ?? {}) as { key?: unknown; name?: unknown; projectTypeKey?: unknown };
  const creada = fechaIso(f[campos.creada]) ?? fechaIso(f.created);
  const actualizada = fechaIso(f.updated);

  return {
    clave: issue.key,
    idOrigen: texto(f[campos.idOrigen]),
    tipo: nombre(f.issuetype),
    estado: nombre(f.status),
    prioridad: nombre(f.priority),
    proyectoClave: texto(proyecto.key),
    proyectoNombre: texto(proyecto.name),
    tipoProyecto: texto(f[campos.tipoProyecto]) || texto(proyecto.projectTypeKey),
    responsable: texto(f[campos.responsable]) || nombre(f.assignee),
    informador: texto(f[campos.informador]) || nombre(f.reporter),
    responsableProyecto: texto(f[campos.responsableProyecto]),
    titulo: texto(f.summary),
    creada: creada ?? '',
    resuelta: fechaIso(f[campos.resuelta]) ?? fechaIso(f.resolutiondate),
    actualizada: actualizada ?? creada ?? '',
    vencimiento: /^\d{4}-\d{2}-\d{2}$/.test(texto(f.duedate)) ? texto(f.duedate) : null,
  };
}
