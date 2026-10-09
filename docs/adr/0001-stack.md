# ADR-0001: Stack tecnológico

- **Estado:** Aceptado
- **Fecha:** 2026-10-09

## Contexto

El challenge pide un dashboard con backend propio que muestre el estado real de los tickets
del equipo, sin carga manual. El proyecto lo evalúa la empresa: tiene que ser fácil de
correr, de leer y de mantener.

## Decisión

- **Backend:** Node.js + Express + TypeScript.
- **Persistencia local:** SQLite (copia sincronizada de Jira, ver ADR-0002).
- **Frontend:** React + Vite + Recharts, en TypeScript.
- **Sync:** cada 5 minutos contra la API de Jira.
- **Repo:** monorepo con npm workspaces. Tipos y mapeo de estados compartidos en un paquete
  común, para no duplicarlos entre backend y frontend.

## Consecuencias

- Un solo lenguaje de punta a punta; los tipos de dominio (`Ticket`, grupos de estado) se
  definen una vez.
- SQLite no requiere servidor: el proyecto corre con Node instalado y nada más.
- La elección concreta del driver de SQLite (`node:sqlite` nativo vs. `better-sqlite3`) se
  decide en la spec de la etapa de sync; `better-sqlite3` requiere compilación nativa en
  Windows.
- Recharts cubre barras, torta y líneas; si hiciera falta algo más complejo se evalúa en
  un ADR nuevo.
