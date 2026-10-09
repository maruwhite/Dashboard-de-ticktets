# Etapa 8 — Modo demo

- **Estado:** Aprobada (2026-10-09)
- **Fecha:** 2026-10-09
- **ADRs relacionados:** [0014](../adr/0014-modo-demo.md)

## Objetivo

Que cualquiera que clone el repo pueda ver el dashboard funcionando sin credenciales de Jira.

## Alcance

1. **Foto de datos:** `backend/demo/tickets.json` con los 231 tickets anonimizados, generada
   desde la base sincronizada con `npm run demo:exportar -w backend`.
2. **Verificación de fugas:** `npm run demo:verificar -w seed` compara la foto con
   `data/Tickets_jira.xlsx` y falla si encuentra cualquier valor original (personas, proyectos,
   claves, títulos). Se corre antes de commitear la foto.
3. **Backend:** sin `JIRA_BASE_URL`, el sync se desactiva solo (antes exigía las credenciales).
   Con el sync desactivado y la base vacía, se carga la foto. `EstadoSync` informa
   `modoDemo: true`.
4. **UI:** aviso "Modo demo: datos anonimizados de ejemplo, sin sincronización con Jira".
5. **README:** sección "Probarlo en 2 minutos".
6. **Reglas:** `CLAUDE.md` y ADR-0014 documentan la excepción.

## Criterios de aceptación

1. Con el repo recién clonado (sin `.env`), `npm install` y `npm run dev` muestran los 231
   tickets con el aviso de modo demo.
2. Con `backend/.env` completo, sigue sincronizando con Jira, sin aviso de demo.
3. La verificación de fugas pasa: la foto no contiene ningún valor del export real.
4. `npm run check` pasa con coverage ≥ 80 %.
