import { DIMENSIONES, type Dimension, type Filtros, type Opcion } from '@dashboard/shared';

/** Lee los filtros de la query string (mismos parámetros que la API). Ignora lo desconocido. */
export function filtrosDesdeUrl(search: string): Filtros {
  const params = new URLSearchParams(search);
  const filtros: Filtros = {};
  for (const dimension of DIMENSIONES) {
    const valores = params.getAll(dimension);
    if (valores.length > 0) filtros[dimension] = valores;
  }
  const desde = params.get('desde');
  const hasta = params.get('hasta');
  if (desde) filtros.desde = desde;
  if (hasta) filtros.hasta = hasta;
  return filtros;
}

/** Query string para la URL y para la API: `?proyecto=PRJA&proyecto=PRJB&desde=…` o vacío. */
export function filtrosAUrl(filtros: Filtros): string {
  const params = new URLSearchParams();
  for (const dimension of DIMENSIONES) {
    for (const valor of filtros[dimension] ?? []) params.append(dimension, valor);
  }
  if (filtros.desde) params.set('desde', filtros.desde);
  if (filtros.hasta) params.set('hasta', filtros.hasta);
  const texto = params.toString();
  return texto === '' ? '' : `?${texto}`;
}

/** Copia de los filtros sin una clave. */
function sin(filtros: Filtros, clave: keyof Filtros): Filtros {
  return Object.fromEntries(Object.entries(filtros).filter(([k]) => k !== clave));
}

/** Devuelve una copia con los valores de la dimensión reemplazados (vacío = sin filtro). */
export function conValores(
  filtros: Filtros,
  dimension: Dimension,
  valores: readonly string[],
): Filtros {
  return valores.length === 0 ? sin(filtros, dimension) : { ...filtros, [dimension]: valores };
}

/** Agrega el valor si no estaba; lo quita si estaba (clic en un gráfico). */
export function alternarValor(filtros: Filtros, dimension: Dimension, valor: string): Filtros {
  const actuales = filtros[dimension] ?? [];
  return conValores(
    filtros,
    dimension,
    actuales.includes(valor) ? actuales.filter((v) => v !== valor) : [...actuales, valor],
  );
}

export function conFecha(filtros: Filtros, campo: 'desde' | 'hasta', valor: string): Filtros {
  return valor === '' ? sin(filtros, campo) : { ...filtros, [campo]: valor };
}

export function hayFiltros(filtros: Filtros): boolean {
  return filtrosAUrl(filtros) !== '';
}

export const NOMBRES_DIMENSION: Record<Dimension, string> = {
  proyecto: 'Proyecto',
  tipoProyecto: 'Tipo de proyecto',
  tipoIncidencia: 'Tipo de incidencia',
  estado: 'Estado',
  prioridad: 'Prioridad',
  responsable: 'Responsable',
  informador: 'Informador',
  responsableProyecto: 'Responsable del proyecto',
};

export interface Chip {
  clave: string;
  texto: string;
  quitar: (filtros: Filtros) => Filtros;
}

/** Un chip por cada valor filtrado, con la etiqueta que muestran las opciones. */
export function chipsDeFiltros(
  filtros: Filtros,
  opciones: Partial<Record<Dimension, readonly Opcion[]>>,
): Chip[] {
  const chips: Chip[] = [];
  for (const dimension of DIMENSIONES) {
    for (const valor of filtros[dimension] ?? []) {
      const etiqueta =
        opciones[dimension]?.find((o) => o.valor === valor)?.etiqueta ?? (valor || '(sin dato)');
      chips.push({
        clave: `${dimension}:${valor}`,
        texto: `${NOMBRES_DIMENSION[dimension]}: ${etiqueta}`,
        quitar: (f) => alternarValor(f, dimension, valor),
      });
    }
  }
  for (const campo of ['desde', 'hasta'] as const) {
    const valor = filtros[campo];
    if (valor) {
      chips.push({
        clave: campo,
        texto: `${campo === 'desde' ? 'Desde' : 'Hasta'}: ${valor.split('-').reverse().join('/')}`,
        quitar: (f) => conFecha(f, campo, ''),
      });
    }
  }
  return chips;
}
