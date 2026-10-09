import { randomUUID } from 'node:crypto';
import type { ClienteJira } from './cliente.js';
import {
  CAMPOS,
  ESTADO_INICIAL,
  ESTADOS,
  mismoNombre,
  NOMBRE_ESQUEMA_WORKFLOW,
  NOMBRE_PANTALLA,
  NOMBRE_WORKFLOW,
  TIPOS_DE_CAMPO,
  type CategoriaEstado,
  type ClaveCampo,
  type IdsDeCampos,
} from './definicion.js';

// Formas mínimas de las respuestas de Jira que se usan.
interface Pagina<T> {
  values: T[];
}
interface CampoJira {
  id: string;
  name: string;
  custom: boolean;
  schema?: { custom?: string };
}
interface Pantalla {
  id: number;
  name: string;
}
interface Pestania {
  id: number;
}
interface CampoDePantalla {
  id: string;
}
interface Prioridad {
  id: string;
  name: string;
}
interface EsquemaDePrioridad {
  id: string;
  isDefault: boolean;
}
interface TipoIncidencia {
  id: string;
  name: string;
  scope?: unknown;
}
interface EstadoJira {
  id: string;
  name: string;
  statusCategory: CategoriaEstado;
}
interface EsquemaDeWorkflow {
  id: number;
  name: string;
}
interface Proyecto {
  id: string;
  key: string;
}
interface ErrorDeValidacion {
  level: string;
  message: string;
}

export interface DatosPreparar {
  proyectos: readonly { clave: string; nombre: string }[];
  tiposIncidencia: readonly string[];
  prioridades: readonly string[];
}

export interface OpcionesPreparar {
  confirmar: boolean;
  log: (mensaje: string) => void;
}

export interface ResultadoPreparar {
  campos: IdsDeCampos;
  cambios: number;
}

const SIN_CREAR = '(se crearía)';
const enc = encodeURIComponent;

/**
 * Deja el sitio listo para la carga. Es idempotente: cada paso consulta qué existe y crea
 * solo lo que falta. Sin `confirmar` no escribe nada (modo simulación).
 */
