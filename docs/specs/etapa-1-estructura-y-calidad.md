# Etapa 1 — Estructura y harness de calidad

- **Estado:** Aprobada (2026-10-09)
- **Fecha:** 2026-10-09
- **ADRs relacionados:** [0001](../adr/0001-stack.md), [0007](../adr/0007-calidad.md),
  [0008](../adr/0008-seguridad.md), [0009](../adr/0009-proceso-por-etapas.md)

## Objetivo

Dejar el repositorio listo para que todas las etapas siguientes se construyan con las
validaciones ya activas: estructura del monorepo, TypeScript strict, ESLint con cero
warnings, Prettier, tests con coverage ≥ 80 %, hooks de pre-commit y CI en GitHub Actions.

Al terminar, el proyecto no hace nada de negocio: solo demuestra que el esqueleto compila,
se testea y se valida de punta a punta.

## Prerrequisitos

- **Node.js 24 LTS** instalado en la PC. ✅ Instalado el 2026-10-09: Node 24.20.0,
  npm 11.19.0 (`winget install OpenJS.NodeJS.LTS`).

## Alcance

### 1. Estructura del monorepo (npm workspaces)

```
/
├── packages/shared/   tipos y lógica compartida (acá vivirá el mapeo de estados, etapa 5)
├── backend/           Express + TypeScript
├── frontend/          React + Vite + TypeScript
├── docs/              adr/ y specs/
├── data/              ignorada por git
├── .github/workflows/ ci.yml
└── .husky/            pre-commit
```

El workspace de scripts de seed (anonimización y carga) se crea en la etapa 2, no ahora.

### 2. Contenido mínimo de cada workspace

Solo lo necesario para que haya algo que compilar, lintear y testear:

- **shared:** un módulo trivial exportado y su test.
- **backend:**
  - App Express con `GET /api/health` → `{ "status": "ok" }`, separada del arranque del
    servidor (la app se testea con supertest sin abrir un puerto).
  - Carga y validación de configuración desde `.env` con un esquema tipado (zod). Si falta
    una variable, falla con un mensaje que nombra la variable, nunca su valor.
  - Logger estructurado (pino) con redacción de `authorization`, `*token*`, `*secret*`,
    `*password*`.
  - `.env.example` con `PORT` y las variables de Jira (`JIRA_BASE_URL`, `JIRA_EMAIL`,
    `JIRA_API_TOKEN`) sin valores. En esta etapa las de Jira son opcionales.
- **frontend:** app Vite + React que muestra el título "Dashboard de tickets" y un test con
  React Testing Library. Proxy de Vite `/api` → backend en desarrollo.

### 3. TypeScript

- `tsconfig.base.json` en la raíz con `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`.
- Cada workspace extiende la base. Typecheck con `tsc --noEmit` (project references).

### 4. ESLint y Prettier

- ESLint 9 (flat config) con `typescript-eslint` `strictTypeChecked` +
  `stylisticTypeChecked`; `eslint-plugin-react-hooks` y `react-refresh` en el frontend;
  `eslint-config-prettier` para que no choque con Prettier.
- Reglas adicionales: prohibido `any` explícito, `@ts-ignore`, `console` (se usa el logger)
  y `eslint-disable` sin descripción.
- Se ejecuta con `--max-warnings 0`.
- Prettier con configuración mínima; `.gitattributes` con `eol=lf` para que Windows y CI
  formateen igual.

### 5. Tests y coverage

- Vitest en cada workspace (entorno `node` en backend/shared, `jsdom` en frontend).
- Coverage con `@vitest/coverage-v8`, umbral **80 %** en líneas, ramas, funciones y
  sentencias. Si no se alcanza, el comando falla.
- Exclusiones de coverage listadas explícitamente (configuración, `main.tsx`, `server.ts`).

### 6. Scripts de la raíz

| Script                            | Qué hace                                             |
| --------------------------------- | ---------------------------------------------------- |
| `npm run format` / `format:check` | Prettier escribe / verifica                          |
| `npm run lint`                    | ESLint, cero warnings                                |
| `npm run typecheck`               | `tsc` en todos los workspaces                        |
| `npm test`                        | Vitest en todos los workspaces                       |
| `npm run test:coverage`           | Igual, con umbrales de coverage                      |
| `npm run build`                   | Build de backend y frontend                          |
| `npm run check`                   | Todo lo anterior en orden (lo mismo que corre el CI) |
| `npm run dev`                     | Backend y frontend juntos en modo desarrollo         |

### 7. Pre-commit (husky)

- Corre `format:check`, `lint`, `typecheck` y `test`.
- Además, verificación de seguridad: rechaza el commit si hay archivos _staged_ dentro de
  `data/`, o con extensión `.env`, `.csv`, `.xlsx`, `.xls` (salvo `sample*.csv` /
  `ejemplo*.csv`).

### 8. CI (GitHub Actions)

- `.github/workflows/ci.yml`, en cada push y pull request a `main`.
- Node 24, `npm ci`, `format:check`, `lint`, `typecheck`, `test:coverage`, `build`.
- Cache de npm. Permisos mínimos (`contents: read`).

### 9. Documentación

- README actualizado: requisitos, cómo instalar, cómo correr, cómo validar, estructura y
  enlace a ADRs y specs.

## Fuera de alcance

Anonimización, cliente de Jira, sync, SQLite, métricas, endpoints de negocio, UI del
dashboard. Cualquier código de esas etapas.

## Criterios de aceptación

1. En un clon limpio: `npm ci && npm run check` termina sin errores ni warnings.
2. `npm run dev` levanta backend y frontend; `GET /api/health` responde `{ "status": "ok" }`
   y el frontend muestra "Dashboard de tickets".
3. Agregar una variable sin usar o un `any` hace fallar `npm run lint`.
4. Bajar artificialmente el coverage por debajo de 80 % hace fallar `npm run test:coverage`.
5. Un commit con un test fallando es rechazado por el hook.
6. Intentar commitear un archivo en `data/` o un `.env` es rechazado por el hook (aunque se
   fuerce con `git add -f`).
7. El CI corre en GitHub y queda en verde en `main`.
8. El backend arranca sin `.env` de Jira y no imprime ningún secreto en los logs.
9. No hay ningún dato real en el repo.

## Decisiones tomadas al aprobar

1. **Node:** instalado Node 24.20.0.
2. **Gestor de paquetes:** npm.
3. **Flujo de trabajo:** una rama por etapa y pull request a `main`, con el CI obligatorio
   para mergear (branch protection, la configura Marisa en GitHub).
4. **Documentación:** se commitea en la rama de esta etapa.
5. **ADR-0006 (métricas):** los puntos _[a confirmar]_ se resuelven antes de la etapa 5.
