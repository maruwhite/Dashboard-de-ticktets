import { aFecha, diasEntre, formatearFecha, sumarDias } from './fechas.js';
import type { TicketExport } from './leer-export.js';
import { crearGeneradorDeTitulos } from './titulos.js';

export interface TicketAnonimizado {
  id_origen: string;
  tipo_incidencia: string;
  estado: string;
  prioridad: string;
  tipo_proyecto: string;
  proyecto_clave: string;
  proyecto_nombre: string;
  responsable: string;
  informador: string;
  responsable_proyecto: string;
  titulo: string;
  creada: string;
  resuelta: string;
}

export const COLUMNAS_SALIDA: readonly (keyof TicketAnonimizado)[] = [
  'id_origen',
  'tipo_incidencia',
  'estado',
  'prioridad',
  'tipo_proyecto',
  'proyecto_clave',
  'proyecto_nombre',
  'responsable',
  'informador',
  'responsable_proyecto',
  'titulo',
  'creada',
  'resuelta',
];

export interface OpcionesAnonimizacion {
  /** Fecha de referencia ("hoy"). */
  hoy: Date;
  /** Días antes de `hoy` en que debe quedar la fecha más reciente (1 a 7). */
  diasAntesDeHoy: number;
}

export interface ResultadoAnonimizacion {
  tickets: TicketAnonimizado[];
  personasOriginales: number;
  proyectosOriginales: number;
}

const MAX_USUARIOS = 9;
const LETRAS_GRIEGAS = [
  'Alfa', 'Beta', 'Gamma', 'Delta', 'Épsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda',
  'Mu', 'Nu', 'Xi', 'Ómicron', 'Pi', 'Rho', 'Sigma', 'Tau', 'Ípsilon', 'Phi', 'Chi', 'Psi', 'Omega',
]; // prettier-ignore

/** Ordena por cantidad de apariciones (desc.); a igual cantidad, por valor, para ser estable. */
function ordenarPorFrecuencia(valores: string[]): string[] {
  const conteo = new Map<string, number>();
  for (const valor of valores) {
    if (valor !== '') conteo.set(valor, (conteo.get(valor) ?? 0) + 1);
  }
  return [...conteo.entries()]
    .sort(([a, na], [b, nb]) => nb - na || a.localeCompare(b))
    .map(([valor]) => valor);
}

/**
 * Personas → `Usuario 1` … `Usuario 9`, con el mismo usuario para la misma persona en las
 * tres columnas. Si hay más de 9, las 8 más frecuentes tienen usuario propio y el resto
 * comparte `Usuario 9` (ADR-0010).
 */
function mapearPersonas(tickets: readonly TicketExport[]): Map<string, string> {
  const ordenadas = ordenarPorFrecuencia(
    tickets.flatMap((t) => [t.responsable, t.informador, t.responsableProyecto]),
  );
  const propios = ordenadas.length <= MAX_USUARIOS ? MAX_USUARIOS : MAX_USUARIOS - 1;
  return new Map(
    ordenadas.map((persona, i) => [persona, `Usuario ${String(Math.min(i, propios) + 1)}`]),
  );
}

function mapearProyectos(
  tickets: readonly TicketExport[],
): Map<string, { clave: string; nombre: string }> {
  const ordenados = ordenarPorFrecuencia(tickets.map((t) => t.proyectoClave));
  if (ordenados.length > LETRAS_GRIEGAS.length) {
    throw new Error(`Demasiados proyectos (${String(ordenados.length)}) para anonimizar`);
  }
  return new Map(
    ordenados.map((clave, i) => [
      clave,
      { clave: `PRJ${String.fromCharCode(65 + i)}`, nombre: `Proyecto ${LETRAS_GRIEGAS[i] ?? ''}` },
    ]),
  );
}

function normalizarEstado(estado: string): string {
  return estado.toLowerCase() === 'finalizada' ? 'Finalizado' : estado;
}