export async function preparar(
  cliente: ClienteJira,
  datos: DatosPreparar,
  opciones: OpcionesPreparar,
): Promise<ResultadoPreparar> {
  const { confirmar, log } = opciones;
  let cambios = 0;
  const hacer = async <T>(
    descripcion: string,
    accion: () => Promise<T>,
  ): Promise<T | undefined> => {
    cambios++;
    if (!confirmar) {
      log(`  [simulación] ${descripcion}`);
      return undefined;
    }
    log(`  ${descripcion}`);
    return accion();
  };

  // 1. Campos personalizados
  log('Campos personalizados');
  const existentes = await cliente.get<CampoJira[]>('/rest/api/3/field');
  const campos = {} as IdsDeCampos;
  for (const [clave, definicion] of Object.entries(CAMPOS) as [
    ClaveCampo,
    (typeof CAMPOS)[ClaveCampo],
  ][]) {
    const tipo = TIPOS_DE_CAMPO[definicion.tipo];
    const existente = existentes.find((c) => c.custom && mismoNombre(c.name, definicion.nombre));
    if (existente) {
      if (existente.schema?.custom !== tipo.type) {
        throw new Error(
          `El campo "${definicion.nombre}" ya existe con otro tipo; renombralo o borralo`,
        );
      }
      campos[clave] = existente.id;
      continue;
    }
    const creado = await hacer(`Crear campo "${definicion.nombre}"`, () =>
      cliente.post<CampoJira>('/rest/api/3/field', {
        name: definicion.nombre,
        description: 'Creado por el dashboard de tickets (seed)',
        ...tipo,
      }),
    );
    campos[clave] = creado?.id ?? SIN_CREAR;
  }

  // 2. Campos en la pantalla por defecto (sin esto Jira no permite completarlos por API)
  log(`Pantalla "${NOMBRE_PANTALLA}"`);
  const pantallas = await cliente.get<Pagina<Pantalla>>(
    `/rest/api/3/screens?maxResults=100&queryString=${enc(NOMBRE_PANTALLA)}`,
  );
  const pantalla = pantallas.values.find((p) => p.name === NOMBRE_PANTALLA);
  if (!pantalla) throw new Error(`No se encontró la pantalla "${NOMBRE_PANTALLA}"`);
  const [pestania] = await cliente.get<Pestania[]>(
    `/rest/api/3/screens/${String(pantalla.id)}/tabs`,
  );
  if (!pestania) throw new Error(`La pantalla "${NOMBRE_PANTALLA}" no tiene pestañas`);
  const rutaCampos = `/rest/api/3/screens/${String(pantalla.id)}/tabs/${String(pestania.id)}/fields`;
  const enPantalla = new Set((await cliente.get<CampoDePantalla[]>(rutaCampos)).map((c) => c.id));
  for (const [clave, id] of Object.entries(campos) as [ClaveCampo, string][]) {
    if (!enPantalla.has(id)) {
      await hacer(`Agregar "${CAMPOS[clave].nombre}" a la pantalla`, () =>
        cliente.post(rutaCampos, { fieldId: id }),
      );
    }
  }

  // 3. Prioridades
  log('Prioridades');
  const prioridades = await cliente.get<Pagina<Prioridad>>(
    '/rest/api/3/priority/search?maxResults=100',
  );
  const esquemas = await cliente.get<Pagina<EsquemaDePrioridad>>(
    '/rest/api/3/priorityscheme?maxResults=50',
  );
  const esquemaPorDefecto = esquemas.values.find((e) => e.isDefault);
  const enEsquema = esquemaPorDefecto
    ? new Set(
        (
          await cliente.get<Pagina<Prioridad>>(
            `/rest/api/3/priorityscheme/${esquemaPorDefecto.id}/priorities?maxResults=100`,
          )
        ).values.map((p) => p.id),
      )
    : new Set<string>();
  for (const nombre of datos.prioridades) {
    let id = prioridades.values.find((p) => mismoNombre(p.name, nombre))?.id;
    id ??= (
      await hacer(`Crear prioridad "${nombre}"`, () =>
        cliente.post<{ id: string }>('/rest/api/3/priority', {
          name: nombre,
          statusColor: '#FFAB00',
          iconUrl: '/images/icons/priorities/medium.svg',
        }),
      )
    )?.id;
    if (esquemaPorDefecto && (id === undefined || !enEsquema.has(id))) {
      await hacer(`Agregar la prioridad "${nombre}" al esquema por defecto`, () =>
        cliente.put(`/rest/api/3/priorityscheme/${esquemaPorDefecto.id}`, {
          priorities: { add: { ids: [Number(id)] } },
        }),
      );
    }
  }

  // 4. Tipos de incidencia (globales)
  log('Tipos de incidencia');
  const tipos = (await cliente.get<TipoIncidencia[]>('/rest/api/3/issuetype')).filter(
    (t) => !t.scope,
  );
  for (const nombre of datos.tiposIncidencia) {
    if (!tipos.some((t) => mismoNombre(t.name, nombre))) {
      await hacer(`Crear tipo de incidencia "${nombre}"`, () =>
        cliente.post('/rest/api/3/issuetype', { name: nombre, description: '', hierarchyLevel: 0 }),
      );
    }
  }

  // 5. Workflow con los estados (crea los estados que falten)
  log(`Workflow "${NOMBRE_WORKFLOW}"`);
  const workflows = await cliente.get<Pagina<{ name: string }>>(
    `/rest/api/3/workflows/search?maxResults=50&queryString=${enc(NOMBRE_WORKFLOW)}`,
  );
  if (!workflows.values.some((w) => w.name === NOMBRE_WORKFLOW)) {
    const estados = await cliente.get<Pagina<EstadoJira>>(
      '/rest/api/3/statuses/search?maxResults=200',
    );
    const pedido = armarPedidoDeWorkflow(estados.values);
    const validacion = await cliente.post<{ errors?: ErrorDeValidacion[] }>(
      '/rest/api/3/workflows/create/validation',
      { payload: pedido, validationOptions: { levels: ['ERROR'] } },
    );
    const errores = (validacion.errors ?? []).filter((e) => e.level === 'ERROR');
    if (errores.length > 0) {
      throw new Error(`Jira rechazó el workflow: ${errores.map((e) => e.message).join('; ')}`);
    }
    log('  Workflow validado por Jira');
    await hacer(`Crear workflow "${NOMBRE_WORKFLOW}" con ${String(ESTADOS.length)} estados`, () =>
      cliente.post('/rest/api/3/workflows/create', pedido),
    );
  }

  // 6. Esquema de workflow
  log(`Esquema de workflow "${NOMBRE_ESQUEMA_WORKFLOW}"`);
  const esquemasWorkflow = await cliente.get<Pagina<EsquemaDeWorkflow>>(
    '/rest/api/3/workflowscheme?maxResults=50',
  );
  let idEsquema = esquemasWorkflow.values.find((e) => e.name === NOMBRE_ESQUEMA_WORKFLOW)?.id;
  idEsquema ??= (
    await hacer(`Crear esquema de workflow "${NOMBRE_ESQUEMA_WORKFLOW}"`, () =>
      cliente.post<EsquemaDeWorkflow>('/rest/api/3/workflowscheme', {
        name: NOMBRE_ESQUEMA_WORKFLOW,
        description: 'Creado por el dashboard de tickets (seed)',
        defaultWorkflow: NOMBRE_WORKFLOW,
      }),
    )
  )?.id;

  // 7. Proyectos
  log('Proyectos');
  const claves = datos.proyectos.map((p) => `keys=${enc(p.clave)}`).join('&');
  const proyectos = await cliente.get<Pagina<Proyecto>>(`/rest/api/3/project/search?${claves}`);
  const yo = await cliente.get<{ accountId: string }>('/rest/api/3/myself');
  for (const proyecto of datos.proyectos) {
    if (proyectos.values.some((p) => p.key === proyecto.clave)) continue;
    await hacer(`Crear proyecto ${proyecto.clave} "${proyecto.nombre}"`, () =>
      cliente.post('/rest/api/3/project', {
        key: proyecto.clave,
        name: proyecto.nombre,
        description: 'Datos anonimizados para el dashboard de tickets',
        projectTypeKey: 'software',
        leadAccountId: yo.accountId,
        assigneeType: 'UNASSIGNED',
        workflowScheme: idEsquema,
      }),
    );
  }

  log(
    cambios === 0
      ? 'El sitio ya estaba preparado.'
      : `${String(cambios)} cambios ${confirmar ? 'aplicados' : 'pendientes'}.`,
  );
  return { campos, cambios };
}

