# ADR-0012: Configuración de Jira Cloud para la carga

- **Estado:** Aceptado
- **Fecha:** 2026-10-09
- **Complementa:** [ADR-0004](0004-carga-a-jira.md)

## Contexto

Al ejecutar la carga contra el sitio real aparecieron comportamientos de Jira Cloud que la
spec de la etapa 3 no preveía:

1. Un proyecto creado por API sin plantilla recibe igual la plantilla "Simple Issue
   Tracking": esquema de tipos propio (solo Tarea y Subtarea), pantallas propias y un tipo
   global "Tarea" nuevo, aunque ya existiera otro con ese nombre.
2. El sitio usa el modelo nuevo de **esquemas de campos** (field schemes). Un campo
   personalizado que está en la pantalla y tiene contexto global igual no se puede completar
   si no está asociado al esquema de campos del proyecto ("Field cannot be set").
3. `GET /rest/api/3/field` omite los campos que todavía no están en la pantalla de ningún
   proyecto.

## Decisión

`jira:preparar` deja cada proyecto con una configuración explícita, en este orden:

1. Campos personalizados (buscados con `/rest/api/3/field/search`, paginado) y su alta en la
   "Default Screen".
2. Prioridad, workflow y esquema de workflow.
3. **Proyectos antes que tipos de incidencia**, para no duplicar el "Tarea" de la plantilla.
   Si hay tipos globales duplicados, el script se frena.
4. Esquema de tipos propio "Dashboard de tickets" asignado a los proyectos.
5. Esquema de pantallas por defecto ("Default Issue Type Screen Scheme") asignado a los
   proyectos.
6. Campos asociados al esquema de campos de los proyectos
   (`PUT /rest/api/3/config/fieldschemes/fields`). En sitios sin esquemas de campos el paso se
   omite.

`jira:cargar` trata la respuesta 400 de `POST /issue/bulk` (todos los elementos fallaron)
como errores por ticket, sin cortar la carga.

## Consecuencias

- La preparación es reproducible en un sitio nuevo y quedó cubierta por tests con un Jira
  simulado que reproduce estos comportamientos.
- En el sitio quedan objetos de la plantilla sin uso (esquemas "PRJx: Simple Issue
  Tracking…", tipos "Subtarea" e "Historia"). No molestan y se pueden borrar desde la
  administración de Jira.
- Resultado de la carga del 2026-10-09: 231 tickets, 0 errores, verificados campo por campo
  contra `tickets.csv`.
