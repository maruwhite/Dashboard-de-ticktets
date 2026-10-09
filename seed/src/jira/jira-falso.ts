// Jira en memoria para los tests: implementa solo los endpoints que usan preparar y cargar.
import { ClienteJira } from './cliente.js';
import { ESTADOS } from './definicion.js';

export interface Llamada {
  metodo: string;
  ruta: string;
  cuerpo: unknown;
}

interface Issue {
  key: string;
  fields: Record<string, unknown>;
}

type Cuerpo = Record<string, unknown>;

export class JiraFalso {
  campos: { id: string; name: string; custom: boolean; schema: { custom: string } }[] = [];
  enPantalla = new Set<string>();
  hayPantalla = true;
  prioridades: { id: string; name: string }[] = [{ id: '3', name: 'Medium' }];
  prioridadesEnEsquema = new Set<string>(['3']);
  tipos: { id: string; name: string; scope?: unknown }[] = [
    { id: '1', name: 'Epic' },
    { id: '2', name: 'Tarea', scope: { type: 'PROJECT' } },
  ];
  workflows: string[] = [];
  estados = [{ id: '1', name: 'Open', statusCategory: 'TODO' }];
  erroresDeValidacion: { level: string; message: string }[] = [];
  esquemasWorkflow: { id: number; name: string }[] = [];
  proyectos: { id: string; key: string }[] = [];
  issues: Issue[] = [];
  /** Títulos que hacen fallar la creación del ticket. */
  titulosQueFallan = new Set<string>();
  /** Estados sin transición disponible. */
  estadosSinTransicion = new Set<string>();
  llamadas: Llamada[] = [];
  private secuencia = 100;

  get escrituras(): Llamada[] {
    return this.llamadas.filter(
      (l) =>
        l.metodo !== 'GET' &&
        !l.ruta.endsWith('/validation') &&
        l.ruta !== '/rest/api/3/search/jql',
    );
  }

  cliente(): ClienteJira {
    return new ClienteJira(
      {
        baseUrl: 'https://falso.atlassian.net',
        email: 'persona@example.com',
        token: 'token-falso',
      },
      {
        // El cliente siempre llama a fetch con la URL como string.
        fetch: (url, init) => Promise.resolve(this.responder(url as string, init)),
        esperar: () => Promise.resolve(),
      },
    );
  }

  private id(): string {
    return String(this.secuencia++);
  }

