// Sanitizes the HTML written in the Directus WYSIWYG before it is rendered on the site.
// Even trusted editors can paste malicious markup, and a compromised panel account must not
// be able to run scripts on the main domain (stored XSS).
import sanitizeHtml from 'sanitize-html';

const OPCOES: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'hr', 'h2', 'h3', 'h4', 'blockquote',
    'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'mark', 'small', 'code', 'pre',
    'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    th: ['colspan', 'rowspan', 'scope'],
    td: ['colspan', 'rowspan'],
    ol: ['start'],
  },
  allowedSchemes: ['https', 'http', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['https', 'http'] },
  allowProtocolRelative: false,
  // h1 is the page title; editors' h1 becomes h2 to keep a single h1 per page.
  transformTags: {
    h1: 'h2',
    a: (tagName, attribs) => {
      const externo = /^https?:\/\//i.test(attribs.href ?? '');
      return {
        tagName,
        attribs: externo ? { ...attribs, target: '_blank', rel: 'noopener noreferrer' } : attribs,
      };
    },
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: 'lazy' } }),
  },
};

export function sanitizarConteudo(html: string | null | undefined): string {
  if (!html) return '';
  return sanitizeHtml(html, OPCOES);
}
