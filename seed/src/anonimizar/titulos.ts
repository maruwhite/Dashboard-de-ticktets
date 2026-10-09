/**
 * Frases genéricas de IT para los títulos anonimizados. Ninguna sale del export: se eligen
 * por tipo de incidencia, en orden, para que el resultado sea determinístico.
 */
const TITULOS_POR_TIPO: Record<string, readonly string[]> = {
  epic: [
    'Migración de la plataforma de reportes',
    'Rediseño del circuito de aprobaciones',
    'Implementación del nuevo portal de autogestión',
    'Integración con el sistema de facturación',
    'Automatización de procesos de cierre',
    'Modernización del módulo de inventario',
    'Unificación de catálogos de servicios',
    'Mejora de la experiencia de usuarios internos',
  ],
  tarea: [
    'Actualizar configuración del reporte mensual',
    'Revisar permisos de acceso por perfil',
    'Documentar procedimiento de respaldo',
    'Ajustar validaciones del formulario de alta',
    'Optimizar consulta de búsqueda de clientes',
    'Preparar ambiente de pruebas',
    'Depurar registros duplicados',
    'Actualizar dependencias del módulo de notificaciones',
  ],
  'solicitud de servicio': [
    'Alta de usuario en el sistema de gestión',
    'Solicitud de acceso a carpeta compartida',
    'Cambio de perfil de usuario',
    'Instalación de software autorizado',
    'Baja de cuenta de usuario',
    'Solicitud de nuevo reporte',
  ],
  incidente: [
    'Error al generar reporte de ventas',
    'Lentitud en el acceso al portal',
    'Falla en el envío de notificaciones',
    'No se puede iniciar sesión en la aplicación',
    'Error de sincronización de datos',
    'Caída intermitente del servicio de consultas',
  ],
  consulta: ['Consulta sobre el uso del módulo de reportes', 'Consulta sobre permisos de acceso'],
  requerimiento: ['Nuevo campo en el formulario de solicitudes', 'Exportación de datos a planilla'],
  'requerimiento interno': [
    'Mejora en el tablero de seguimiento interno',
    'Ajuste del proceso de control interno',
  ],
};

const TITULOS_GENERICOS = ['Revisión general del sistema', 'Ajuste de configuración'];

export function crearGeneradorDeTitulos(): (tipoIncidencia: string) => string {
  const usados = new Map<string, number>();
  return (tipoIncidencia) => {
    const clave = tipoIncidencia.trim().toLowerCase();
    const opciones = TITULOS_POR_TIPO[clave] ?? TITULOS_GENERICOS;
    const indice = usados.get(clave) ?? 0;
    usados.set(clave, indice + 1);
    return opciones[indice % opciones.length] ?? 'Ticket';
  };
}
