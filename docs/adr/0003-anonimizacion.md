# ADR-0003: Anonimización del export real

- **Estado:** Aceptado
- **Fecha:** 2026-10-09

## Contexto

El export de Jira de la empresa contiene datos sensibles (personas, mails, clientes,
proyectos, descripciones). El repositorio es público y los datos se van a cargar en un Jira
personal fuera del control de la empresa.

## Decisión

| Tratamiento | Campos |
|---|---|
| **Se conservan** | Tipo de incidencia, estado, prioridad, tipo de proyecto |
| **Se reemplazan** | Personas → hasta 9 usuarios inventados del Jira personal · Proyectos → `PRJA "Proyecto Alfa"`, `PRJB "Proyecto Beta"`… · Títulos → texto generado |
| **Se descartan** | Descripciones, comentarios, mails |
| **Se transforman** | Fechas: todas corridas por el mismo offset (se conservan las duraciones) |

- El mapeo de personas y proyectos es **consistente** (misma entidad real → mismo valor
  inventado) para que las métricas por persona/proyecto sigan siendo significativas.
- Si hay más de 9 personas, varias reales se agrupan en un mismo usuario inventado.
- La tabla de equivalencias no se persiste en ningún lado.
- El archivo de entrada y el de salida viven en `data/` (ignorada por git).
- Antes de cualquier carga, Marisa revisa el archivo generado y aprueba explícitamente.
- Ningún dato real aparece en código, tests, logs ni commits.

## Consecuencias

- Las fechas resultantes no son las reales, pero tiempos de resolución, antigüedad relativa
  y tendencias conservan su forma.
- Cualquier columna del export que no esté listada arriba se **descarta por defecto**
  (lista blanca, no lista negra). Si alguna hiciera falta, se agrega a este ADR.
- Puntos a definir en la spec de la etapa: valor del offset de fechas, formato del archivo
  de salida y cómo se generan los títulos.