  private responder(url: string, init?: RequestInit): Response {
    const { pathname, searchParams } = new URL(url);
    const metodo = init?.method ?? 'GET';
    const cuerpo = (typeof init?.body === 'string' ? JSON.parse(init.body) : undefined) as
      Cuerpo | undefined;
    this.llamadas.push({ metodo, ruta: pathname, cuerpo });
    const json = (datos: unknown, status = 200) => new Response(JSON.stringify(datos), { status });
    const ruta = `${metodo} ${pathname}`;
    const c = cuerpo ?? {};

    switch (ruta) {
      case 'GET /rest/api/3/field':
        return json(this.campos);
      case 'POST /rest/api/3/field': {
        const campo = {
          id: `customfield_${this.id()}`,
          name: String(c.name),
          custom: true,
          schema: { custom: String(c.type) },
        };
        this.campos.push(campo);
        return json(campo, 201);
      }
      case 'GET /rest/api/3/screens':
        return json({ values: this.hayPantalla ? [{ id: 1, name: 'Default Screen' }] : [] });
      case 'GET /rest/api/3/screens/1/tabs':
        return json([{ id: 10 }]);
      case 'GET /rest/api/3/screens/1/tabs/10/fields':
        return json([...this.enPantalla].map((id) => ({ id })));
      case 'POST /rest/api/3/screens/1/tabs/10/fields':
        this.enPantalla.add(String(c.fieldId));
        return json({});
      case 'GET /rest/api/3/priority/search':
        return json({ values: this.prioridades });
      case 'POST /rest/api/3/priority': {
        const prioridad = { id: this.id(), name: String(c.name) };
        this.prioridades.push(prioridad);
        return json({ id: prioridad.id }, 201);
      }
      case 'GET /rest/api/3/priorityscheme':
        return json({ values: [{ id: '1', isDefault: true }] });
      case 'GET /rest/api/3/priorityscheme/1/priorities':
        return json({
          values: this.prioridades.filter((p) => this.prioridadesEnEsquema.has(p.id)),
        });
      case 'PUT /rest/api/3/priorityscheme/1': {
        const ids = (c.priorities as { add: { ids: number[] } }).add.ids;
        for (const id of ids) this.prioridadesEnEsquema.add(String(id));
        return new Response(null, { status: 204 });
      }
      case 'GET /rest/api/3/issuetype':
        return json(this.tipos);
      case 'POST /rest/api/3/issuetype':
        this.tipos.push({ id: this.id(), name: String(c.name) });
        return json({}, 201);
      case 'GET /rest/api/3/workflows/search':
        return json({ values: this.workflows.map((name) => ({ name })) });
      case 'GET /rest/api/3/statuses/search':
        return json({ values: this.estados });
      case 'POST /rest/api/3/workflows/create/validation':
        return json({ errors: this.erroresDeValidacion });
      case 'POST /rest/api/3/workflows/create': {
        const [workflow] = c.workflows as { name: string }[];
        this.workflows.push(workflow?.name ?? '');
        return json({});
      }
      case 'GET /rest/api/3/workflowscheme':
        return json({ values: this.esquemasWorkflow });
      case 'POST /rest/api/3/workflowscheme': {
        const esquema = { id: Number(this.id()), name: String(c.name) };
        this.esquemasWorkflow.push(esquema);
        return json(esquema, 201);
      }
      case 'GET /rest/api/3/project/search': {
        const claves = searchParams.getAll('keys');
        return json({ values: this.proyectos.filter((p) => claves.includes(p.key)) });
      }
      case 'GET /rest/api/3/myself':
        return json({ accountId: 'cuenta-falsa' });
      case 'POST /rest/api/3/project':
        this.proyectos.push({ id: this.id(), key: String(c.key) });
        return json({}, 201);
      case 'POST /rest/api/3/search/jql': {
        // Páginas de 2 para ejercitar la paginación.
        const desde = Number(c.nextPageToken ?? 0);
        const pagina = this.issues.slice(desde, desde + 2);
        const siguiente = desde + 2 < this.issues.length ? String(desde + 2) : undefined;
        return json({ issues: pagina, ...(siguiente ? { nextPageToken: siguiente } : {}) });
      }
      case 'POST /rest/api/3/issue/bulk': {
        const issues: { key: string }[] = [];
        const errors: unknown[] = [];
        (c.issueUpdates as { fields: Cuerpo }[]).forEach(({ fields }, i) => {
          if (this.titulosQueFallan.has(String(fields.summary))) {
            errors.push({
              failedElementNumber: i,
              elementErrors: { errors: { summary: 'inválido' } },
            });
            return;
          }
          const proyecto = (fields.project as { key: string }).key;
          const issue = {
            key: `${proyecto}-${String(this.issues.length + 1)}`,
            fields: { ...fields, status: { name: 'Planificado' } },
          };
          this.issues.push(issue);
          issues.push({ key: issue.key });
        });
        return json({ issues, errors }, 201);
      }
    }

    const transicion = /^(GET|POST) \/rest\/api\/3\/issue\/([^/]+)\/transitions$/.exec(ruta);
    const issue = this.issues.find((i) => i.key === transicion?.[2]);
    if (transicion && issue) {
      const disponibles = ESTADOS.filter((e) => !this.estadosSinTransicion.has(e.nombre)).map(
        (e, i) => ({
          id: String(11 + i * 10),
          to: { name: e.nombre },
        }),
      );
      if (transicion[1] === 'GET') return json({ transitions: disponibles });
      const elegida = disponibles.find((t) => t.id === (c.transition as { id: string }).id);
      if (!elegida) return json({ errorMessages: ['Transición inválida'] }, 400);
      issue.fields.status = { name: elegida.to.name };
      return new Response(null, { status: 204 });
    }

    return json({ errorMessages: [`Ruta no simulada: ${ruta}`] }, 404);
  }
}
