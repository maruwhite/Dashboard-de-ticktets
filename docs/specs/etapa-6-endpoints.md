# Etapa 6 — Endpoints

- **Estado:** Aprobada (2026-10-09)
- **Fecha:** 2026-10-09
- **ADRs relacionados:** [0002](../adr/0002-arquitectura-y-flujo-de-datos.md),
  [0006](../adr/0006-metricas.md), [0008](../adr/0008-seguridad.md)

## Objetivo

Exponer por la API propia todo lo que necesita la UI: el dashboard calculado para un
conjunto de filtros y el estado del sync. El frontend hace una sola llamada por cada cambio de
filtros.

## Alcance

### `GET /api/dashboard`

Devuelve el `Dashboard` de la etapa 5 (KPIs, distribuciones, tendencia, opciones, total sin
filtrar) más el estado del sync, calculado sobre los tickets de SQLite.

**Filtros por query string**, con claves repetidas para varios valores, para que una vista se
pueda compartir copiando la URL:

```
/api/dashboard?proyecto=PRJA&proyecto=PRJB&estado=Cerrado&desde=2025-01-01&hasta=2025-12-31
```

| Parámetro                                                                                                               | Formato                          |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `proyecto`, `tipoProyecto`, `tipoIncidencia`, `estado`, `prioridad`, `responsable`, `informador`, `responsableProyecto` | Texto; se puede repetir          |
| `desde`, `hasta`                                                                                                        | `AAAA-MM-DD` (fecha real válida) |

- **Validación con zod:** parámetros desconocidos, fechas inválidas, `desde` posterior a
  `hasta`, más de 100 valores por dimensión o valores de más de 200 caracteres → `400` con un
  mensaje que nombra el parámetro.
- Un valor vacío (`?estado=`) filtra por "(sin dato)", para que funcione el clic en esa barra.
- "Ahora" es la hora del servidor al recibir el pedido.

**Respuesta:**

```ts
interface RespuestaDashboard extends Dashboard {
  sync: {
    activo: boolean; // SYNC_ENABLED
    intervaloMinutos: number;
    ultimoIntento: { fin: string; ok: boolean; error: string | null } | null;
    ultimoExitoso: { fin: string; tickets: number } | null; // antigüedad real de los datos
  };
}
```

El tipo va en `packages/shared` para que la UI lo use tal cual.

### `POST /api/sync` — botón "Sincronizar ahora"

Dispara un sync inmediato con el mismo `Sincronizador` del sync automático y espera el
resultado (~3 s).

| Situación                               | Respuesta                                   |
| --------------------------------------- | ------------------------------------------- |
| Sync completado                         | `200` con `{ resultado, sync }`             |
| Jira falló (la base no cambia)          | `502` con `{ error }`                       |
| Ya hay un sync en curso                 | `409`                                       |
| Pasó menos de 1 minuto desde el último  | `429` con cabecera `Retry-After` (segundos) |
| Sync desactivado (`SYNC_ENABLED=false`) | `409`                                       |

El límite de uno por minuto evita abusos y protege el cupo de llamadas a Jira.

### `GET /api/health`

Se mantiene (`{ status: 'ok' }`), para monitoreo.

### Transversal

- **Errores:** JSON `{ error: string }`. `404` para rutas `/api` inexistentes; `500` con un
  mensaje genérico (el detalle va al log, nunca al cliente).
- **Cabeceras de seguridad** con `helmet` (sin `x-powered-by`, `nosniff`, etc.).
- **Log por pedido:** método, ruta, status y duración; sin cabeceras.
- **Sin CORS:** el frontend llega por el proxy de Vite en desarrollo y desde el mismo origen
  en producción.
- **Caché HTTP:** `Cache-Control: no-store`, porque los datos cambian con cada sync.
- El cálculo se hace en memoria por pedido (~230 tickets: instantáneo).

### Tests

Con supertest y una base SQLite en memoria con datos inventados: respuesta sin filtros, cada
tipo de filtro, claves repetidas, valor vacío, cada error de validación, estado del sync con y
sin syncs registrados, 404, 500 sin detalle interno y cabeceras de seguridad.

## Fuera de alcance

- UI (etapa 7).
- Servir el frontend compilado desde el backend en producción y el despliegue: se definen al
  final, junto con la publicación.
- Autenticación (se decide con el despliegue).

## Criterios de aceptación

1. `GET /api/dashboard` sin filtros devuelve los 231 tickets con los mismos números que la
   verificación de la etapa 5.
2. Los filtros por URL dan el mismo resultado que `calcularDashboard` con esos filtros.
3. Pedidos inválidos reciben `400` con un mensaje claro; nunca un `500`.
4. La respuesta incluye la fecha del último sync exitoso y del último intento.
5. Ningún error expone stack traces, rutas internas ni secretos.
6. `npm run check` pasa con coverage ≥ 80 %.

## Decisiones tomadas al aprobar

1. **Sin autenticación** en esta etapa: los datos están anonimizados; se decide con el
   despliegue.
2. **Botón "Sincronizar ahora":** se agrega `POST /api/sync` con lock y límite de uno por
   minuto.

## Resultado

- Probado en vivo con la base real y el Jira de prueba: `GET /api/dashboard` devuelve los 231
  tickets con los mismos números que la verificación de la etapa 5; el filtro
  `?proyecto=PRJA&estado=Finalizado&estado=Cerrado` da 79 de 231; `POST /api/sync` sincroniza
  en ~4 s y un segundo pedido inmediato recibe `429` con `Retry-After`.
- Ajuste de lint: los parámetros que empiezan con `_` pueden quedar sin usar (el manejador de
  errores de Express exige cuatro parámetros), igual que en TypeScript.
- Los 6 criterios de aceptación se cumplen.
