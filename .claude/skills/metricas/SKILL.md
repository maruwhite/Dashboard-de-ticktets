---
name: metricas
description: Cálculo de KPIs, agrupaciones, tendencia y filtros del dashboard a partir de los tickets sincronizados. Usar al implementar o modificar métricas, filtros o los endpoints que las exponen.
---

# Métricas y filtros

## Antes de empezar

- Leer [ADR-0005](../../../docs/adr/0005-estados.md) (grupos de estados) y
  [ADR-0006](../../../docs/adr/0006-metricas.md) (definiciones).
- Confirmar que existe una spec aprobada para la etapa en `docs/specs/`.

## Reglas

- Toda métrica se calcula sobre el **grupo** de estado (ADR-0005), nunca comparando
  nombres de estado sueltos. El mapeo vive en un único módulo compartido.
- "Cerrado", "Finalizado" y "Finalizada" se unifican como **Finalizado**.
- **Descartados** (Cancelado, Rechazado): no cuentan como completados ni entran en el
  cycle time.
- Definiciones exactas (abiertos, estancados, vencidos, cycle time, tendencia): ADR-0006.
  Si una definición no está en el ADR, se consulta antes de inventarla.
- Los filtros (segmentadores y clic en gráficos) se aplican **antes** de calcular: todos los
  KPIs, gráficos y la tendencia responden al mismo conjunto filtrado.
- Funciones puras: reciben tickets + filtros + "ahora" (inyectado, nunca `Date.now()`
  dentro de la lógica) y devuelven resultados. Así son testeables y deterministas.
- Fechas en UTC internamente; la presentación decide la zona horaria.

## Tests

- Coverage alto en este módulo (es el corazón del challenge): casos borde por cada KPI,
  tickets sin fecha de vencimiento, sin responsable, descartados, estados desconocidos.
- Datos inventados construidos con helpers/factories; nunca datos reales.
