# Etapa 2 — Anonimización

- **Estado:** Aprobada (2026-10-09)
- **Fecha:** 2026-10-09
- **ADRs relacionados:** [0003](../adr/0003-anonimizacion.md), [0005](../adr/0005-estados.md),
  [0008](../adr/0008-seguridad.md)

## Objetivo

Un script que lee el export real (`data/Tickets_jira.xlsx`) y genera un archivo anonimizado
para que Marisa lo revise antes de cargar nada en Jira.

## Lo que se sabe del export

Inspección hecha solo con conteos y valores de columnas no sensibles:

- El libro tiene **más de una hoja**. Solo se usa la hoja **`Jira`** (231 tickets, 69
  columnas). Cualquier otra hoja se ignora sin leerse.
- **Fechas como texto** con meses abreviados en español, año de 2 dígitos y AM/PM
  (formato `dd/mmm/aa h:mm AM`). Hay que parsearlas explícitamente.
- **Personas:** "Persona asignada" tiene 1 valor distinto; "Informador", 63;
  "Responsable del proyecto", 5.
- **Proyectos:** 5 claves distintas. **Tipo de proyecto:** `service_desk` y `software`.
- **Tipos de incidencia (8):** Epic, Tarea, Solicitud de servicio, Incidente, Consulta,
  Requerimiento, subtarea, Requerimiento Interno.
- **Estados:** los 11 del ADR-0005, todos presentes.
- **Prioridad:** un único valor en los 231 tickets (con un espacio sobrante al final).
- **No hay fecha de vencimiento** en el export (impacta el KPI "vencidos", ver preguntas).
- Hay un campo personalizado de **fecha de resolución** (143 tickets con valor).

## Alcance

### Workspace `seed/`

Nuevo workspace `@dashboard/seed` con los scripts de esta etapa y la siguiente. Mismas
reglas de calidad que el resto (strict, lint, coverage ≥ 80 %).

`npm run anonimizar -w seed` → lee `data/Tickets_jira.xlsx`, escribe en `data/anonimizado/`.

### Tratamiento de columnas (lista blanca)

Solo se procesan estas columnas; **todas las demás se descartan sin leerse**:

| Columna del export                        | Salida                               | Tratamiento                                                 |
| ----------------------------------------- | ------------------------------------ | ----------------------------------------------------------- |
| Tipo de Incidencia                        | `tipo_incidencia`                    | Se conserva (ver pregunta sobre "subtarea")                 |
| Estado                                    | `estado`                             | Se conserva (ver pregunta sobre unificación)                |
| Prioridad                                 | `prioridad`                          | Se conserva, sin espacios sobrantes                         |
| Tipo de proyecto                          | `tipo_proyecto`                      | Se conserva                                                 |
| Clave del proyecto / Nombre del proyecto  | `proyecto_clave` / `proyecto_nombre` | `PRJA` "Proyecto Alfa", `PRJB` "Proyecto Beta"…             |
| Persona asignada                          | `responsable`                        | Usuario inventado                                           |
| Informador                                | `informador`                         | Usuario inventado                                           |
| Responsable del proyecto                  | `responsable_proyecto`               | Usuario inventado                                           |
| Resumen                                   | `titulo`                             | Texto generado (no derivado del original)                   |
| Creada                                    | `creada`                             | Fecha corrida por el offset                                 |
| Campo personalizado (Fecha de Resolución) | `resuelta`                           | Fecha corrida por el offset                                 |
| Clave de incidencia                       | `id_origen`                          | Renumerada: `T-001`, `T-002`… (orden por fecha de creación) |

Se descartan, entre otras: IDs internos, comentarios, descripciones, enlaces entre
incidencias, campos personalizados de área/sector/proceso, tiempo empleado, fecha de cierre y
"Actualizada" (Jira la fija al cargar; ver ADR-0004).

### Reglas

