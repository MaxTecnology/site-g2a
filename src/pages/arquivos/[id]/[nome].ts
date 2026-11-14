import type { APIRoute } from 'astro';
import { arquivoEhPublico, buscarAsset, LARGURAS } from '../../../lib/directus';

export const prerender = false;

const semCache = { 'Cache-Control': 'no-store' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Entrega imagens e PDFs dos avisos publicados. Arquivos de rascunhos ou soltos no painel dão 404.
export const GET: APIRoute = async ({ params, url }) => {
  const id = params.id ?? '';
  if (!UUID.test(id) || !(await arquivoEhPublico(id))) return new Response('Arquivo não encontrado', { status: 404, headers: semCache });

  const w = Number(url.searchParams.get('w'));
  const largura = (LARGURAS as readonly number[]).includes(w) ? w : undefined;
  const download = url.searchParams.has('download');

  let res: Response;
  try {
    res = await buscarAsset(id, { largura, download });
  } catch {
    return new Response('Arquivo indisponível no momento', { status: 503, headers: semCache });
  }
  if (!res.ok || !res.body) return new Response('Arquivo não encontrado', { status: res.status === 404 ? 404 : 502, headers: semCache });

  const headers = new Headers();
  for (const h of ['content-type', 'content-length', 'content-disposition', 'last-modified', 'etag']) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }
  // Short browser/proxy cache: when a notice is unpublished its files must stop being served.
  headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(res.body, { status: 200, headers });
};
