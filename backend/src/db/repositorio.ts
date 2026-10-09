import type { DatabaseSync } from 'node:sqlite';
import type { Ticket } from '../jira/mapeo.js';

export interface RegistroSync {
  inicio: string;
  fin: string;
  ok: boolean;
  tickets: number | null;
  error: string | null;
}

interface FilaTicket {
  clave: string;
  id_origen: string;
  tipo: string;
  estado: string;
  prioridad: string;
  proyecto_clave: string;
  proyecto_nombre: string;
  tipo_proyecto: string;
  responsable: string;
  informador: string;
  responsable_proyecto: string;
  titulo: string;
  creada: string;
  resuelta: string | null;
  actualizada: string;
  vencimiento: string | null;
}

interface FilaSync {
  inicio: string;
  fin: string;
  ok: number;
  tickets: number | null;
  error: string | null;
}

const COLUMNAS_SYNC = 'inicio, fin, ok, tickets, error';

const aRegistro = (fila: FilaSync): RegistroSync => ({ ...fila, ok: fila.ok === 1 });

export class Repositorio {
  constructor(private readonly db: DatabaseSync) {}

  /** Reemplaza todos los tickets en una transacción: o se aplica completo o no cambia nada. */
  reemplazarTickets(tickets: readonly Ticket[]): void {
    const insertar = this.db.prepare(
      `INSERT INTO tickets (clave, id_origen, tipo, estado, prioridad, proyecto_clave,
         proyecto_nombre, tipo_proyecto, responsable, informador, responsable_proyecto, titulo,
         creada, resuelta, actualizada, vencimiento)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.db.exec('BEGIN');
    try {
      this.db.exec('DELETE FROM tickets');
      for (const t of tickets) {
        insertar.run(
          t.clave,
          t.idOrigen,
          t.tipo,
          t.estado,
          t.prioridad,
          t.proyectoClave,
          t.proyectoNombre,
          t.tipoProyecto,
          t.responsable,
          t.informador,
          t.responsableProyecto,
          t.titulo,
          t.creada,
          t.resuelta,
          t.actualizada,
          t.vencimiento,
        );
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  contarTickets(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM tickets').get() as { n: number }).n;
  }

  listarTickets(): Ticket[] {
    const filas = this.db
      .prepare('SELECT * FROM tickets ORDER BY clave')
      .all() as unknown as FilaTicket[];
    return filas.map((f) => ({
      clave: f.clave,
      idOrigen: f.id_origen,
      tipo: f.tipo,
      estado: f.estado,
      prioridad: f.prioridad,
      proyectoClave: f.proyecto_clave,
      proyectoNombre: f.proyecto_nombre,
      tipoProyecto: f.tipo_proyecto,
      responsable: f.responsable,
      informador: f.informador,
      responsableProyecto: f.responsable_proyecto,
      titulo: f.titulo,
      creada: f.creada,
      resuelta: f.resuelta,
      actualizada: f.actualizada,
      vencimiento: f.vencimiento,
    }));
  }

  registrarSync(registro: RegistroSync): void {
    this.db
      .prepare('INSERT INTO sync_runs (inicio, fin, ok, tickets, error) VALUES (?, ?, ?, ?, ?)')
      .run(registro.inicio, registro.fin, registro.ok ? 1 : 0, registro.tickets, registro.error);
  }

  /** Último intento de sync, haya salido bien o mal. */
  ultimoSync(): RegistroSync | undefined {
    const fila = this.db
      .prepare(`SELECT ${COLUMNAS_SYNC} FROM sync_runs ORDER BY id DESC LIMIT 1`)
      .get() as FilaSync | undefined;
    return fila ? aRegistro(fila) : undefined;
  }

  /** Último sync exitoso: es la antigüedad real de los datos que muestra el dashboard. */
  ultimoSyncExitoso(): RegistroSync | undefined {
    const fila = this.db
      .prepare(`SELECT ${COLUMNAS_SYNC} FROM sync_runs WHERE ok = 1 ORDER BY id DESC LIMIT 1`)
      .get() as FilaSync | undefined;
    return fila ? aRegistro(fila) : undefined;
  }
}
