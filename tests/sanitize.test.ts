import { describe, expect, it } from 'vitest';
import { sanitizarConteudo } from '../src/lib/sanitize';

describe('sanitizarConteudo', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizarConteudo(null)).toBe('');
    expect(sanitizarConteudo(undefined)).toBe('');
    expect(sanitizarConteudo('')).toBe('');
  });

  it('keeps the formatting produced by the editor', () => {
    const html = '<h2>Prazo</h2><p>Entregue até <strong>dia 20</strong>.</p><ul><li>DCTFWeb</li></ul>';
    expect(sanitizarConteudo(html)).toBe(html);
  });

  it('removes scripts, event handlers and dangerous tags', () => {
    const out = sanitizarConteudo(
      '<p onclick="x()">a</p><script>alert(1)</script><iframe src="https://evil"></iframe><style>*{}</style><img src="https://x/a.png" onerror="alert(1)">',
    );
    expect(out).not.toMatch(/script|onclick|onerror|iframe|style/i);
    expect(out).toContain('<p>a</p>');
    expect(out).toContain('<img src="https://x/a.png" loading="lazy" />');
  });

  it('blocks javascript:, data: and protocol-relative URLs', () => {
    expect(sanitizarConteudo('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
    expect(sanitizarConteudo('<a href="JaVaScRiPt:alert(1)">x</a>')).toBe('<a>x</a>');
    expect(sanitizarConteudo('<img src="data:image/svg+xml,<svg onload=alert(1)>">')).not.toContain('data:');
    expect(sanitizarConteudo('<a href="//evil.com">x</a>')).toBe('<a>x</a>');
  });

  it('opens external links in a new tab without opener access', () => {
    expect(sanitizarConteudo('<a href="https://gov.br">gov</a>')).toBe(
      '<a href="https://gov.br" target="_blank" rel="noopener noreferrer">gov</a>',
    );
    expect(sanitizarConteudo('<a href="mailto:a@b.c">mail</a>')).toBe('<a href="mailto:a@b.c">mail</a>');
  });

  it('demotes h1 to h2 to keep a single h1 per page', () => {
    expect(sanitizarConteudo('<h1>Título</h1>')).toBe('<h2>Título</h2>');
  });

  it('strips style and class attributes', () => {
    expect(sanitizarConteudo('<p style="color:red" class="x">a</p>')).toBe('<p>a</p>');
  });
});
