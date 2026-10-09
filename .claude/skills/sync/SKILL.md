---
name: sync
description: Sincronización del backend contra la API de Jira hacia SQLite (cada 5 minutos). Usar al implementar, depurar o modificar el sync, el cliente de Jira o el esquema de la base local.
---

# Sync Jira → SQLite

## Antes de empezar

- Leer [ADR-0002](../../../docs/adr/0002-arquitectura-y-flujo-de-datos.md),
  [ADR-0004](../../../docs/adr/0004-carga-a-jira.md) y
  [ADR-0005](../../../docs/adr/0005-estados.md).
- Confirmar que existe una spec aprobada para la etapa de sync en `docs/specs/`.

## Reglas

- Búsqueda: `POST /rest/api/3/search/jql`, paginando con `nextPageToken` hasta que no
  venga. **No** usar `/rest/api/3/search` (deprecado) ni `startAt`/`total`.
- Pedir solo los campos que el dashboard usa (`fields: [...]`), nunca `*all`.
- La fecha de creación del ticket se lee del **campo personalizado**, no de `created`
  (ver ADR-0004). El id del campo viene de configuración, no hardcodeado.
- Frecuencia: cada 5 minutos. Nunca dos syncs en paralelo (lock).
- Guardar en SQLite la fecha/hora del último sync exitoso y el resultado del último intento;
  la UI la muestra.
- Si Jira falla, se conserva el último dato bueno y se registra el error; no se borra la base.
- Respetar `429` / `Retry-After` con backoff.
- Escritura en SQLite dentro de una transacción: o se aplica el sync completo o nada.

## Seguridad

- Token solo desde `.env`. El cliente HTTP no loguea cabeceras ni cuerpos completos.
- Los errores de Jira se loguean resumidos (status, endpoint), sin datos de tickets.

## Tests

- Cliente de Jira mockeado (nada de llamadas reales en tests). Fixtures con datos inventados.
- Casos mínimos: paginación con varias páginas, error intermedio, 429, sync sin cambios,
  ticket que cambia de estado.
