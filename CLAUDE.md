# CLAUDE.md — Dashboard de tickets

Reglas permanentes para trabajar en este repositorio. Las decisiones de diseño y su
justificación están en `docs/adr/`; el detalle de cada etapa, en `docs/specs/`.

## Qué es

Dashboard con backend propio que muestra el estado real de tickets de Jira.
El dashboard **siempre** obtiene los datos de la API de Jira (vía el sync del backend);
nunca de archivos locales. Ver [ADR-0002](docs/adr/0002-arquitectura-y-flujo-de-datos.md).

## Forma de trabajo

- El proyecto avanza por **etapas** (ver [ADR-0009](docs/adr/0009-proceso-por-etapas.md)).
  Cada etapa tiene una spec en `docs/specs/` que **debe estar aprobada por Marisa antes de
  implementar**. Sin spec aprobada, no se escribe código de esa etapa.
- Si durante la implementación algo contradice la spec o un ADR, se frena y se consulta;
  no se improvisa. Las decisiones nuevas se registran como ADR.
- Git: una rama por etapa (`etapa-N-descripcion`) y pull request a `main`; nunca push
  directo a `main`. El CI tiene que estar en verde para mergear. Gestor de paquetes: npm.
- Idioma: documentación, mensajes de commit y textos de UI en español. Identificadores de
  código en inglés.

## Datos reales: reglas no negociables

- El export real vive en `data/Tickets_jira.xlsx`. La carpeta `data/` está en `.gitignore`
  y **nunca se commitea**, ni ella ni nada derivado sin anonimizar.
- **Ningún dato real** (nombres, mails, títulos, proyectos, claves, descripciones) puede
  aparecer en código, tests, fixtures, logs, mensajes de commit, issues ni en respuestas
  que se copien al repo. Los tests usan datos inventados.
- No se sube nada a Jira sin que Marisa haya revisado y aprobado el archivo anonimizado.
- Reglas de anonimización: [ADR-0003](docs/adr/0003-anonimizacion.md).

## Seguridad

- Credenciales solo en `.env` (nunca commiteado). Se documentan en `.env.example` sin valores.
- El token de Jira nunca llega al frontend, a los logs ni al repo. El logger redacta
  cabeceras `Authorization` y cualquier variable `*_TOKEN`.
- Ver [ADR-0008](docs/adr/0008-seguridad.md).

## Jira

- Buscar con `POST /rest/api/3/search/jql` (paginación por `nextPageToken`). El endpoint
  viejo `/rest/api/3/search` está deprecado: no usarlo.
- La fecha de creación histórica va a un campo personalizado; los tickets nacen en
  "Planificado" y llegan a su estado por transiciones. Ver
  [ADR-0004](docs/adr/0004-carga-a-jira.md).
- Mapeo de estados a grupos: [ADR-0005](docs/adr/0005-estados.md). Es la única fuente
  de verdad; no duplicar la tabla en otros lugares del código.

## Calidad (nunca saltear)

- TypeScript `strict`. ESLint estricto con **cero warnings**. Prettier.
- Tests con coverage mínimo **80 %** (líneas, ramas, funciones y sentencias).
- Hooks de pre-commit (lint, typecheck, tests) y CI en GitHub Actions.
- **Prohibido** `--no-verify`, `eslint-disable` sin justificación en el mismo comentario,
  `@ts-ignore`, `any` explícito, bajar umbrales de coverage o desactivar checks del CI
  para que algo pase. Si una validación falla, se corrige la causa.
- Ver [ADR-0007](docs/adr/0007-calidad.md).

## Stack

Node + Express + TypeScript · SQLite · React + Vite + Recharts · sync cada 5 minutos.
Ver [ADR-0001](docs/adr/0001-stack.md).

## Skills del proyecto

En `.claude/skills/`: `seed` (anonimización y carga a Jira), `sync`, `metricas`, `ui`.
