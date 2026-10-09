---
name: ui
description: Frontend del dashboard (React + Vite + Recharts) — KPIs, gráficos, segmentadores, tendencia y último sync. Usar al construir o modificar cualquier pantalla o componente.
---

# UI del dashboard

## Antes de empezar

- Leer [ADR-0006](../../../docs/adr/0006-metricas.md) para saber qué muestra cada KPI.
- Confirmar que existe una spec aprobada para la etapa de UI en `docs/specs/`.

## Contenido

- **KPIs:** total, abiertos, en curso, en espera, completados, descartados, estancados,
  vencidos.
- **Gráficos** por: tipo de incidencia, clave de proyecto, tipo de proyecto, estado,
  prioridad, informador, responsable, responsable del proyecto.
  - **Torta solo si hay 6 categorías o menos**; si no, barras. La regla se evalúa sobre
    los datos ya filtrados.
- **Segmentadores:** proyecto, tipo de proyecto, tipo de incidencia, estado, prioridad,
  responsable, informador y rango de fechas. Afectan a todo el dashboard.
- **Clic en un gráfico filtra** por esa categoría (y se refleja en el segmentador
  correspondiente). Tiene que haber una forma visible de limpiar filtros.
- **Tendencia:** creados vs. resueltos en el tiempo.
- **Último sync:** fecha/hora visible siempre; si el último intento falló, indicarlo.

## Reglas

- El frontend habla **solo** con el backend propio. Nunca con Jira, nunca con tokens.
- Los cálculos los hace el backend; el frontend no recalcula métricas.
- Estado de filtros en un único lugar (y reflejado en la URL, para compartir vistas).
- Estados de carga, error y "sin datos" en cada bloque.
- Accesible: colores con contraste suficiente, no depender solo del color, tooltips.
- Componentes con tests (React Testing Library); nada de datos reales en fixtures.
