# ADR-0007: Calidad y validaciones

- **Estado:** Aceptado
- **Fecha:** 2026-10-09

## Contexto

El proyecto es un challenge evaluado por la empresa y además maneja datos derivados de
información sensible. La calidad tiene que estar garantizada por herramientas, no por
disciplina.

## Decisión

- **TypeScript** con `strict: true` (y `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitOverride`).
- **ESLint** estricto con reglas que usan información de tipos (`typescript-eslint`
  `strictTypeChecked` + `stylisticTypeChecked`), ejecutado con `--max-warnings 0`.
- **Prettier** como único formateador; ESLint no opina de formato.
- **Tests** con Vitest; coverage mínimo **80 %** en líneas, ramas, funciones y sentencias,
  configurado como umbral que hace fallar el comando.
- **Pre-commit** (husky): lint, typecheck y tests.
- **CI** en GitHub Actions en cada push y pull request: instalación limpia, formato, lint,
  typecheck, tests con coverage y build.
- **Nunca se saltean las validaciones:** no `--no-verify`, no `@ts-ignore`, no bajar
  umbrales, no desactivar jobs.

## Consecuencias

- Los commits son algo más lentos (corren los tests); es el costo aceptado.
- Código de difícil testeo (arranque del servidor, scheduler) se mantiene mínimo y la lógica
  se extrae a funciones puras testeables, en lugar de excluir archivos del coverage.
- Las exclusiones de coverage se limitan a archivos de configuración y puntos de entrada, y
  quedan listadas explícitamente en la configuración.
