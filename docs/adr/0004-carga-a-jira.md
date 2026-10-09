# ADR-0004: Carga de datos a Jira

- **Estado:** Aceptado
- **Fecha:** 2026-10-09

## Contexto

Jira impone restricciones al crear tickets por API que impiden reproducir el historial tal
cual está en el export.

## Decisión

- **Fecha de creación:** Jira no permite fijar `created` histórico. La fecha "Creada"
  (ya corrida por el offset) se guarda en un **campo personalizado**, y todas las métricas
  usan ese campo como fecha de creación.
- **Estado:** los tickets nacen en "Planificado" y se llevan a su estado final aplicando
  las **transiciones** del workflow.
- **Búsqueda:** se usa `POST /rest/api/3/search/jql` con paginación por `nextPageToken`.
  El endpoint anterior (`/rest/api/3/search`) está deprecado y no se usa.
- La carga es un script independiente, idempotente y que solo lee el archivo anonimizado.

## Consecuencias

- El workflow del proyecto en Jira debe tener todos los estados del ADR-0005 y transiciones
  que permitan llegar a cada uno desde "Planificado".
- **Fecha de resolución:** Jira la fija al momento de la transición, no la histórica. Se
  propone guardarla también en un campo personalizado ("Resuelta"), para que el cycle time
  y la tendencia de resueltos sean correctos. A confirmar en la spec de carga.
- **Fecha de actualización:** `updated` reflejará el momento de la carga, no el histórico.
  Impacta en "estancados" (ver ADR-0006).
- Los ids de los campos personalizados (`customfield_XXXXX`) van en configuración, no en
  el código.
