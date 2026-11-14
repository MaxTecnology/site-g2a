// Pure HTTP helpers used by server.mjs: client IP, rate limiting and security headers.
// Kept free of side effects so they can be unit tested.

/**
 * Resolves the client IP behind a known number of reverse proxies (Traefik = 1 hop).
 * Only the entries appended by trusted proxies are considered, so a client cannot
 * spoof its IP by sending its own X-Forwarded-For header.
 * @param {{ headers: Record<string, string | string[] | undefined>, socket?: { remoteAddress?: string } }} req
 * @param {number} trustedHops
 */
export function clientIp(req, trustedHops = 1) {
  const remote = req.socket?.remoteAddress ?? 'unknown';
  if (trustedHops <= 0) return remote;
  const raw = req.headers['x-forwarded-for'];
  const xff = (Array.isArray(raw) ? raw.join(',') : raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!xff.length) return remote;
  return xff[Math.max(0, xff.length - trustedHops)];
}

/**
 * Rate limit key for an IP. IPv6 clients usually own a whole /64, so they are grouped by
 * that prefix; otherwise rotating addresses would bypass the limit.
 * @param {string} ip
 */
export function chaveIp(ip) {
  let s = ip.trim().toLowerCase();
  if (s.startsWith('::ffff:') && s.includes('.')) return s.slice(7); // IPv4-mapped
  if (!s.includes(':')) return s;
  s = s.split('%')[0];
  const [cabeca, cauda = ''] = s.split('::');
  const a = cabeca ? cabeca.split(':') : [];
  const b = s.includes('::') ? (cauda ? cauda.split(':') : []) : [];
  const grupos = s.includes('::') ? [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill('0'), ...b] : a;
  return grupos.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':') + '::/64';
}

/**
 * Normalized request path for routing decisions: percent-decoded, lowercased and with
 * repeated slashes collapsed, so "/%61rquivos" or "//arquivos" can't dodge a stricter limit.
 * Returns null when the path cannot be decoded.
 * @param {string} url
 */
export function normalizarPath(url) {
  const bruto = url.split('?')[0].split('#')[0];
  try {
    return decodeURIComponent(bruto).toLowerCase().replace(/\/+/g, '/');
  } catch {
    return null;
  }
}

/**
 * Fixed-window in-memory rate limiter. Good enough for a single instance;
 * with several replicas, move this to Traefik or Redis. Memory is bounded by maxKeys:
 * when full, expired keys are swept at most once per window and then the oldest key
 * is evicted (Map keeps insertion order), so a flood of new keys costs O(1) per request.
 * @param {{ limit: number, windowMs: number, maxKeys?: number, now?: () => number }} opts
 */
export function createRateLimiter({ limit, windowMs, maxKeys = 50_000, now = Date.now }) {
  /** @type {Map<string, { count: number, resetAt: number }>} */
  const hits = new Map();
  let ultimaVarredura = -Infinity;

  function sweep(t) {
    ultimaVarredura = t;
    for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
  }

  return {
    /** @param {string} key */
    hit(key) {
      const t = now();
      let entry = hits.get(key);
      if (!entry || entry.resetAt <= t) {
        if (hits.size >= maxKeys && t - ultimaVarredura >= windowMs) sweep(t);
        if (hits.size >= maxKeys) hits.delete(hits.keys().next().value);
        if (entry) hits.delete(key); // re-insert at the end to keep insertion order = age
        entry = { count: 0, resetAt: t + windowMs };
        hits.set(key, entry);
      }
      entry.count++;
      const allowed = entry.count <= limit;
      return {
        allowed,
        remaining: Math.max(0, limit - entry.count),
        retryAfterSec: allowed ? 0 : Math.ceil((entry.resetAt - t) / 1000),
      };
    },
    sweep: () => sweep(now()),
    size: () => hits.size,
  };
}

// 'unsafe-inline' is still needed for Astro's inline scripts/styles and the JSON-LD block.
// External origins: images from notices (https), Google Maps embed on /contato.
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  'frame-src https://www.google.com https://maps.google.com',
  "form-action 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

/**
 * @param {{ https: boolean }} ctx
 * @returns {Record<string, string>}
 */
export function securityHeaders({ https }) {
  /** @type {Record<string, string>} */
  const h = {
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  };
  // HSTS only makes sense when the visitor actually arrived over TLS (terminated at Traefik).
  if (https) h['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  return h;
}

/**
 * Integer env var with a lower bound; anything invalid or below `min` uses the fallback.
 * Limits use min 1: "0" must not turn into "block everything".
 * @param {string | undefined} v @param {number} fallback @param {number} [min]
 */
export function intEnv(v, fallback, min = 0) {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) && n >= min ? n : fallback;
}
