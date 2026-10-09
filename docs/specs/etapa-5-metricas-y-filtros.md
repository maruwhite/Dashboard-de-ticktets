# Etapa 5 — Métricas y filtros

- **Estado:** Aprobada (2026-10-09)
- **Fecha:** 2026-10-09
- **ADRs relacionados:** [0005](../adr/0005-estados.md), [0006](../adr/0006-metricas.md),
  [0010](../adr/0010-ajustes-etapas-2-a-4.md)

## Objetivo

Toda la lógica de negocio del dashboard: a partir de los tickets sincronizados y de los
filtros elegidos, calcular KPIs, distribuciones para los gráficos, tendencia y las opciones
disponibles en cada segmentador. Sin HTTP ni UI: funciones puras y testeadas, listas para que
la etapa 6 las exponga.

## Alcance

### 1. Grupos de estado (paquete compartido)

En `packages/shared`, el único módulo con la tabla del ADR-0005:

- `grupoDeEstado(nombre) → 'Por hacer' | 'En curso' | 'En espera' | 'Completado' | 'Descartado' | 'Sin clasificar'`.
- Comparación sin distinguir mayúsculas ni espacios sobrantes. "Finalizada" se reconoce
  igual como Completado (por si aparece en un ticket creado a mano).
- Un estado desconocido → "Sin clasificar" (nunca se asigna a un grupo en silencio).
- También en `shared`: los tipos `Ticket`, `Filtros` y `Dashboard` (la forma de la respuesta),
  para que backend y frontend usen exactamente los mismos.

Para que backend y frontend lo consuman sin pasos manuales: el paquete expone sus tipos desde
el código fuente y se compila automáticamente antes de `dev`, `build` y `test`.

### 2. Filtros

```ts
interface Filtros {
  proyecto?: string[]; // clave de proyecto
  tipoProyecto?: string[];
  tipoIncidencia?: string[];
  estado?: string[];
  prioridad?: string[];
  responsable?: string[];
  informador?: string[];
  responsableProyecto?: string[]; // no es segmentador, pero se usa al hacer clic en su gráfico
  desde?: string; // AAAA-MM-DD, sobre la fecha de creación, inclusive
  hasta?: string; // AAAA-MM-DD, inclusive
}
```

- Dentro de una dimensión, los valores se combinan con **O**; entre dimensiones, con **Y**.
- Un filtro ausente o vacío no filtra.
- Las fechas se interpretan en hora de Argentina.

### 3. Cálculo del dashboard

`calcularDashboard(tickets, filtros, ahora) → Dashboard`, con:

- **kpis:** total, abiertos, enCurso, enEspera, completados, descartados, estancados, vencidos,
  y cycle time (promedio y mediana en días, más la cantidad de tickets considerados).
- **distribuciones:** para cada dimensión de gráfico (tipo de incidencia, proyecto, tipo de
  proyecto, estado, prioridad, informador, responsable, responsable del proyecto), una lista
  `{ valor, cantidad }` ordenada de mayor a menor. Los valores vacíos se muestran como
  "(sin dato)". La distribución por estado incluye además el grupo de cada estado.
- **tendencia:** `{ periodo: 'AAAA-MM', creados, resueltos }` para cada mes entre el primero
  y el último con datos del conjunto filtrado, completando con ceros.
- **opciones:** los valores posibles de cada segmentador, calculados sobre **todos** los
  tickets (no los filtrados), para poder cambiar de filtro sin quedar sin opciones.
- **total sin filtrar**, para mostrar "N de M tickets".

Todas las definiciones según ADR-0006. La regla "torta solo con ≤ 6 categorías" queda como
función en `shared` (`tipoDeGrafico(cantidadDeCategorias)`) para que la use la UI.

### 4. Rendimiento

Con ~230 tickets el cálculo completo en memoria es instantáneo; no hace falta SQL agregado
ni caché. Si el volumen creciera mucho, se revisa con un ADR.

### Tests

Datos inventados construidos con funciones auxiliares; "ahora" fijo. Como mínimo:

- Cada grupo de estado, incluido un estado desconocido y variantes de mayúsculas/espacios.
- Cada KPI con sus casos borde: descartados fuera de completados y del cycle time;
  estancado justo en el límite de 3 días; vencido sin fecha de vencimiento; vencimiento hoy
  (no vencido).
- Cycle time: promedio y mediana con cantidad par e impar; sin completados → sin dato.
- Filtros: O dentro de una dimensión, Y entre dimensiones, rango de fechas inclusive, filtros
  vacíos.
- Tendencia: meses sin datos en cero, resueltos solo de completados, borde de mes en hora de
  Argentina.
- Opciones sobre el total y distribuciones ordenadas.

## Fuera de alcance

Endpoints HTTP y validación de los parámetros que llegan por URL (etapa 6). UI (etapa 7).

## Criterios de aceptación

1. `calcularDashboard` devuelve KPIs, distribuciones, tendencia y opciones según ADR-0006.
2. Con los 231 tickets reales y sin filtros, los conteos por estado coinciden con el resumen
   aprobado de la anonimización (verificación manual, sin datos en el repo).
3. El mapeo de estados existe en un único lugar (`packages/shared`).
4. Backend y frontend importan `@dashboard/shared` sin pasos manuales, en desarrollo, tests,
   build y CI.
5. `npm run check` pasa con coverage ≥ 80 % (se espera cerca de 100 % en este módulo).

## Preguntas abiertas

1. **Filtro por responsable del proyecto:** no está en la lista de segmentadores de la spec
   original, pero hacer clic en su gráfico debe filtrar. Propuesta: existe como filtro (para el
   clic) y la UI lo muestra como un chip removible, sin segmentador propio. ¿OK, o lo agrego
   también como segmentador?
2. **Cycle time en la UI:** el ADR lo define, pero la spec original no lo lista entre los KPIs.
   Propuesta: calcularlo acá y mostrarlo como un KPI más (mediana en días). ¿OK?

## Decisiones tomadas al aprobar

1. **Responsable del proyecto:** existe como filtro (para el clic en su gráfico) y la UI lo
   muestra como un chip removible, sin segmentador propio.
2. **Cycle time:** se muestra como un KPI más (mediana en días).

## Resultado

- Con los 231 tickets reales y sin filtros, los conteos por estado, tipo, proyecto y
  responsable coinciden exactamente con el resumen aprobado de la anonimización.
- **Observación sobre los datos:** 211 tickets están completados pero solo 132 tienen fecha
  de resolución (así viene el export). El cycle time (mediana 19,8 días, promedio 71,6) y los
  "resueltos" de la tendencia se calculan sobre esos 132. La UI debe aclararlo.
- Los 5 criterios de aceptación se cumplen.
