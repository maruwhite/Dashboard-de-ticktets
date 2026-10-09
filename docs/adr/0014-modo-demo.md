# ADR-0014: Modo demo con una foto anonimizada en el repo

- **Estado:** Aceptado
- **Fecha:** 2026-10-09
- **Modifica:** la regla "ningún dato en el repo" de [ADR-0003](0003-anonimizacion.md) y
  [ADR-0008](0008-seguridad.md), solo para el archivo indicado abajo

## Contexto

El proyecto se evalúa desde el repo público. Sin acceso al Jira de prueba, quien lo clone puede
leer el código pero no verlo funcionar. Marisa aprobó publicar una foto de los datos
**anonimizados** (nunca los reales).

## Decisión

- Se versiona **un único archivo de datos**: `backend/demo/tickets.json`, con los 231 tickets
  tal como los sincroniza el backend desde el Jira de prueba (ya anonimizados: personas y
  proyectos inventados, títulos genéricos, fechas corridas, responsable ficticio).
- Se genera con un comando reproducible y, antes de commitearlo, se verifica contra el export
  original que no contiene ningún valor real (personas, proyectos, claves, títulos).
- **Modo demo:** si el backend arranca sin credenciales de Jira (`SYNC_ENABLED` pasa a
  desactivarse solo cuando falta `JIRA_BASE_URL`) y la base está vacía, carga la foto. La UI
  lo indica con un aviso visible y el botón "Sincronizar ahora" queda deshabilitado.
- Con credenciales de Jira, todo sigue igual: sync en vivo cada 5 minutos.
- Siguen prohibidos en el repo: `data/`, el Excel, el CSV anonimizado y cualquier `.env`.

## Consecuencias

- `git clone` + `npm install` + `npm run dev` muestra el dashboard completo sin configurar nada.
- En modo demo, KPIs como "estancados" se calculan contra la fecha actual: a medida que pasan
  los días, los tickets abiertos de la foto figuran como estancados (es el comportamiento
  correcto para datos que no cambian).
- Regenerar la foto requiere volver a correr la verificación de fugas.
