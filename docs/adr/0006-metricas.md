# ADR-0006: Definición de métricas

- **Estado:** Propuesto — los puntos marcados como **[a confirmar]** son interpretaciones
  que necesitan aprobación.
- **Fecha:** 2026-10-09

## Contexto

La especificación lista los KPIs y gráficos, pero algunas definiciones admiten más de una
interpretación. Se fijan acá para que backend, tests y UI usen las mismas.

## Decisión

Todas las métricas se calculan sobre el conjunto de tickets **ya filtrado** por los
segmentadores. Grupos de estado según ADR-0005.

| KPI | Definición |
|---|---|
| Total | Cantidad de tickets. |
| Abiertos | Grupos Por hacer + En curso + En espera. **[a confirmar]** |
| En curso | Grupo En curso. |
| En espera | Grupo En espera. |
| Completados | Grupo Completado. |
| Descartados | Grupo Descartado. |
| Estancados | Abiertos con más de 3 días sin cambios (ver nota). |
| Vencidos | Abiertos con fecha de vencimiento anterior a hoy. Sin fecha de vencimiento → no vencido. **[a confirmar]** |

- **Cycle time:** desde la fecha de creación (campo personalizado) hasta la fecha de
  resolución, solo para Completados. Descartados excluidos. **[a confirmar: si se quiere
  medir desde "inicio de trabajo" hace falta historial de transiciones, que la importación
  no conserva]**
- **Tendencia:** por período (semana por defecto **[a confirmar]**), cantidad de creados
  (por fecha de creación) vs. resueltos (por fecha de resolución, solo Completados).
- **Gráficos** por: tipo de incidencia, clave de proyecto, tipo de proyecto, estado,
  prioridad, informador, responsable, responsable del proyecto. Torta solo si hay ≤ 6
  categorías.

## Nota sobre "estancados" **[a confirmar]**

"Sin cambios" se mide con `updated` de Jira. Después de la carga inicial, todos los tickets
tienen `updated` = día de la carga, así que durante los primeros 3 días ningún ticket figura
como estancado y después todos los abiertos que no se tocaron lo estarán a la vez. Es el
comportamiento correcto ("real"), pero conviene saberlo para la demo.

## Consecuencias

- Las funciones de métricas reciben "ahora" como parámetro, para ser deterministas en tests.
- Cambiar una definición requiere actualizar este ADR y sus tests.
