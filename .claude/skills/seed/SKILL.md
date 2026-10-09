---
name: seed
description: Anonimizar el export real de Jira (data/Tickets_jira.xlsx) y cargarlo por API al Jira personal. Usar al trabajar en las etapas de anonimización o carga a Jira, o cuando haya que regenerar o volver a subir los datos de prueba.
---

# Seed: anonimización y carga a Jira

Dos pasos separados, con una revisión humana obligatoria entre ellos.

```
data/Tickets_jira.xlsx ──(1) anonimizar──► data/anonimizado.* ──(revisión de Marisa)──► (2) cargar a Jira
```

## Antes de empezar

- Leer [ADR-0003](../../../docs/adr/0003-anonimizacion.md) y
  [ADR-0004](../../../docs/adr/0004-carga-a-jira.md).
- Confirmar que existe una spec aprobada para la etapa en `docs/specs/`.

## Paso 1 — Anonimizar

- Entrada: `data/Tickets_jira.xlsx`. Salida: archivos dentro de `data/` (ignorada por git).
- **Se conservan:** tipo de incidencia, estado, prioridad, tipo de proyecto.
- **Se reemplazan:** informadores y responsables de proyecto → hasta 20 usuarios inventados y responsable → 5 agentes ficticios, guardados como texto en Jira
  (ADR-0010 y ADR-0011; mapeo consistente: la misma
  persona real siempre es el mismo usuario inventado); proyectos → `PRJA "Proyecto Alfa"`,
  `PRJB "Proyecto Beta"`…; títulos → texto generado.
- **Se descartan:** descripciones, comentarios, mails.
- **Fechas:** todas corridas por el mismo offset, para conservar duraciones.
- La tabla de equivalencias real → inventado **no se guarda** (ni en `data/`), para que el
  resultado no se pueda revertir.
- El script imprime solo conteos y resúmenes (filas leídas, personas mapeadas, columnas
  descartadas), nunca valores.
- Al terminar: **frenar** y pedirle a Marisa que revise el archivo. No avanzar al paso 2
  sin su aprobación explícita en el chat.

## Paso 2 — Cargar a Jira

- Lee solo el archivo anonimizado; nunca el `.xlsx` original.
- Crear el ticket (nace en "Planificado") → guardar la fecha de creación corrida en el
  campo personalizado → aplicar transiciones hasta el estado final.
- Idempotente: si se corta, se puede volver a correr sin duplicar tickets.
- Credenciales desde `.env`. Nunca loguear el token ni el payload completo.

## Prohibido

- Commitear cualquier cosa de `data/`.
- Copiar valores reales a código, tests, fixtures, logs, commits o al chat.
- Subir a Jira sin aprobación.
