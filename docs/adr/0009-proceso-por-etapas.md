# ADR-0009: Proceso por etapas con spec aprobada

- **Estado:** Aceptado
- **Fecha:** 2026-10-09

## Contexto

El proyecto mezcla datos sensibles, una integración externa y un challenge evaluado. Se
quiere control explícito sobre cada paso, especialmente antes de tocar datos reales o subir
algo a Jira.

## Decisión

El trabajo se divide en etapas. Cada una tiene una spec en `docs/specs/` que Marisa aprueba
**antes** de implementar:

1. Estructura y harness de calidad
2. Anonimización — control: Marisa revisa el archivo antes de subir nada
3. Carga a Jira
4. Sync
5. Métricas y filtros
6. Endpoints
7. UI

Cada spec define: objetivo, alcance, fuera de alcance, entregables, criterios de
aceptación y preguntas abiertas. Al aprobarse, su estado pasa a "Aprobada".

## Consecuencias

- No se adelanta trabajo de etapas futuras, aunque parezca trivial.
- Si al implementar aparece algo no previsto, se frena y se actualiza la spec (o se crea un
  ADR) antes de seguir.
