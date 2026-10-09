// Datos de prueba inventados para los tests del frontend.
import type { RespuestaDashboard } from '@dashboard/shared';

export function dashboardDePrueba(cambios: Partial<RespuestaDashboard> = {}): RespuestaDashboard {
  return {
    totalSinFiltrar: 1234,
    kpis: {
      total: 1234,
      abiertos: 30,
      enCurso: 12,
      enEspera: 8,
      completados: 1180,
      descartados: 24,
      estancados: 5,
      vencidos: 0,
      cycleTime: { promedioDias: 71.6, medianaDias: 19.8, tickets: 132 },
    },
    distribuciones: {
      estado: [
        { valor: 'Finalizado', etiqueta: 'Finalizado', cantidad: 900, grupo: 'Completado' },
        { valor: 'Cerrado', etiqueta: 'Cerrado', cantidad: 280, grupo: 'Completado' },
        { valor: 'En curso', etiqueta: 'En curso', cantidad: 12, grupo: 'En curso' },
        { valor: 'Pausado', etiqueta: 'Pausado', cantidad: 8, grupo: 'En espera' },
        { valor: 'Planificado', etiqueta: 'Planificado', cantidad: 10, grupo: 'Por hacer' },
        { valor: 'Cancelado', etiqueta: 'Cancelado', cantidad: 14, grupo: 'Descartado' },
        { valor: 'Rechazado', etiqueta: 'Rechazado', cantidad: 10, grupo: 'Descartado' },
      ],
      tipoIncidencia: [
        { valor: 'Tarea', etiqueta: 'Tarea', cantidad: 1000 },
        { valor: 'Incidente', etiqueta: 'Incidente', cantidad: 234 },
      ],
      proyecto: [
        { valor: 'PRJB', etiqueta: 'PRJB', cantidad: 800 },
        { valor: 'PRJA', etiqueta: 'PRJA', cantidad: 434 },
      ],
      tipoProyecto: [{ valor: 'software', etiqueta: 'software', cantidad: 1234 }],
      prioridad: [{ valor: 'Media', etiqueta: 'Media', cantidad: 1234 }],
      responsable: [
        { valor: 'Agente 1', etiqueta: 'Agente 1', cantidad: 1200 },
        { valor: '', etiqueta: '(sin dato)', cantidad: 34 },
      ],
      informador: [{ valor: 'Usuario 1', etiqueta: 'Usuario 1', cantidad: 1234 }],
      responsableProyecto: [
        { valor: 'Usuario 2', etiqueta: 'Usuario 2', cantidad: 800 },
        { valor: 'Usuario 3', etiqueta: 'Usuario 3', cantidad: 434 },
      ],
    },
    tendencia: [
      { periodo: '2026-01', creados: 10, resueltos: 4 },
      { periodo: '2026-02', creados: 0, resueltos: 0 },
      { periodo: '2026-03', creados: 3, resueltos: 7 },
    ],
    opciones: {
      proyecto: [
        { valor: 'PRJA', etiqueta: 'PRJA — Proyecto Alfa' },
        { valor: 'PRJB', etiqueta: 'PRJB — Proyecto Beta' },
      ],
      tipoProyecto: [{ valor: 'software', etiqueta: 'software' }],
      tipoIncidencia: [
        { valor: 'Incidente', etiqueta: 'Incidente' },
        { valor: 'Tarea', etiqueta: 'Tarea' },
      ],
      estado: [
        { valor: 'Cerrado', etiqueta: 'Cerrado' },
        { valor: 'En curso', etiqueta: 'En curso' },
        { valor: 'Finalizado', etiqueta: 'Finalizado' },
      ],
      prioridad: [{ valor: 'Media', etiqueta: 'Media' }],
      responsable: [
        { valor: '', etiqueta: '(sin dato)' },
        { valor: 'Agente 1', etiqueta: 'Agente 1' },
      ],
      informador: [{ valor: 'Usuario 1', etiqueta: 'Usuario 1' }],
      responsableProyecto: [
        { valor: 'Usuario 2', etiqueta: 'Usuario 2' },
        { valor: 'Usuario 3', etiqueta: 'Usuario 3' },
      ],
    },
    sync: {
      activo: true,
      modoDemo: false,
      intervaloMinutos: 5,
      ultimoIntento: { fin: '2026-10-09T14:57:00.000Z', ok: true, error: null },
      ultimoExitoso: { fin: '2026-10-09T14:57:00.000Z', tickets: 1234 },
    },
    ...cambios,
  };
}
