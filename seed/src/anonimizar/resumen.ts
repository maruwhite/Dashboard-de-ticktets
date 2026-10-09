import type { TicketAnonimizado } from './anonimizar.js';

export interface DatosResumen {
  tickets: readonly TicketAnonimizado[];
  personasOriginales: number;
  proyectosOriginales: number;
  columnasDescartadas: readonly string[];
  generado: Date;
}

function tablaDeConteo(titulo: string, valores: readonly string[]): string {
  const conteo = new Map<string, number>();
  for (const valor of valores) {
    const clave = valor === '' ? '(vacío)' : valor;
    conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
  }
  const filas = [...conteo.entries()]
    .sort(([a, na], [b, nb]) => nb - na || a.localeCompare(b))
    .map(([valor, cantidad]) => `| ${valor} | ${String(cantidad)} |`);
  return [`### ${titulo}`, '', '| Valor | Tickets |', '| --- | --- |', ...filas, ''].join('\n');
}

/** Resumen en Markdown para que Marisa revise la anonimización antes de cargar a Jira. */
export function generarResumen(datos: DatosResumen): string {
  const { tickets } = datos;
  const fechas = tickets
    .flatMap((t) => [t.creada, t.resuelta])
    .filter((f) => f !== '')
    .sort();
  const columna = (nombre: keyof TicketAnonimizado) => tickets.map((t) => t[nombre]);

  return [
    '# Resumen de la anonimización',
    '',
    `- Generado: ${datos.generado.toISOString().slice(0, 16).replace('T', ' ')} (UTC)`,
    `- Tickets: ${String(tickets.length)}`,
    `- Tickets resueltos (con fecha de resolución): ${String(tickets.filter((t) => t.resuelta !== '').length)}`,
    `- Personas distintas en el original: ${String(datos.personasOriginales)} → usuarios inventados: ${String(new Set([...columna('responsable'), ...columna('informador'), ...columna('responsable_proyecto')].filter((v) => v !== '')).size)}`,
    `- Proyectos: ${String(datos.proyectosOriginales)}`,
    `- Rango de fechas (ya corridas): ${fechas[0] ?? '-'} → ${fechas.at(-1) ?? '-'}`,
    '',
    '## Qué revisar',
    '',
    '- [ ] Abrir `tickets.csv` y confirmar que no aparece ningún nombre, mail, cliente, proyecto ni título real.',
    '- [ ] Confirmar que los conteos por estado, tipo y proyecto coinciden con lo esperado.',
    '- [ ] Confirmar que las fechas se ven razonables (la más reciente, pocos días antes de hoy).',
    '',
    '## Conteos',
    '',
    tablaDeConteo('Estado', columna('estado')),
    tablaDeConteo('Tipo de incidencia', columna('tipo_incidencia')),
    tablaDeConteo('Proyecto', columna('proyecto_nombre')),
    tablaDeConteo('Tipo de proyecto', columna('tipo_proyecto')),
    tablaDeConteo('Prioridad', columna('prioridad')),
    tablaDeConteo('Responsable', columna('responsable')),
    tablaDeConteo('Informador', columna('informador')),
    tablaDeConteo('Responsable del proyecto', columna('responsable_proyecto')),
    '## Columnas del export que se descartaron',
    '',
    ...datos.columnasDescartadas.map((nombre) => `- ${nombre}`),
    '',
  ].join('\n');
}
