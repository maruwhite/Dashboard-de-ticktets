# ADR-0006: Definición de métricas

- **Estado:** Aceptado (2026-10-09)
- **Fecha:** 2026-10-09

## Contexto

La especificación lista los KPIs y gráficos, pero algunas definiciones admiten más de una
interpretación. Se fijan acá para que backend, tests y UI usen las mismas.

## Decisión

Todas las métricas se calculan sobre el conjunto de tickets **ya filtrado** por los
segmentadores. Grupos de estado según ADR-0005 (con el ajuste de ADR-0010). "Hoy" y los
períodos se calculan en la hora de Argentina (UTC−3).

| KPI         | Definición                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------------- |
| Total       | Cantidad de tickets.                                                                                        |
| Abiertos    | Grupos Por hacer + En curso + En espera.                                                                    |
| En curso    | Grupo En curso.                                                                                             |
| En espera   | Grupo En espera.                                                                                            |
| Completados | Grupo Completado.                                                                                           |
| Descartados | Grupo Descartado.                                                                                           |
| Estancados  | Abiertos cuya última actualización en Jira es de hace más de 3 días.                                        |
| Vencidos    | Abiertos con fecha de vencimiento de Jira anterior a hoy. Sin fecha de vencimiento → no vencido (ver nota). |

- **Cycle time:** días desde la fecha de creación hasta la de resolución, solo para tickets
  del grupo Completado con fecha de resolución. Los descartados no entran. Se informan
  promedio y mediana.
- **Tendencia:** por **mes**, cantidad de tickets creados (por fecha de creación) y resueltos
  (por fecha de resolución, solo grupo Completado), con todos los meses del rango aunque
  tengan cero.
- **Gráficos** por: tipo de incidencia, clave de proyecto, tipo de proyecto, estado,
  prioridad, informador, responsable, responsable del proyecto. Torta solo si hay ≤ 6
  categorías.

## Notas

- **Vencidos:** el export real no trae fecha de vencimiento, así que con los datos cargados
  el KPI da 0. Se decidió no inventar vencimientos ni definir un SLA: el KPI funciona con los
  tickets a los que se les cargue una fecha de vencimiento en Jira.
- **Cycle time:** se mide desde la creación porque la importación no conserva el historial
  de transiciones (no se sabe cuándo empezó el trabajo).
- **Estancados:** "sin cambios" usa la fecha de actualización de Jira. Después de la carga
  inicial todos los tickets tienen la misma, así que durante los primeros 3 días ninguno
  figura como estancado y después lo estarán todos los abiertos que no se toquen.
- **Tendencia mensual:** los datos abarcan de 2022 a 2026; por semana serían más de 200
  puntos.

## Consecuencias

- Las funciones de métricas reciben "ahora" como parámetro, para ser deterministas en tests.
- Cambiar una definición requiere actualizar este ADR y sus tests.