- **Personas → hasta 9 usuarios inventados** (`Usuario 1` … `Usuario 9`), con mapeo
  consistente entre las tres columnas: la misma persona real es siempre el mismo usuario.
  Como hay más de 9 personas, se propone: las **8 personas con más apariciones** reciben un
  usuario propio y **el resto se agrupa en `Usuario 9`** (ver preguntas).
- **Títulos:** se eligen de una lista fija de frases genéricas de IT según el tipo de
  incidencia ("Revisar permisos de acceso", "Actualizar configuración de reporte"…), de forma
  determinística. Ninguna palabra sale del título original.
- **Fechas:** un único offset en días enteros para todas las fechas, calculado para que la
  fecha más reciente quede entre 1 y 7 días antes del día de la generación (los datos se ven
  "actuales" en la demo). El offset **no se guarda** en ningún lado.
- **Sin tabla de equivalencias:** el mapeo existe solo en memoria durante la ejecución.
- **Sin datos reales en la salida de consola:** el script imprime solo conteos.
- **Validación de salida:** antes de escribir, el script verifica que ningún valor de
  personas, proyectos ni títulos originales aparezca en el archivo generado. Si aparece,
  falla sin escribir.

### Salida (en `data/anonimizado/`, ignorada por git)

- `tickets.csv` — UTF-8 con BOM (se abre bien en Excel), una fila por ticket, columnas de
  la tabla de arriba. Es el **único** archivo que lee la etapa 3.
- `resumen.md` — para la revisión: cantidad de tickets, conteos por estado, tipo, proyecto,
  tipo de proyecto, usuario inventado y rango de fechas resultante.

### Revisión (control obligatorio)

Al terminar, el proceso se frena. Marisa abre `tickets.csv` y `resumen.md` y aprueba o pide
cambios. Sin aprobación explícita en el chat no se pasa a la etapa 3.

### Tests

Con un `.xlsx` sintético generado en los tests (exceljs), nunca con el archivo real:
parseo de fechas en español (AM/PM, meses, años de 2 dígitos), offset que conserva
duraciones, mapeo consistente y tope de 9 usuarios, lista blanca de columnas, hoja
inexistente, validación de fuga de datos y que la consola no imprima valores.

## Fuera de alcance

Cualquier llamada a Jira (etapa 3).

## Criterios de aceptación

1. `npm run anonimizar -w seed` genera `tickets.csv` y `resumen.md` en `data/anonimizado/`.
2. El CSV tiene 231 filas (menos las que se decida excluir) y solo las columnas definidas.
3. Ningún nombre, clave de proyecto, título o fecha original aparece en la salida.
4. Las duraciones (resuelta − creada) son idénticas a las del original.
5. La consola muestra solo conteos.
6. `npm run check` pasa con coverage ≥ 80 % también en `seed`.
7. Marisa revisó y aprobó el archivo. ✅ Aprobado el 2026-10-09.

## Decisiones tomadas al aprobar

1. **Otras hojas del libro:** Marisa las borró; el archivo tiene solo la hoja `Jira`. El
   script igual lee únicamente esa hoja por nombre.
2. **Personas:** las 8 personas con más apariciones (sumando las tres columnas) reciben un
   usuario propio (`Usuario 1` … `Usuario 8`); el resto se agrupa en `Usuario 9`.
3. **Estados:** "Finalizada" se unifica en "Finalizado" al anonimizar. "Cerrado" queda como
   estado propio (grupo Completado).
4. **"subtarea":** se convierte en "Tarea".
5. **Prioridad:** se conserva tal cual (sin espacios sobrantes).
6. **Cambio tras la primera revisión** ([ADR-0011](../adr/0011-reparto-de-personas.md)):
   informadores y responsables de proyecto se reparten en hasta 20 usuarios equilibrando la
   carga (reemplaza el punto 2), y el responsable se reparte entre 5 agentes ficticios
   (dato no real).
