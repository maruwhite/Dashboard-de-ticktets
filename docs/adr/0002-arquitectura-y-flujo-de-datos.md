# ADR-0002: Arquitectura y flujo de datos

- **Estado:** Aceptado
- **Fecha:** 2026-10-09

## Contexto

El challenge exige "estado real" y "sin cargar nada a mano". No se puede usar el Jira de la
empresa directamente, así que los datos reales se anonimizan y se cargan una única vez en un
Jira personal gratuito, que pasa a ser la fuente de verdad.

## Decisión

```
data/Tickets_jira.xlsx ─► anonimizar ─► revisión humana ─► cargar por API ─► Jira personal
                                                                               │
                                                     sync cada 5 min (search/jql)
                                                                               ▼
                                              backend (Express) ─► SQLite ─► API REST ─► React
```

- **El dashboard lee siempre de Jira.** El Excel y el archivo anonimizado solo se usan para
  poblar Jira; el backend nunca los lee.
- El backend sincroniza Jira → SQLite cada 5 minutos y sirve la API desde SQLite. Así la
  UI responde rápido, se limita el tráfico a Jira y, si Jira no responde, se muestra el
  último dato bueno con su fecha.
- El frontend solo habla con el backend propio.
- La anonimización y la carga son scripts separados del backend y de la UI.

## Consecuencias

- Mover un ticket en Jira se refleja en el dashboard en ≤ 5 minutos sin intervención.
- Pasar al Jira corporativo en el futuro solo requiere cambiar variables de entorno (y los
  ids de campos personalizados).
- SQLite es una caché derivada: se puede borrar y reconstruir con un sync completo.
