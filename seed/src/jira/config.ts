export interface ConfigJira {
  baseUrl: string;
  email: string;
  token: string;
}

/** Lee las credenciales de Jira. Los errores nombran la variable, nunca su valor. */
export function leerConfigJira(env: Record<string, string | undefined>): ConfigJira {
  const leer = (nombre: string): string => {
    const valor = env[nombre]?.trim() ?? '';
    if (valor === '') throw new Error(`Falta la variable ${nombre} en backend/.env`);
    return valor;
  };

  const baseUrl = leer('JIRA_BASE_URL').replace(/\/+$/, '');
  if (!/^https:\/\/[^/]+$/.test(baseUrl)) {
    throw new Error(
      'JIRA_BASE_URL debe ser la URL del sitio, por ejemplo https://<sitio>.atlassian.net',
    );
  }
  return { baseUrl, email: leer('JIRA_EMAIL'), token: leer('JIRA_API_TOKEN') };
}
