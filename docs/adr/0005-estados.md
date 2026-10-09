# ADR-0005: Estados y grupos de estado

- **Estado:** Aceptado
- **Fecha:** 2026-10-09

## Contexto

El workflow real tiene muchos estados con nombres parecidos o duplicados. Las métricas
necesitan agruparlos de forma estable.

## Decisión

| Grupo | Estados |
|---|---|
| **Por hacer** | Planificado |
| **En curso** | Análisis y Estimación, Análisis y Diseño funcional, En curso |
| **En espera** | Solicitud información a Usuario, Pausado |
| **Completado** | Cerrado, Finalizado, Finalizada → se unifican como **Finalizado** |
| **Descartado** | Cancelado, Rechazado |

- Los **descartados no cuentan como completados** ni entran en el cycle time.
- El mapeo vive en **un único módulo** del paquete compartido; backend y frontend lo
  importan. Ningún otro lugar compara nombres de estado.
- La comparación de nombres ignora mayúsculas y espacios sobrantes.

## Consecuencias

- Un estado que no esté en la tabla se clasifica como **"Sin clasificar"**, se registra un
  aviso en el log del sync (con el nombre del estado, que no es un dato sensible) y aparece
  así en el dashboard, en lugar de asignarlo silenciosamente a un grupo.
- Agregar un estado nuevo requiere actualizar este ADR y el módulo de mapeo.
