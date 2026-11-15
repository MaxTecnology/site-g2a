// Cliente mínimo da API REST do Directus para a seção de Avisos.
// O painel não é público: o servidor do site lê com um token só-leitura
// e entrega os arquivos aos visitantes pela rota /arquivos (ver pages/arquivos).

const env = (k: string) => (typeof process !== 'undefined' ? process.env[k] : undefined) ?? import.meta.env[k];

const API = () => (env('DIRECTUS_URL') ?? '').replace(/\/$/, '');
const TOKEN = () => env('DIRECTUS_TOKEN') ?? '';
const cabecalhos = () => (TOKEN() ? { Authorization: `Bearer ${TOKEN()}` } : undefined);

export type Arquivo = {
  id: string;
  title: string | null;
  type: string | null;
  filesize: number | null;
  filename_download: string;
  width?: number | null;
  height?: number | null;
};

export type Aviso = {
  id: string;
  titulo: string;
  slug: string;
  resumo: string | null;
  categoria: string | null;
  conteudo: string | null;
  publicado_em: string;
  capa: Arquivo | null;
  anexos: { directus_files_id: Arquivo }[];
};

const CAMPOS_ARQUIVO = ['id', 'title', 'type', 'filesize', 'filename_download', 'width', 'height'];
const campos = (prefixo: string) => CAMPOS_ARQUIVO.map((c) => `${prefixo}.${c}`);

const CAMPOS_LISTA = ['id', 'titulo', 'slug', 'resumo', 'categoria', 'publicado_em', ...campos('capa'), ...campos('anexos.directus_files_id')];

async function get<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const base = API();
  if (!base) return null;
  const url = `${base}${path}?${new URLSearchParams(params)}`;
  try {
    const res = await fetch(url, { headers: cabecalhos(), signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      console.error(`[directus] ${res.status} em ${path}`);
      return null;
    }
    return ((await res.json()) as { data: T }).data;
  } catch (e) {
    console.error('[directus] indisponível:', (e as Error).message);
    return null;
  }
}

export type ResultadoLista = { avisos: Aviso[]; ok: boolean };

export async function listarAvisos(opts: { limite?: number; categoria?: string } = {}): Promise<ResultadoLista> {
  const params: Record<string, string> = {
    'filter[status][_eq]': 'published',
    sort: '-publicado_em',
    fields: CAMPOS_LISTA.join(','),
    limit: String(opts.limite ?? 50),
  };
  if (opts.categoria) params['filter[categoria][_eq]'] = opts.categoria;
  const data = await get<Aviso[]>('/items/avisos', params);
  return { avisos: data ?? [], ok: data !== null };
}

/** `ok: false` means Directus is unavailable, which is different from "notice not found". */
export async function buscarAviso(slug: string): Promise<{ aviso: Aviso | null; ok: boolean }> {
  const data = await get<Aviso[]>('/items/avisos', {
    'filter[status][_eq]': 'published',
    'filter[slug][_eq]': slug,
    fields: [...CAMPOS_LISTA, 'conteudo'].join(','),
    limit: '1',
  });
  return { aviso: data?.[0] ?? null, ok: data !== null };
}

/** Lightweight list for the sitemap: only what a <url> entry needs. */
export async function listarSlugsAvisos(): Promise<{ avisos: Pick<Aviso, 'slug' | 'publicado_em'>[]; ok: boolean }> {
  const data = await get<Pick<Aviso, 'slug' | 'publicado_em'>[]>('/items/avisos', {
    'filter[status][_eq]': 'published',
    sort: '-publicado_em',
    fields: 'slug,publicado_em',
    limit: '5000',
  });
  return { avisos: data ?? [], ok: data !== null };
}

/** Larguras que a rota /arquivos aceita redimensionar (evita abuso do redimensionamento). */
export const LARGURAS = [400, 900, 1200, 1400] as const;

/** URL de um arquivo servido pelo próprio site. Imagens podem vir redimensionadas em WebP. */
export function urlArquivo(arq: Arquivo, opts: { largura?: (typeof LARGURAS)[number]; download?: boolean } = {}) {
  const params = new URLSearchParams();
  if (opts.largura && arq.type?.startsWith('image/')) params.set('w', String(opts.largura));
  if (opts.download) params.set('download', '1');
  const q = params.size ? `?${params}` : '';
  return `/arquivos/${arq.id}/${encodeURIComponent(arq.filename_download)}${q}`;
}

// Short cache for "does this file belong to a published notice?".
// Kept at 60s so an unpublished notice stops serving its files quickly.
const TTL_PUBLICO_MS = 60_000;
const publicados = new Map<string, { ok: boolean; ate: number }>();

export async function arquivoEhPublico(id: string): Promise<boolean> {
  const c = publicados.get(id);
  if (c && c.ate > Date.now()) return c.ok;
  const data = await get<{ id: string }[]>('/items/avisos', {
    'filter[status][_eq]': 'published',
    'filter[_or][0][capa][_eq]': id,
    'filter[_or][1][anexos][directus_files_id][_eq]': id,
    fields: 'id',
    limit: '1',
  });
  if (data === null) return false;
  const ok = data.length > 0;
  if (publicados.size > 2000) publicados.clear();
  publicados.set(id, { ok, ate: Date.now() + TTL_PUBLICO_MS });
  return ok;
}

/** Busca o arquivo no Directus (com redimensionamento opcional) para repassar ao visitante. */
export function buscarAsset(id: string, opts: { largura?: number; download?: boolean }) {
  const params = new URLSearchParams();
  if (opts.largura) {
    params.set('width', String(opts.largura));
    params.set('format', 'webp');
    params.set('quality', '80');
  }
  if (opts.download) params.set('download', '');
  return fetch(`${API()}/assets/${id}?${params}`, { headers: cabecalhos(), signal: AbortSignal.timeout(20000) });
}

export const ehPdf = (a: Arquivo) => a.type === 'application/pdf';
export const ehImagem = (a: Arquivo) => !!a.type?.startsWith('image/');

export function tamanhoLegivel(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

export const dataLonga = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Maceio' });

export const CATEGORIAS = ['Prazos', 'Fiscal', 'Trabalhista', 'Reforma Tributária', 'Comunicados'] as const;