function normalizarTipo(tipo: string): string {
  return tipo.toLowerCase() === 'subtarea' ? 'Tarea' : tipo;
}

/** Offset en días enteros, distinto de 0, para que la fecha más reciente quede `dias` antes de hoy. */
function calcularOffset(fechaMasReciente: Date, hoy: Date, diasAntesDeHoy: number): number {
  const offset = diasEntre(fechaMasReciente, hoy) - diasAntesDeHoy;
  if (offset !== 0) return offset;
  // Con offset 0 las fechas quedarían iguales a las reales: se corre un día más.
  return diasAntesDeHoy < 7 ? offset - 1 : offset + 1;
}

export function anonimizar(
  tickets: readonly TicketExport[],
  opciones: OpcionesAnonimizacion,
): ResultadoAnonimizacion {
  if (tickets.length === 0) throw new Error('El export no tiene tickets');

  const conFechas = tickets.map((ticket, orden) => ({
    ticket,
    orden,
    creada: aFecha(ticket.creada),
    resuelta: ticket.resuelta === null ? null : aFecha(ticket.resuelta),
  }));

  const masReciente = new Date(
    Math.max(
      ...conFechas.flatMap((t) => [t.creada, t.resuelta ?? t.creada].map((f) => f.getTime())),
    ),
  );
  const offset = calcularOffset(masReciente, opciones.hoy, opciones.diasAntesDeHoy);

  const personas = mapearPersonas(tickets);
  const proyectos = mapearProyectos(tickets);
  const titulo = crearGeneradorDeTitulos();
  const persona = (nombre: string) => personas.get(nombre) ?? '';

  const ordenados = [...conFechas].sort(
    (a, b) => a.creada.getTime() - b.creada.getTime() || a.orden - b.orden,
  );
  const ancho = Math.max(3, String(ordenados.length).length);

  const salida = ordenados.map(({ ticket, creada, resuelta }, i): TicketAnonimizado => {
    const proyecto = proyectos.get(ticket.proyectoClave);
    const tipo = normalizarTipo(ticket.tipoIncidencia);
    return {
      id_origen: `T-${String(i + 1).padStart(ancho, '0')}`,
      tipo_incidencia: tipo,
      estado: normalizarEstado(ticket.estado),
      prioridad: ticket.prioridad,
      tipo_proyecto: ticket.tipoProyecto,
      proyecto_clave: proyecto?.clave ?? '',
      proyecto_nombre: proyecto?.nombre ?? '',
      responsable: persona(ticket.responsable),
      informador: persona(ticket.informador),
      responsable_proyecto: persona(ticket.responsableProyecto),
      titulo: titulo(tipo),
      creada: formatearFecha(sumarDias(creada, offset)),
      resuelta: resuelta === null ? '' : formatearFecha(sumarDias(resuelta, offset)),
    };
  });

  return {
    tickets: salida,
    personasOriginales: personas.size,
    proyectosOriginales: proyectos.size,
  };
}

/**
 * Cuenta celdas de la salida que contienen algún valor sensible del original (personas,
 * proyectos, títulos, claves). Devuelve solo la cantidad: nunca los valores.
 */
export function contarFugas(
  salida: readonly TicketAnonimizado[],
  originales: readonly TicketExport[],
): number {
  const conservados = new Set(
    originales.flatMap((t) => [t.tipoIncidencia, t.estado, t.prioridad, t.tipoProyecto]),
  );
  const sensibles = new Set(
    originales
      .flatMap((t) => [
        t.responsable,
        t.informador,
        t.responsableProyecto,
        t.proyectoClave,
        t.proyectoNombre,
        t.resumen,
        t.clave,
      ])
      .filter((valor) => valor.length >= 3 && !conservados.has(valor)),
  );

  let fugas = 0;
  for (const ticket of salida) {
    for (const columna of COLUMNAS_SALIDA) {
      const celda = ticket[columna];
      for (const valor of sensibles) {
        if (celda.includes(valor)) {
          fugas++;
          break;
        }
      }
    }
  }
  return fugas;
}
