# Etapa 7 — UI

- **Estado:** Aprobada (2026-10-09)
- **Fecha:** 2026-10-09
- **ADRs relacionados:** [0006](../adr/0006-metricas.md), [0011](../adr/0011-reparto-de-personas.md)

## Objetivo

El dashboard que ve la empresa: KPIs, tendencia, los 8 gráficos y los segmentadores, todos
conectados. Consume solo `GET /api/dashboard` y `POST /api/sync`; no calcula métricas.

## Diseño de la pantalla

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Dashboard de tickets      Actualizado hace 3 min · cada 5 min  [⟳ Sincronizar] [◐] │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Proyecto ▾][Tipo de proyecto ▾][Tipo ▾][Estado ▾][Prioridad ▾][Responsable ▾]│
│ [Informador ▾][Desde ▢][Hasta ▢]     chips: Proyecto: PRJA ✕ …  [Limpiar todo] │
│ Mostrando 79 de 231 tickets                                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│ Total │ Abiertos │ En curso │ En espera │ Completados │ Descartados │          │
│ Estancados ⚠ │ Vencidos ⚠ │ Cycle time (mediana)                             │
├──────────────────────────────────────────────────────────────────────────────┤
│ Tendencia: creados vs. resueltos por mes                       (ancho total) │
├───────────────────────────────────┬──────────────────────────────────────────┤
│ Por estado                        │ Por tipo de incidencia                   │
│ Por proyecto                      │ Por tipo de proyecto                     │
│ Por prioridad                     │ Por responsable                          │
│ Por informador                    │ Por responsable del proyecto             │
├───────────────────────────────────┴──────────────────────────────────────────┤
│ Notas: datos anonimizados · el responsable es ficticio · cycle time sobre N  │
└──────────────────────────────────────────────────────────────────────────────┘
```

Dos columnas de gráficos en escritorio, una en celular. Diseño sobrio, tipografía del sistema,
**modo claro y oscuro** (sigue al sistema operativo, con un botón para cambiarlo que se
recuerda en el navegador).

## Alcance

### 1. Encabezado y sync

- "Actualizado hace N min" según `sync.ultimoExitoso.fin`, refrescado cada minuto; al pasar
  el mouse, fecha y hora exactas.
- Si el último intento falló, un aviso visible con ícono y texto ("El último sync falló:
  credenciales inválidas. Se muestran los datos de hace 12 min").
- Botón **Sincronizar ahora** (`POST /api/sync`): estado "Sincronizando…" mientras espera; al
  terminar recarga el dashboard; si responde 429 muestra "Probá en N s"; si falla, el mensaje
  de error. Deshabilitado si el sync está desactivado.
- El dashboard se recarga solo cada 5 minutos (el intervalo que informa la API).

### 2. Segmentadores y filtros

- Un selector múltiple por dimensión (proyecto, tipo de proyecto, tipo de incidencia, estado,
  prioridad, responsable, informador), con las opciones que devuelve la API, y un rango de
  fechas (desde / hasta, sobre la fecha de creación).
- **Clic en una barra o porción** de cualquier gráfico agrega (o quita) ese valor al filtro
  de su dimensión. Responsable del proyecto, que no tiene selector, aparece solo como chip.
- **Chips** con cada filtro activo, removibles, y "Limpiar todo".
- "Mostrando N de M tickets".
- **Los filtros viven en la URL** (mismos parámetros que la API): recargar la página o
  compartir el link conserva la vista.
- Todos los filtros afectan a todo el dashboard (KPIs, tendencia y gráficos).

### 3. KPIs

Una fila de tarjetas: total, abiertos, en curso, en espera, completados, descartados,
estancados, vencidos y **cycle time** (mediana en días, con el promedio y la cantidad de
tickets en el texto secundario: "promedio 71,6 d · sobre 132 tickets"). Estancados y vencidos
llevan ícono + texto cuando son mayores que cero (nunca solo color). Números con formato
argentino (`1.234`, `19,8`).

### 4. Tendencia

Gráfico de líneas, **creados vs. resueltos por mes**, con leyenda y etiquetas directas al final
de cada línea, una sola escala, y un cursor vertical con tooltip que muestra ambos valores del
mes. Si no hay datos: "Sin tickets para los filtros elegidos".

### 5. Los 8 gráficos

- **Torta solo con 6 categorías o menos; si no, barras horizontales** ordenadas de mayor a
  menor (regla `tipoDeGrafico` de `shared`, evaluada sobre los datos filtrados).
- **Barras:** un solo color (es una sola serie), etiqueta del valor al final de cada barra.
  Excepción: **por estado**, cada barra toma el color de su grupo (Por hacer, En curso, En
  espera, Completado, Descartado, Sin clasificar), con leyenda de grupos.
- **Tortas:** cada categoría con color fijo, con leyenda y porcentajes.
- **El color sigue a la entidad, no a la posición:** un valor conserva su color al filtrar
  (se asigna por el orden de las opciones totales, no por el ranking del momento).
- Tooltip al pasar el mouse con valor y porcentaje; el valor activo en un filtro se resalta.
- Cada tarjeta tiene **"Ver tabla"**, que muestra los mismos datos como tabla accesible.
- Los nombres largos se recortan con "…" y se ven completos en el tooltip.

### 6. Colores

Paleta categórica validada para daltonismo y contraste, en versión clara y oscura (se
verifica con el validador de paletas antes de cerrar la etapa). El texto nunca usa el color
de la serie; los colores de estado (advertencia, error) se reservan para avisos y siempre van
con ícono y texto.

### 7. Estados de la pantalla

- **Cargando:** esqueletos en lugar de los números y gráficos (sin saltos de diseño).
- **Error de la API:** mensaje claro y botón "Reintentar"; si ya había datos, se conservan y
  el error se muestra arriba.
- **Sin resultados** para los filtros: mensaje y botón "Limpiar filtros".

### 8. Accesibilidad

Navegable con teclado (selectores, chips, botones y barras), foco visible, roles y etiquetas
ARIA, contraste AA en textos, tabla alternativa para cada gráfico, identidad nunca solo por
color (leyendas, etiquetas, íconos).

### 9. Notas al pie

"Datos reales anonimizados, sincronizados desde Jira. El responsable de cada ticket es un
dato ficticio (ADR-0011). El cycle time y los resueltos se calculan sobre los N tickets
completados con fecha de resolución."

### Tecnología

React + Vite + Recharts (ya en el stack). Sin librerías de UI ni de estado adicionales:
componentes propios, `fetch` con cancelación de pedidos viejos, estado de filtros en la URL.

### Tests

React Testing Library con la API simulada: render de KPIs y formato de números, cambio de
filtro → URL y nuevo pedido, clic en barra → filtro, chips y "Limpiar todo", torta vs. barras
según la cantidad de categorías, color estable al filtrar, "Ver tabla", botón de sync (éxito,
429, error, desactivado), estados de carga, error y vacío, aviso de sync fallido, modo oscuro.
Coverage ≥ 80 %.

## Fuera de alcance

Servir el frontend compilado desde el backend, despliegue y autenticación (etapa siguiente,
junto con la publicación). Exportar a PDF/Excel.

## Criterios de aceptación

1. Con `npm run dev`, el dashboard muestra los 231 tickets y los números coinciden con la API.
2. Elegir un filtro (por selector, clic en un gráfico o URL) actualiza todo el dashboard y
   la URL; recargar conserva la vista.
3. Mover un ticket en Jira se ve en el dashboard en ≤ 5 minutos sin recargar, o al instante
   con "Sincronizar ahora".
4. Torta solo con ≤ 6 categorías; colores estables al filtrar; paleta validada.
5. Funciona en modo claro y oscuro, en escritorio y celular, y con teclado.
6. `npm run check` pasa con coverage ≥ 80 %.

## Decisiones tomadas al aprobar

1. **Estilo visual:** azules, grises y blancos en la interfaz y en las barras; las tortas usan la
   paleta categórica validada (empieza en azul). Ver [ADR-0013](../adr/0013-estilo-visual-y-paleta.md).
2. **Formato:** números y fechas en formato argentino (`1.234,5`; `09/10/2026 16:45`).

## Resultado

- Probado en el navegador con los datos reales: KPIs, tendencia y los 8 gráficos coinciden
  con la API; clic en una barra filtra todo el dashboard y actualiza la URL (`?estado=Cerrado`
  → 53 de 231); "Sincronizar ahora" sincroniza los 231 tickets en ~3 s.
- Revisado en modo claro, modo oscuro, escritorio (1440 px) y celular (375 px), sin desborde
  horizontal.
- **Ajustes surgidos al verlo funcionando:**
  - Torta solo con **2 a 6** categorías: con una sola (por ejemplo, prioridad) una torta llena no
    compara nada, así que se muestra como barra.
  - Orden natural en las opciones ("Usuario 2" antes que "Usuario 10").
  - Las listas de los segmentadores se cierran con Escape y al tocar afuera, y en celular no se
    salen de la pantalla.
  - En el gráfico por estado, el nombre del grupo se lee correctamente en lectores de pantalla.
- Los 6 criterios de aceptación se cumplen.
