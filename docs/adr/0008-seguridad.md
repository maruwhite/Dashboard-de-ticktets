# ADR-0008: Seguridad y credenciales

- **Estado:** Aceptado
- **Fecha:** 2026-10-09

## Contexto

El repositorio es público. El backend usa un token de Jira con acceso a los datos
importados, y los datos derivan de información real de la empresa.

## Decisión

- Credenciales **solo en `.env`**, que está en `.gitignore`. El repo incluye `.env.example`
  con los nombres de las variables y sin valores.
- La configuración se valida al arrancar (esquema tipado): si falta una variable, el
  proceso falla con un mensaje que nombra la variable, nunca su valor.
- El token de Jira **nunca** llega al frontend, a los logs ni al repo:
  - el frontend solo conoce la URL del backend propio;
  - el logger redacta `Authorization`, `*_TOKEN`, `*_SECRET` y similares;
  - los errores de Jira se registran resumidos, sin cabeceras ni cuerpos.
- `data/`, `*.csv`, `*.xlsx`, `*.xls` y `.env*` están excluidos de git.
- Se recomienda activar *secret scanning* y *push protection* en GitHub.

## Consecuencias

- Cualquier nueva credencial sigue el mismo patrón (`.env` + `.env.example` + redacción).
- Si un token se filtra, se revoca en Atlassian y se genera uno nuevo; no se intenta
  "borrarlo" del historial como única medida.
