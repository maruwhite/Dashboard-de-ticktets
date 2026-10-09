import type { TicketAnonimizado } from '../anonimizar/anonimizar.js';
import { JiraError, type ClienteJira } from './cliente.js';
import {
  aFechaJira,
  CAMPOS,
  ESTADO_INICIAL,
  mismoNombre,
  type ClaveCampo,
  type IdsDeCampos,
} from './definicion.js';

interface CampoJira {
  id: string;
  name: string;
  custom: boolean;
}
interface TipoIncidencia {
  id: string;
  name: string;
  scope?: unknown;
}
interface Pagina<T> {
  values: T[];
}
interface ResultadoBusqueda {
  issues: { key: string; fields: Record<string, unknown> }[];
  nextPageToken?: string;
}
interface ResultadoBulk {
  issues: { key: string }[];
  errors: {
    failedElementNumber: number;
    elementErrors?: { errorMessages?: string[]; errors?: Record<string, string> };
  }[];
}
interface Transicion {
  id: string;
  to: { name: string };
}

export interface OpcionesCargar {
  confirmar: boolean;
  log: (mensaje: string) => void;
  tamanioLote?: number;
}

export interface ResumenCarga {
  total: number;
  yaExistian: number;
  creados: number;
  transicionados: number;
  errores: number;
}

/** Ticket ya presente en Jira: clave y estado actual. */
interface EnJira {
  clave: string;
  estado: string;
}

function camposParaCrear(
  ticket: TicketAnonimizado,
  campos: IdsDeCampos,
  idTipo: string,
): Record<string, unknown> {
  const textos: [ClaveCampo, string][] = [
    ['idOrigen', ticket.id_origen],
    ['tipoProyecto', ticket.tipo_proyecto],
    ['responsable', ticket.responsable],
    ['informador', ticket.informador],
    ['responsableProyecto', ticket.responsable_proyecto],
  ];
  return {
    project: { key: ticket.proyecto_clave },
    issuetype: { id: idTipo },
    summary: ticket.titulo,
    ...(ticket.prioridad === '' ? {} : { priority: { name: ticket.prioridad } }),
    [campos.creada]: aFechaJira(ticket.creada),
    ...(ticket.resuelta === '' ? {} : { [campos.resuelta]: aFechaJira(ticket.resuelta) }),
    ...Object.fromEntries(
      textos.filter(([, valor]) => valor !== '').map(([clave, valor]) => [campos[clave], valor]),
    ),
  };
}

/**
 * Carga los tickets anonimizados en Jira. Idempotente: los tickets se identifican por el campo
 * "ID origen"; los que ya existen no se duplican, solo se completa su transición si quedó
 * pendiente. Sin `confirmar` no escribe nada.
 */