/**
 * Pedido para `POST /rest/api/3/workflows/create`: reutiliza los estados globales que ya
 * existen (por nombre) y crea los que falten. Todas las transiciones son globales, para poder
 * llevar cada ticket directo a su estado.
 */
export function armarPedidoDeWorkflow(existentes: readonly EstadoJira[]): unknown {
  const estados = ESTADOS.map((estado) => {
    const existente = existentes.find((e) => mismoNombre(e.name, estado.nombre));
    return existente
      ? {
          id: existente.id,
          name: existente.name,
          statusCategory: existente.statusCategory,
          statusReference: existente.id,
        }
      : { name: estado.nombre, statusCategory: estado.categoria, statusReference: randomUUID() };
  });
  const referencia = (nombre: string) =>
    estados.find((e) => mismoNombre(e.name, nombre))?.statusReference ?? '';

  return {
    scope: { type: 'GLOBAL' },
    statuses: estados.map((e) => ({ ...e, description: '' })),
    workflows: [
      {
        name: NOMBRE_WORKFLOW,
        description: 'Workflow del dashboard de tickets: transiciones globales a cada estado',
        startPointLayout: { x: -100, y: 0 },
        statuses: estados.map((e, i) => ({
          statusReference: e.statusReference,
          layout: { x: (i % 5) * 220, y: Math.floor(i / 5) * 160 },
          properties: {},
        })),
        transitions: [
          {
            id: '1',
            name: 'Crear',
            type: 'INITIAL',
            toStatusReference: referencia(ESTADO_INICIAL),
            links: [],
            actions: [],
            validators: [],
            triggers: [],
            properties: {},
          },
          ...estados.map((e, i) => ({
            id: String(11 + i * 10),
            name: e.name,
            type: 'GLOBAL',
            toStatusReference: e.statusReference,
            links: [],
            actions: [],
            validators: [],
            triggers: [],
            properties: {},
          })),
        ],
      },
    ],
  };
}
