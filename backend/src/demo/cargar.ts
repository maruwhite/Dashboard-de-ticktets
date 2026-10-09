import type { Ticket } from '@dashboard/shared';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { Repositorio } from '../db/repositorio.js';

/** Foto de los tickets anonimizados para el modo demo (ADR-0014). Vale desde `src` y `dist`. */
export const RUTA_DEMO = fileURLToPath(new URL('../../demo/tickets.json', import.meta.url));

const fecha = z.iso.datetime();
const texto = z.string();

const esquemaTicket = z.strictObject({
  clave: texto,
  idOrigen: texto,
  tipo: texto,
  estado: texto,
  prioridad: texto,
  proyectoClave: texto,
  proyectoNombre: texto,
  tipoProyecto: texto,
  responsable: texto,
  informador: texto,
  responsableProyecto: texto,
  titulo: texto,
  creada: fecha,
  resuelta: fecha.nullable(),
  actualizada: fecha,
  vencimiento: z.iso.date().nullable(),
});

/** Valida el contenido de la foto: si no tiene la forma esperada, falla sin cargar nada. */
export function leerTicketsDemo(contenido: string): Ticket[] {
  const resultado = z.array(esquemaTicket).safeParse(JSON.parse(contenido) as unknown);
  if (!resultado.success) {
    const [problema] = resultado.error.issues;
    throw new Error(
      `La foto de demo no es válida: ${problema?.path.join('.') ?? ''} ${problema?.message ?? ''}`.trim(),
    );
  }
  return resultado.data;
}

/** Reemplaza los tickets de la base por los de la foto y devuelve cuántos cargó. */
export async function cargarDemo(repositorio: Repositorio, ruta = RUTA_DEMO): Promise<number> {
  const tickets = leerTicketsDemo(await readFile(ruta, 'utf8'));
  repositorio.reemplazarTickets(tickets);
  return tickets.length;
}

/** Contenido del archivo de demo: estable, legible y compatible con Prettier. */
export function serializarDemo(tickets: readonly Ticket[]): string {
  return `${JSON.stringify(tickets, null, 2)}\n`;
}