export async function cargar(
  cliente: ClienteJira,
  tickets: readonly TicketAnonimizado[],
  opciones: OpcionesCargar,
): Promise<ResumenCarga> {
  const { confirmar, log } = opciones;
  const tamanioLote = opciones.tamanioLote ?? 50;
  const resumen: ResumenCarga = {
    total: tickets.length,
    yaExistian: 0,
    creados: 0,
    transicionados: 0,
    errores: 0,
  };

  // Configuración necesaria (la crea jira:preparar)
  const camposJira = await cliente.get<CampoJira[]>('/rest/api/3/field');
  const campos = {} as IdsDeCampos;
  const faltantes: string[] = [];
  for (const [clave, definicion] of Object.entries(CAMPOS) as [
    ClaveCampo,
    (typeof CAMPOS)[ClaveCampo],
  ][]) {
    const id = camposJira.find((c) => c.custom && mismoNombre(c.name, definicion.nombre))?.id;
    if (id) campos[clave] = id;
    else faltantes.push(`campo "${definicion.nombre}"`);
  }
  const tipos = (await cliente.get<TipoIncidencia[]>('/rest/api/3/issuetype')).filter(
    (t) => !t.scope,
  );
  for (const nombre of new Set(tickets.map((t) => t.tipo_incidencia))) {
    if (!tipos.some((t) => mismoNombre(t.name, nombre))) faltantes.push(`tipo "${nombre}"`);
  }
  const clavesProyecto = [...new Set(tickets.map((t) => t.proyecto_clave))];
  const proyectos = await cliente.get<Pagina<{ key: string }>>(
    `/rest/api/3/project/search?${clavesProyecto.map((c) => `keys=${encodeURIComponent(c)}`).join('&')}`,
  );
  for (const clave of clavesProyecto) {
    if (!proyectos.values.some((p) => p.key === clave)) faltantes.push(`proyecto ${clave}`);
  }

  if (faltantes.length > 0) {
    const mensaje = `Falta configuración en Jira (${faltantes.join(', ')}). Corré primero jira:preparar.`;
    if (confirmar) throw new Error(mensaje);
    log(mensaje);
    log(`[simulación] Se crearían ${String(tickets.length)} tickets.`);
    return resumen;
  }

  // Tickets que ya están en Jira, por "ID origen"
  const enJira = new Map<string, EnJira>();
  let nextPageToken: string | undefined;
  do {
    const pagina: ResultadoBusqueda = await cliente.post('/rest/api/3/search/jql', {
      jql: `project in (${clavesProyecto.join(', ')}) ORDER BY key ASC`,
      fields: [campos.idOrigen, 'status'],
      maxResults: 100,
      ...(nextPageToken ? { nextPageToken } : {}),
    });
    for (const issue of pagina.issues) {
      const idOrigen = issue.fields[campos.idOrigen];
      const estado = (issue.fields.status as { name?: string } | undefined)?.name ?? '';
      if (typeof idOrigen === 'string') enJira.set(idOrigen, { clave: issue.key, estado });
    }
    nextPageToken = pagina.nextPageToken;
  } while (nextPageToken);

  const nuevos = tickets.filter((t) => !enJira.has(t.id_origen));
  resumen.yaExistian = tickets.length - nuevos.length;
  const pendientes = tickets.filter((t) => {
    const actual = enJira.get(t.id_origen);
    return actual ? !mismoNombre(actual.estado, t.estado) : !mismoNombre(t.estado, ESTADO_INICIAL);
  });

  log(
    `${String(tickets.length)} tickets en el archivo: ${String(resumen.yaExistian)} ya están en Jira, ` +
      `${String(nuevos.length)} por crear, ${String(pendientes.length)} por llevar a su estado.`,
  );
  if (!confirmar) {
    log('[simulación] No se escribió nada. Para cargar de verdad agregá --confirmar.');
    return resumen;
  }

  // Creación en lotes
  const idTipo = (nombre: string) => tipos.find((t) => mismoNombre(t.name, nombre))?.id ?? '';
  for (let inicio = 0; inicio < nuevos.length; inicio += tamanioLote) {
    const lote = nuevos.slice(inicio, inicio + tamanioLote);
    const respuesta = await cliente.post<ResultadoBulk>('/rest/api/3/issue/bulk', {
      issueUpdates: lote.map((t) => ({
        fields: camposParaCrear(t, campos, idTipo(t.tipo_incidencia)),
      })),
    });
    const fallidos = new Map(respuesta.errors.map((e) => [e.failedElementNumber, e]));
    let creado = 0;
    lote.forEach((ticket, i) => {
      const error = fallidos.get(i);
      const issue = error ? undefined : respuesta.issues[creado++];
      if (issue) {
        enJira.set(ticket.id_origen, { clave: issue.key, estado: ESTADO_INICIAL });
        resumen.creados++;
      } else {
        resumen.errores++;
        const detalle = [
          ...(error?.elementErrors?.errorMessages ?? []),
          ...Object.entries(error?.elementErrors?.errors ?? {}).map(([c, m]) => `${c}: ${m}`),
        ].join('; ');
        log(`  Error al crear ${ticket.id_origen}: ${detalle || 'sin detalle'}`);
      }
    });
    log(`  Creados ${String(resumen.creados)}/${String(nuevos.length)}`);
  }

  // Transiciones al estado final
  const transicionPorEstado = new Map<string, string>();
  let procesados = 0;
  for (const ticket of pendientes) {
    const actual = enJira.get(ticket.id_origen);
    if (!actual) continue; // falló la creación: ya se contó el error
    const destino = ticket.estado.trim().toLowerCase();
    try {
      if (!transicionPorEstado.has(destino)) {
        const { transitions } = await cliente.get<{ transitions: Transicion[] }>(
          `/rest/api/3/issue/${actual.clave}/transitions`,
        );
        for (const t of transitions) transicionPorEstado.set(t.to.name.trim().toLowerCase(), t.id);
      }
      const id = transicionPorEstado.get(destino);
      if (id === undefined) throw new Error(`no hay transición hacia "${ticket.estado}"`);
      await cliente.post(`/rest/api/3/issue/${actual.clave}/transitions`, { transition: { id } });
      resumen.transicionados++;
    } catch (error) {
      resumen.errores++;
      const detalle =
        error instanceof JiraError || error instanceof Error ? error.message : 'desconocido';
      log(`  Error al mover ${ticket.id_origen} a "${ticket.estado}": ${detalle}`);
    }
    if (++procesados % 25 === 0)
      log(`  Estados aplicados ${String(procesados)}/${String(pendientes.length)}`);
  }

  log(
    `Listo: ${String(resumen.creados)} creados, ${String(resumen.transicionados)} movidos a su estado, ` +
      `${String(resumen.yaExistian)} ya existían, ${String(resumen.errores)} errores.`,
  );
  return resumen;
}
