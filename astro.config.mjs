// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://g2asolucoescontabeis.com.br',
  // Páginas institucionais são pré-renderizadas; Home e Avisos rodam sob demanda
  // para refletir na hora o que a equipe publica no painel (Directus).
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [sitemap()],
  vite: { plugins: [tailwindcss()] },
  // URLs antigas do site em template continuam funcionando.
  redirects: {
    '/index.html': '/',
    '/about.html': '/sobre',
    '/contact.html': '/contato',
    '/reforma-tributaria.html': '/reforma-tributaria',
    '/portfolio.html': '/servicos',
    '/single.html': '/servicos',
  },
});
