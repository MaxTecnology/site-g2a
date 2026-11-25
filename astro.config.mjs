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
  // Home and Avisos are on-demand, so they are listed by the dynamic /sitemap-avisos.xml.
  integrations: [sitemap({ customSitemaps: ['https://g2asolucoescontabeis.com.br/sitemap-avisos.xml'] })],
  vite: { plugins: [tailwindcss()] },
  // URLs antigas do site em template continuam funcionando.
  redirects: {
    '/index.html': '/',
    '/about.html': '/sobre',
    '/contact.html': '/contato',
    '/reforma-tributaria.html': '/reforma-tributaria',
    '/portfolio.html': '/servicos',
    '/single.html': '/servicos',
    // Old React simulator, replaced by the readiness check on the Reforma page.
    '/calculadora.html': '/reforma-tributaria',
    // Planner removed: the office now uses its own working-hours system.
    '/controle-de-jornada': '/servicos/departamento-pessoal',
  },
});
