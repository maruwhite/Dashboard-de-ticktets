# Dashboard de tickets

Dashboard con backend propio que muestra el **estado real** de los tickets de Jira, sin
cargar nada a mano: el backend sincroniza contra la API de Jira cada 5 minutos y el
frontend consume solo la API propia.

> **Estado:** etapa 1 (estructura y harness de calidad). Ver el plan en
> [ADR-0009](docs/adr/0009-proceso-por-etapas.md).

## Arquitectura

```
Jira (API) ──sync cada 5 min──► backend (Express + SQLite) ──API REST──► frontend (React)
```

| Carpeta            | Contenido                                                                |
| ------------------ | ------------------------------------------------------------------------ |
| `backend/`         | API propia (Node + Express + TypeScript)                                 |
| `frontend/`        | Dashboard (React + Vite + Recharts)                                      |
| `packages/shared/` | Tipos y lógica compartida entre backend y frontend                       |
| `tools/`           | Utilidades del repo (verificación de archivos en el pre-commit)          |
| `docs/adr/`        | Decisiones de arquitectura                                               |
| `docs/specs/`      | Especificación de cada etapa                                             |
| `data/`            | Datos locales (export real de Jira). **Ignorada por git, nunca se sube** |

## Requisitos

- Node.js 24 LTS (ver `.nvmrc`)
- npm (incluido con Node)

## Puesta en marcha

```bash
npm install
cp backend/.env.example backend/.env   # completar si hace falta; en la etapa 1 es opcional
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000/api/health

## Validaciones

| Comando                 | Qué hace                                                                  |
| ----------------------- | ------------------------------------------------------------------------- |
| `npm run check`         | Todo lo que corre el CI: formato, lint, tipos, tests con coverage y build |
| `npm run format`        | Formatea con Prettier                                                     |
| `npm run lint`          | ESLint estricto, cero warnings                                            |
| `npm run typecheck`     | TypeScript strict en todos los workspaces                                 |
| `npm test`              | Tests (Vitest)                                                            |
| `npm run test:coverage` | Tests con coverage mínimo del 80 %                                        |

Cada commit pasa por un hook de pre-commit (formato, lint, tipos y tests) que además
rechaza archivos de `data/`, `.env`, planillas y CSV. Cada push y pull request a `main`
corre el CI en GitHub Actions.

## Datos y seguridad

- El export real de Jira se anonimiza antes de cargarlo en un Jira de prueba: ver
  [ADR-0003](docs/adr/0003-anonimizacion.md). Ningún dato real aparece en el repo.
- Las credenciales van solo en `backend/.env`. El token de Jira nunca llega al frontend ni a
  los logs: ver [ADR-0008](docs/adr/0008-seguridad.md).

## Documentación

- [Decisiones de arquitectura (ADR)](docs/adr/README.md)
- [Especificaciones por etapa](docs/specs/)
