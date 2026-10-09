# Dashboard de tickets

Dashboard para visualizar y analizar tickets de Jira.

## Arquitectura

```
backend/   API propia: lee los datos (CSV hoy, Jira más adelante) y calcula métricas
frontend/  Dashboard: consume la API y muestra gráficos y tablas
data/      Archivos de datos locales (no se versionan)
```

## Datos

Los exports reales de Jira van en `data/` y **nunca se suben al repositorio**
(están excluidos en `.gitignore`). El repo solo incluye datos de ejemplo ficticios.

Las credenciales (tokens de Jira, etc.) van en archivos `.env`, que tampoco se versionan.
