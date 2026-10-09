# Etapa 3 — Carga a Jira

- **Estado:** Aprobada (2026-10-09)
- **Fecha:** 2026-10-09
- **ADRs relacionados:** [0004](../adr/0004-carga-a-jira.md), [0005](../adr/0005-estados.md),
  [0008](../adr/0008-seguridad.md)

## Objetivo

Un script que toma `data/anonimizado/tickets.csv` (ya aprobado) y lo carga por API en el
Jira Cloud personal de Marisa, dejando cada ticket en su estado y con sus fechas históricas.

## Prerrequisitos (los hace Marisa)

1. Cuenta de **Jira Cloud Free** creada; URL del sitio (`https://<sitio>.atlassian.net`).
2. **API token** generado en id.atlassian.com → Security → API tokens.
3. `backend/.env` con `JIRA_BASE_URL`, `JIRA_EMAIL` y `JIRA_API_TOKEN`. El script de carga
   lee ese mismo archivo (una sola fuente de credenciales).
4. Etapa 2 aprobada: `tickets.csv` revisado.

## Alcance

Dos comandos en el workspace `seed`, ambos **idempotentes** y con modo simulación por
defecto (muestran qué harían sin tocar Jira). Para ejecutar de verdad hace falta
`--confirmar`.

### 1. `npm run jira:preparar -w seed` — configura el sitio

Crea lo que falte (si ya existe, lo reutiliza):

- **Campos personalizados** (fecha y hora): "Creada (histórica)", "Resuelta (histórica)",
  y "ID origen" (texto, para idempotencia). Si se elige la opción B de personas (ver
  preguntas): "Responsable (dato)", "Informador (dato)" y "Responsable del proyecto (dato)"
  (en ese caso el responsable nativo de cada proyecto en Jira es Marisa).
- **Campo "Tipo de proyecto"** (lista: `service_desk`, `software`), ver decisión abajo.
- **Tipos de incidencia** que no existan (Solicitud de servicio, Incidente, Consulta,
  Requerimiento, Requerimiento Interno).
- **Estados** del ADR-0005 y un **workflow** con transiciones globales (cualquier estado →
  cualquier estado), asociado a los proyectos.
- **Proyectos** `PRJA`… (tipo _software_, _company-managed_), con su responsable.
- **Usuarios** (si se elige la opción A de personas).

Al final imprime los ids de los campos personalizados para guardarlos en `backend/.env`
(`JIRA_FIELD_CREADA`, `JIRA_FIELD_RESUELTA`, etc.), así el sync no los tiene hardcodeados.

Si alguna configuración no se puede hacer por API (el soporte de Jira para workflows por API
es limitado), el script se frena y muestra los pasos manuales exactos para hacerla desde la
interfaz. Eso es configuración del sitio, no carga de datos.

### 2. `npm run jira:cargar -w seed` — carga los tickets

Por cada fila de `tickets.csv`:

1. Si ya existe un ticket con ese `ID origen`, se saltea (o se actualiza si cambió).
2. Se crea en su proyecto con tipo, título, prioridad, informador y responsable. Nace en
   "Planificado".
3. Se completan "Creada (histórica)" y "Resuelta (histórica)".
4. Se aplica la transición al estado final.

- Respeta `429 / Retry-After`, con reintentos y backoff.
- Muestra progreso (`120/231`) y un resumen final: creados, salteados, errores.
- Nunca loguea el token, cabeceras ni cuerpos completos.

### Tipo de proyecto

En Jira Free, los proyectos `service_desk` requieren Jira Service Management (producto
aparte). Propuesta: **todos los proyectos se crean como software** y el tipo original se
guarda en el campo "Tipo de proyecto"; el dashboard usa ese campo. Así se conserva el dato
sin depender de otro producto.

### Tests

Cliente HTTP inyectado y simulado (sin llamadas reales): idempotencia, reintentos ante 429,
modo simulación sin escrituras, error a mitad de la carga y reanudación, armado correcto de
payloads (ADF para textos, formato de fechas de Jira).

## Fuera de alcance

Sync y dashboard. Borrar datos de Jira: si hubiera que empezar de cero, se documenta cómo
hacerlo a mano.

## Criterios de aceptación

1. `jira:preparar --confirmar` deja el sitio configurado; correrlo dos veces no duplica nada.
2. `jira:cargar --confirmar` crea todos los tickets en su estado y con sus fechas históricas.
3. Correrlo de nuevo no crea duplicados.
4. Sin `--confirmar` no se escribe nada en Jira.
5. Ningún secreto en consola ni logs.
6. `npm run check` pasa con coverage ≥ 80 %.

## Decisiones tomadas al aprobar

1. **Personas: opción B.** Se guardan como texto en los campos "Responsable (dato)",
   "Informador (dato)" y "Responsable del proyecto (dato)". No se crean usuarios en Jira; el
   responsable nativo de cada proyecto es Marisa.
2. **Tipo de proyecto:** todos los proyectos se crean como software; el tipo original va en
   el campo "Tipo de proyecto".
