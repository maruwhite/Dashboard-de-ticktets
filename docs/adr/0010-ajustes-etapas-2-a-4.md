# ADR-0010: Ajustes al aprobar las etapas 2 a 4

- **Estado:** Aceptado
- **Fecha:** 2026-10-09
- **Modifica:** [ADR-0003](0003-anonimizacion.md), [ADR-0004](0004-carga-a-jira.md),
  [ADR-0005](0005-estados.md); concreta [ADR-0001](0001-stack.md)

## Contexto

Al inspeccionar el export real (solo con conteos) y diseñar la carga en Jira Cloud Free
aparecieron restricciones que obligan a precisar decisiones anteriores.

## Decisión

1. **Personas como texto, no como usuarios de Jira** (modifica ADR-0003). Crear usuarios en
   Jira Cloud exige emails reales, consume licencias del plan gratuito y muestra el email
   hasta que se acepta la invitación. Los usuarios inventados (`Usuario 1` … `Usuario 9`)
   se guardan en campos personalizados de texto: "Responsable (dato)", "Informador (dato)"
   y "Responsable del proyecto (dato)".
2. **Reparto en 9 usuarios** (reemplazado por [ADR-0011](0011-reparto-de-personas.md)): las 8 personas con más apariciones tienen usuario propio; el
   resto se agrupa en `Usuario 9`.
3. **Estados** (modifica ADR-0005): solo "Finalizada" se unifica en "Finalizado". "Cerrado"
   es un estado propio dentro del grupo Completado.
4. **Subtareas** sin padre se cargan como "Tarea".
5. **Tipo de proyecto** (modifica ADR-0004): en Jira Free los proyectos _service_desk_
   requieren otro producto. Todos los proyectos se crean como _software_ y el tipo original
   se guarda en el campo personalizado "Tipo de proyecto".
6. **Fecha de resolución:** se confirma el campo personalizado "Resuelta (histórica)".
7. **SQLite:** driver `node:sqlite`, incluido en Node 24.

## Consecuencias

- El responsable nativo de Jira queda vacío en los tickets y el responsable de cada proyecto
  es Marisa. El dashboard usa siempre los campos "(dato)".
- Conectar el Jira corporativo en el futuro requeriría mapear las personas desde los campos
  nativos; queda aislado en el cliente de Jira del sync.
- El export trae 11 estados; tras unificar "Finalizada" quedan 10.
