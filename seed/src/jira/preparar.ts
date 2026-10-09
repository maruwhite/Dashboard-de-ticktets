import { randomUUID } from 'node:crypto';
import { buscarCamposPersonalizados, type CampoJira } from './campos.js';
import { JiraError, type ClienteJira } from './cliente.js';
import {
  CAMPOS,
  ESTADO_INICIAL,
  ESTADOS,
  mismoNombre,
  NOMBRE_ESQUEMA_PANTALLAS,
  NOMBRE_ESQUEMA_TIPOS,
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
  const existentes = await buscarCamposPersonalizados(cliente);
  const campos = {} as IdsDeCampos;
  for (const [clave, definicion] of Object.entries(CAMPOS) as [
    ClaveCampo,
    (typeof CAMPOS)[ClaveCampo],
  ][]) {
    const tipo = TIPOS_DE_CAMPO[definicion.tipo];
    const existente = existentes.find((c) => mismoNombre(c.name, definicion.nombre));
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

  // 4. Workflow con los estados (crea los estados que falten)
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

  // 5. Esquema de workflow
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

  // 6. Proyectos. Van antes que los tipos de incidencia: al crearlos, Jira aplica una
  // plantilla que crea sus propios tipos (por ejemplo "Tarea"); así no se duplican.
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
  const existentesAhora = (
    await cliente.get<Pagina<Proyecto>>(`/rest/api/3/project/search?${claves}`)
  ).values;
  const asignacion = {
    cliente,
    hacer,
    proyectos: existentesAhora,
    pendientes: datos.proyectos.length - existentesAhora.length,
  };

  // 7. Tipos de incidencia globales
  log('Tipos de incidencia');
  const tipos = (await cliente.get<TipoIncidencia[]>('/rest/api/3/issuetype')).filter(
    (t) => !t.scope,
  );
  const idsTipos: string[] = [];
  for (const nombre of datos.tiposIncidencia) {
    const coincidencias = tipos.filter((t) => mismoNombre(t.name, nombre));
    if (coincidencias.length > 1) {
      throw new Error(
        `Hay ${String(coincidencias.length)} tipos de incidencia globales llamados "${nombre}"; dejá uno solo`,
      );
    }
    const id =
      coincidencias[0]?.id ??
      (
        await hacer(`Crear tipo de incidencia "${nombre}"`, () =>
          cliente.post<TipoIncidencia>('/rest/api/3/issuetype', {
            name: nombre,
            description: '',
            hierarchyLevel: nombre.toLowerCase() === 'epic' ? 1 : 0,
          }),
        )
      )?.id;
    if (id !== undefined) idsTipos.push(id);
  }

  // 8. Esquema de tipos de incidencia propio, asignado a los proyectos
  log(`Esquema de tipos "${NOMBRE_ESQUEMA_TIPOS}"`);
  const esquemasTipos = await cliente.get<Pagina<{ id: string; name: string }>>(
    '/rest/api/3/issuetypescheme?maxResults=100',
  );
  let idEsquemaTipos = esquemasTipos.values.find((e) => e.name === NOMBRE_ESQUEMA_TIPOS)?.id;
  if (idEsquemaTipos === undefined) {
    idEsquemaTipos = (
      await hacer(`Crear esquema de tipos "${NOMBRE_ESQUEMA_TIPOS}"`, () =>
        cliente.post<{ issueTypeSchemeId: string }>('/rest/api/3/issuetypescheme', {
          name: NOMBRE_ESQUEMA_TIPOS,
          description: 'Creado por el dashboard de tickets (seed)',
          issueTypeIds: idsTipos,
        }),
      )
    )?.issueTypeSchemeId;
  } else {
    const esquemaId = idEsquemaTipos;
    const enEsquemaTipos = new Set(
      (
        await cliente.get<Pagina<{ issueTypeId: string }>>(
          `/rest/api/3/issuetypescheme/mapping?issueTypeSchemeId=${esquemaId}&maxResults=100`,
        )
      ).values.map((m) => m.issueTypeId),
    );
    const faltan = idsTipos.filter((id) => !enEsquemaTipos.has(id));
    if (faltan.length > 0) {
      await hacer(
        `Agregar ${String(faltan.length)} tipos al esquema "${NOMBRE_ESQUEMA_TIPOS}"`,
        () =>
          cliente.put(`/rest/api/3/issuetypescheme/${esquemaId}/issuetype`, {
            issueTypeIds: faltan,
          }),
      );
    }
  }
  await asignarEsquema({
    ...asignacion,
    ruta: '/rest/api/3/issuetypescheme/project',
    clave: 'issueTypeScheme',
    campoId: 'issueTypeSchemeId',
    idEsquema: idEsquemaTipos,
    descripcion: `esquema de tipos "${NOMBRE_ESQUEMA_TIPOS}"`,
  });

  // 9. Pantallas: los proyectos usan el esquema por defecto, cuya pantalla tiene los campos
  log(`Esquema de pantallas "${NOMBRE_ESQUEMA_PANTALLAS}"`);
  const esquemasPantallas = await cliente.get<Pagina<{ id: string; name: string }>>(
    '/rest/api/3/issuetypescreenscheme?maxResults=100',
  );
  const idEsquemaPantallas = esquemasPantallas.values.find(
    (e) => e.name === NOMBRE_ESQUEMA_PANTALLAS,
  )?.id;
  if (idEsquemaPantallas === undefined) {
    throw new Error(`No se encontró el esquema "${NOMBRE_ESQUEMA_PANTALLAS}"`);
  }
  await asignarEsquema({
    ...asignacion,
    ruta: '/rest/api/3/issuetypescreenscheme/project',
    clave: 'issueTypeScreenScheme',
    campoId: 'issueTypeScreenSchemeId',
    idEsquema: idEsquemaPantallas,
    descripcion: `esquema de pantallas "${NOMBRE_ESQUEMA_PANTALLAS}"`,
  });

  // 10. Esquemas de campos (modelo nuevo de Jira Cloud): un campo personalizado solo se puede
  // completar en los proyectos cuyo esquema de campos lo incluye.
  log('Esquemas de campos');
  await asociarCamposAEsquemas({ ...asignacion, campos: Object.values(campos) });

  log(
    cambios === 0
      ? 'El sitio ya estaba preparado.'
      : `${String(cambios)} cambios ${confirmar ? 'aplicados' : 'pendientes'}.`,
  );
  return { campos, cambios };
}

type Hacer = <T>(descripcion: string, accion: () => Promise<T>) => Promise<T | undefined>;

interface Asignacion {
  cliente: ClienteJira;
  hacer: Hacer;
  /** Proyectos que ya existen en Jira. */
  proyectos: readonly Proyecto[];
  /** Proyectos que se crearían (solo en simulación). */
  pendientes: number;
  ruta: string;
  clave: 'issueTypeScheme' | 'issueTypeScreenScheme';
  campoId: 'issueTypeSchemeId' | 'issueTypeScreenSchemeId';
  idEsquema: string | undefined;
  descripcion: string;
}

/** Asigna un esquema a cada proyecto que no lo tenga. */
async function asignarEsquema(a: Asignacion): Promise<void> {
  if (a.proyectos.length > 0) {
    const filtro = a.proyectos.map((p) => `projectId=${p.id}`).join('&');
    const actuales = await a.cliente.get<
      Pagina<{ projectIds: string[] } & Partial<Record<Asignacion['clave'], { id: string }>>>
    >(`${a.ruta}?${filtro}`);
    for (const proyecto of a.proyectos) {
      const actual = actuales.values.find((v) => v.projectIds.includes(proyecto.id))?.[a.clave];
      if (actual !== undefined && actual.id === a.idEsquema) continue;
      await a.hacer(`Asignar ${a.descripcion} a ${proyecto.key}`, () =>
        a.cliente.put(a.ruta, { [a.campoId]: a.idEsquema, projectId: proyecto.id }),
      );
    }
  }
  if (a.pendientes > 0) {
    await a.hacer(`Asignar ${a.descripcion} a ${String(a.pendientes)} proyectos nuevos`, () =>
      Promise.resolve(),
    );
  }
}

interface AsociacionDeCampos {
  cliente: ClienteJira;
  hacer: Hacer;
  proyectos: readonly Proyecto[];
  pendientes: number;
  campos: readonly string[];
}

/**
 * Asocia los campos a los esquemas de campos de los proyectos (y al esquema por defecto, que
 * es el que recibirán los proyectos que se crearían en simulación). En sitios sin esquemas de
 * campos (modelo anterior) no hace nada.
 */
async function asociarCamposAEsquemas(a: AsociacionDeCampos): Promise<void> {
  let esquemas: Pagina<{ id: number; isDefault: boolean }>;
  try {
    esquemas = await a.cliente.get('/rest/api/3/config/fieldschemes?maxResults=50');
  } catch (error) {
    if (error instanceof JiraError && error.status === 404) {
      return; // el sitio usa configuraciones de campos (modelo anterior)
    }
    throw error;
  }

  const destino = new Set<number>();
  if (a.proyectos.length > 0) {
    const filtro = a.proyectos.map((p) => `projectId=${p.id}`).join('&');
    const deProyectos = await a.cliente.get<Pagina<{ schemeId: number }>>(
      `/rest/api/3/config/fieldschemes/projects?${filtro}`,
    );
    for (const v of deProyectos.values) destino.add(v.schemeId);
  }
  const porDefecto = esquemas.values.find((e) => e.isDefault)?.id;
  if (a.pendientes > 0 && porDefecto !== undefined) destino.add(porDefecto);

  const camposReales = a.campos.filter((id) => id !== SIN_CREAR);
  const faltan = new Set<string>(a.campos.length > camposReales.length ? [SIN_CREAR] : []);
  for (const esquema of destino) {
    const presentes = new Set<string>();
    for (let desde = 0; ;) {
      const pagina = await a.cliente.get<Pagina<{ fieldId: string }> & { isLast?: boolean }>(
        `/rest/api/3/config/fieldschemes/${String(esquema)}/fields?maxResults=50&startAt=${String(desde)}`,
      );
      for (const v of pagina.values) presentes.add(v.fieldId);
      desde += pagina.values.length;
      if (pagina.isLast !== false || pagina.values.length === 0) break;
    }
    for (const id of camposReales) if (!presentes.has(id)) faltan.add(id);
  }
  if (faltan.size === 0 || destino.size === 0) return;

  const schemeIds = [...destino];
  await a.hacer(
    `Asociar ${String(faltan.size)} campos a los esquemas de campos ${schemeIds.join(', ')}`,
    () =>
      a.cliente.put(
        '/rest/api/3/config/fieldschemes/fields',
        Object.fromEntries([...faltan].map((id) => [id, [{ schemeIds }]])),
      ),
  );
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
