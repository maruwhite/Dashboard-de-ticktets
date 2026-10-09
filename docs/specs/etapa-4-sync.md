# Etapa 4 — Sync

- **Estado:** Aprobada (2026-10-09)
- **Fecha:** 2026-10-09
- **ADRs relacionados:** [0002](../adr/0002-arquitectura-y-flujo-de-datos.md),
  [0004](../adr/0004-carga-a-jira.md), [0008](../adr/0008-seguridad.md)

## Objetivo

El backend lee los tickets de Jira por API cada 5 minutos y los guarda en SQLite. Desde
esta etapa el dashboard tiene una fuente de datos real y automática.

## Alcance

### Configuración (`backend/.env`)

Pasan a ser **obligatorias**: `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` y los ids de
campos personalizados que imprime `jira:preparar` (`JIRA_FIELD_CREADA`,
`JIRA_FIELD_RESUELTA`, `JIRA_FIELD_TIPO_PROYECTO` y, según la opción de personas, los de
personas). Opcionales: `JIRA_JQL` (por defecto, los proyectos `PRJA`…), `SYNC_INTERVAL_MINUTES`
(5) y `DATABASE_PATH` (`backend/data/dashboard.db`, ignorado por git).

Para que los tests y el CI no dependan de credenciales, el backend puede arrancar con
`SYNC_ENABLED=false`.

### Cliente de Jira

- `POST /rest/api/3/search/jql`, `maxResults: 100`, paginando con `nextPageToken`.
- `fields`: solo los necesarios (tipo, estado, prioridad, proyecto, responsable,
  informador, `updated`, campos personalizados). Nunca `*all`.
- Responsable del proyecto: desde el campo de la etapa 3 (opción B) o desde
  `GET /rest/api/3/project/{clave}` (opción A), cacheado por sync.
- Autenticación Basic (email + token) solo dentro del cliente. Reintentos con backoff ante
  `429` y `5xx`; sin reintentos ante `401/403` (se registra "credenciales inválidas").
- `fetch` inyectado, para testear sin red.

### Estrategia: sync completo

Cada ciclo trae **todos** los tickets del JQL y reemplaza la tabla en una transacción. Con
~230 tickets son 3 requests. Es más simple que un sync incremental y detecta tickets
borrados. Si el volumen creciera, se pasa a incremental (`updated >= último sync`) con un
ADR nuevo.

### SQLite

- Driver: **`node:sqlite`** (incluido en Node 24, sin compilación nativa en Windows). Si
  diera problemas, se cambia a `better-sqlite3` con un ADR.
- Tabla `tickets`: clave, tipo, estado (nombre crudo de Jira), prioridad, proyecto (clave
  y nombre), tipo de proyecto, responsable, informador, responsable del proyecto, creada
  (histórica), resuelta (histórica), actualizada (`updated` de Jira), vencimiento (si
  existe).
- Tabla `sync_runs`: inicio, fin, resultado (ok/error), cantidad de tickets y resumen del
  error (sin datos de tickets ni secretos).
- Migraciones simples versionadas en código.

### Scheduler

- Corre un sync al arrancar y luego cada `SYNC_INTERVAL_MINUTES`.
- Nunca dos syncs en paralelo (si uno sigue corriendo, el siguiente se saltea y se registra).
- Si Jira falla, la base conserva el último dato bueno.
- Apagado limpio: espera el sync en curso y cierra la base.

### Lo que no hace esta etapa

El agrupamiento de estados (ADR-0005) y las métricas son de la etapa 5; los endpoints, de
la 6. Esta etapa solo deja los datos crudos y el estado del último sync en SQLite.

### Tests

Fetch simulado con respuestas armadas a mano (datos inventados): paginación con varias
páginas, `429` con `Retry-After`, `401`, error a mitad de paginación (no se pisa la base),
sync sin cambios, ticket que cambia de estado, lock contra syncs simultáneos, y que el token
no aparezca en ningún log. Base SQLite en memoria.

## Fuera de alcance

Métricas, endpoints de negocio, UI, webhooks.

## Criterios de aceptación

1. Con `.env` completo, al arrancar el backend se cargan en SQLite todos los tickets de Jira.
2. Mover un ticket de estado en Jira se refleja en SQLite en ≤ 5 minutos sin intervención.
3. Con credenciales inválidas o Jira caído, el backend sigue funcionando con el último dato
   bueno y `sync_runs` registra el error.
4. El token no aparece en logs, errores ni en la base.
5. `npm run check` pasa sin credenciales (CI) con coverage ≥ 80 %.

## Decisiones tomadas al aprobar

1. **Driver de SQLite:** `node:sqlite`.
2. **Sync completo** cada 5 minutos.
3. **Personas** (opción B de la etapa 3): responsable, informador y responsable del
   proyecto se leen de los campos personalizados; no hace falta consultar
   `/rest/api/3/project/{clave}`.
