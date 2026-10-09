import { DIMENSIONES, type Dimension, type Filtros } from '@dashboard/shared';
import { z } from 'zod';

const MAX_VALORES = 100;
const MAX_LARGO = 200;

/** Un parámetro puede venir una vez (`?a=1`) o repetido (`?a=1&a=2`). */
const valores = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : [v]))
  .pipe(
    z
      .array(z.string().max(MAX_LARGO, `cada valor admite hasta ${String(MAX_LARGO)} caracteres`))
      .max(MAX_VALORES, `admite hasta ${String(MAX_VALORES)} valores`),
  );

const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'debe tener el formato AAAA-MM-DD')
  .refine((texto) => {
    const valor = new Date(`${texto}T00:00:00Z`);
    return !Number.isNaN(valor.getTime()) && valor.toISOString().startsWith(texto);
  }, 'no es una fecha válida');

const esquema = z
  .strictObject({
    ...(Object.fromEntries(DIMENSIONES.map((d) => [d, valores.optional()])) as Record<
      Dimension,
      z.ZodOptional<typeof valores>
    >),
    desde: fecha.optional(),
    hasta: fecha.optional(),
  })
  .refine((f) => f.desde === undefined || f.hasta === undefined || f.desde <= f.hasta, {
    message: '"desde" no puede ser posterior a "hasta"',
    path: ['desde'],
  });

export type ResultadoFiltros = { ok: true; filtros: Filtros } | { ok: false; error: string };

/** Valida y convierte la query string en Filtros. El error nombra el parámetro. */
export function parsearFiltros(query: unknown): ResultadoFiltros {
  const resultado = esquema.safeParse(query);
  if (!resultado.success) {
    const [problema] = resultado.error.issues;
    const parametro =
      problema?.code === 'unrecognized_keys'
        ? problema.keys.join(', ')
        : String(problema?.path[0] ?? '');
    const mensaje =
      problema?.code === 'unrecognized_keys' ? 'parámetro desconocido' : problema?.message;
    return { ok: false, error: `Filtro inválido: ${parametro} (${mensaje ?? 'inválido'})` };
  }

  const filtros: Filtros = {};
  for (const [clave, valor] of Object.entries(resultado.data)) {
    if (valor !== undefined) Object.assign(filtros, { [clave]: valor });
  }
  return { ok: true, filtros };
}
