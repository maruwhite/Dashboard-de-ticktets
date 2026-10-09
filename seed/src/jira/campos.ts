import type { ClienteJira } from './cliente.js';

export interface CampoJira {
  id: string;
  name: string;
  schema?: { custom?: string };
}

interface PaginaDeCampos {
  values: CampoJira[];
  isLast?: boolean;
}

/**
 * Todos los campos personalizados del sitio. Usa `/field/search` (paginado): el viejo
 * `GET /field` omite los campos que todavía no están en la pantalla de ningún proyecto.
 */
export async function buscarCamposPersonalizados(cliente: ClienteJira): Promise<CampoJira[]> {
  const campos: CampoJira[] = [];
  for (let desde = 0; ;) {
    const pagina = await cliente.get<PaginaDeCampos>(
      `/rest/api/3/field/search?type=custom&maxResults=50&startAt=${String(desde)}`,
    );
    campos.push(...pagina.values);
    desde += pagina.values.length;
    if (pagina.isLast !== false || pagina.values.length === 0) return campos;
  }
}
