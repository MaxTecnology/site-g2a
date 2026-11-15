import type { APIRoute } from 'astro';
import { listarSlugsAvisos } from '../lib/directus';

export const prerender = false;

// @astrojs/sitemap only lists prerendered pages. This one covers the on-demand ones:
// the home, the notices index and every published notice. Referenced in astro.config.mjs.
const xmlEsc = (s: string) => s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL('https://g2asolucoescontabeis.com.br');
  const { avisos, ok } = await listarSlugsAvisos();
  // Without Directus the sitemap would look like every notice was removed: answer 503 instead.
  if (!ok) {
    return new Response('Sitemap temporariamente indisponível', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '600' },
    });
  }

  const urls = [
    { loc: new URL('/', base).href, lastmod: avisos[0]?.publicado_em },
    { loc: new URL('/avisos', base).href, lastmod: avisos[0]?.publicado_em },
    ...avisos.map((a) => ({ loc: new URL(`/avisos/${encodeURIComponent(a.slug)}`, base).href, lastmod: a.publicado_em })),
  ];

  const corpo = urls
    .map(({ loc, lastmod }) => `<url><loc>${xmlEsc(loc)}</loc>${lastmod ? `<lastmod>${xmlEsc(new Date(lastmod).toISOString())}</lastmod>` : ''}</url>`)
    .join('');

  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${corpo}</urlset>`, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
