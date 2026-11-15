// Production entrypoint. Wraps the Astro standalone handler (static files + SSR) to add
// security headers, per-IP rate limiting and a /healthz endpoint to every response,
// including prerendered pages, which Astro middleware never sees.
import http from 'node:http';
import { chaveIp, clientIp, createRateLimiter, intEnv, normalizarPath, securityHeaders } from './server/http.mjs';

process.env.ASTRO_NODE_AUTOSTART = 'disabled';
const { handler } = await import('./dist/server/entry.mjs');

const HOST = process.env.HOST ?? '0.0.0.0';
const PORT = intEnv(process.env.PORT, 4321);
const TRUSTED_PROXY_HOPS = intEnv(process.env.TRUSTED_PROXY_HOPS, 1);
const WINDOW_MS = intEnv(process.env.RATE_LIMIT_WINDOW_MS, 60_000, 1000);

const geral = createRateLimiter({ limit: intEnv(process.env.RATE_LIMIT_GERAL, 600, 1), windowMs: WINDOW_MS });
const arquivos = createRateLimiter({ limit: intEnv(process.env.RATE_LIMIT_ARQUIVOS, 180, 1), windowMs: WINDOW_MS });
setInterval(() => {
  geral.sweep();
  arquivos.sweep();
}, WINDOW_MS).unref();

function bloquear(res, retryAfterSec) {
  res.writeHead(429, { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': String(retryAfterSec) });
  res.end('Muitas requisições. Tente novamente em instantes.');
}

const server = http.createServer((req, res) => {
  const path = normalizarPath(req.url ?? '/');
  if (path === null) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad request');
    return;
  }

  if (path === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    res.end('ok');
    return;
  }

  const https = req.headers['x-forwarded-proto'] === 'https';
  // Notice files (PDF, images) get no CSP: a document CSP can block the browser's PDF viewer.
  const arquivo = path.startsWith('/arquivos/');
  for (const [k, v] of Object.entries(securityHeaders({ https, csp: !arquivo }))) res.setHeader(k, v);

  const ip = chaveIp(clientIp(req, TRUSTED_PROXY_HOPS));
  const g = geral.hit(ip);
  if (!g.allowed) return bloquear(res, g.retryAfterSec);
  if (arquivo) {
    const a = arquivos.hit(ip);
    if (!a.allowed) return bloquear(res, a.retryAfterSec);
  }

  handler(req, res);
});

server.listen(PORT, HOST, () => console.log(JSON.stringify({ level: 'info', msg: 'server listening', host: HOST, port: PORT })));

function encerrar(sinal) {
  console.log(JSON.stringify({ level: 'info', msg: 'shutting down', signal: sinal }));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => encerrar('SIGTERM'));
process.on('SIGINT', () => encerrar('SIGINT'));
