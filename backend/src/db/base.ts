import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Migraciones en orden. La versión aplicada se guarda en `PRAGMA user_version`; nunca se
 * edita una migración ya publicada: se agrega una nueva al final.
 */
export const MIGRACIONES: readonly string[] = [
  `CREATE TABLE tickets (
     clave                TEXT PRIMARY KEY,
     id_origen            TEXT NOT NULL,
     tipo                 TEXT NOT NULL,
     estado               TEXT NOT NULL,
     prioridad            TEXT NOT NULL,
     proyecto_clave       TEXT NOT NULL,
     proyecto_nombre      TEXT NOT NULL,
     tipo_proyecto        TEXT NOT NULL,
     responsable          TEXT NOT NULL,
     informador           TEXT NOT NULL,
     responsable_proyecto TEXT NOT NULL,
     titulo               TEXT NOT NULL,
     creada               TEXT NOT NULL,
     resuelta             TEXT,
     actualizada          TEXT NOT NULL,
     vencimiento          TEXT
   );
   CREATE TABLE sync_runs (
     id       INTEGER PRIMARY KEY AUTOINCREMENT,
     inicio   TEXT NOT NULL,
     fin      TEXT NOT NULL,
     ok       INTEGER NOT NULL,
     tickets  INTEGER,
     error    TEXT
   );`,
];

export function migrar(db: DatabaseSync): void {
  const fila = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let version = fila.user_version; version < MIGRACIONES.length; version++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRACIONES[version] ?? '');
      db.exec(`PRAGMA user_version = ${String(version + 1)}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

/** Abre (o crea) la base y aplica las migraciones pendientes. `:memory:` para tests. */
export function abrirBase(ruta: string): DatabaseSync {
  if (ruta !== ':memory:') mkdirSync(dirname(ruta), { recursive: true });
  const db = new DatabaseSync(ruta);
  db.exec('PRAGMA journal_mode = WAL');
  migrar(db);
  return db;
}
