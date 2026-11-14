import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS module without type declarations
import { chaveIp, clientIp, createRateLimiter, intEnv, normalizarPath, securityHeaders } from '../server/http.mjs';

const req = (xff?: string | string[], remote = '10.0.0.5') => ({
  headers: xff === undefined ? {} : { 'x-forwarded-for': xff },
  socket: { remoteAddress: remote },
});

describe('clientIp', () => {
  it('uses the entry added by the trusted proxy, ignoring spoofed ones', () => {
    // client sent "1.1.1.1" itself; Traefik appended the real IP
    expect(clientIp(req('1.1.1.1, 200.1.2.3'), 1)).toBe('200.1.2.3');
    expect(clientIp(req('200.1.2.3'), 1)).toBe('200.1.2.3');
  });
  it('supports more than one proxy hop and array headers', () => {
    expect(clientIp(req('1.1.1.1, 200.1.2.3, 172.16.0.2'), 2)).toBe('200.1.2.3');
    expect(clientIp(req(['1.1.1.1', '200.1.2.3']), 1)).toBe('200.1.2.3');
  });
  it('falls back to the socket address', () => {
    expect(clientIp(req(undefined), 1)).toBe('10.0.0.5');
    expect(clientIp(req(''), 1)).toBe('10.0.0.5');
    expect(clientIp(req('1.1.1.1'), 0)).toBe('10.0.0.5');
  });
  it('does not go out of bounds with fewer entries than hops', () => {
    expect(clientIp(req('200.1.2.3'), 3)).toBe('200.1.2.3');
  });
});

describe('createRateLimiter', () => {
  function relogio(inicio = 0) {
    let t = inicio;
    return { now: () => t, avancar: (ms: number) => (t += ms) };
  }

  it('allows up to the limit, then blocks with Retry-After', () => {
    const c = relogio();
    const rl = createRateLimiter({ limit: 3, windowMs: 60_000, now: c.now });
    expect([rl.hit('a'), rl.hit('a'), rl.hit('a')].every((r) => r.allowed)).toBe(true);
    c.avancar(15_000);
    const bloqueado = rl.hit('a');
    expect(bloqueado.allowed).toBe(false);
    expect(bloqueado.retryAfterSec).toBe(45);
  });

  it('keeps counters per key', () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(rl.hit('a').allowed).toBe(true);
    expect(rl.hit('b').allowed).toBe(true);
    expect(rl.hit('a').allowed).toBe(false);
  });

  it('resets after the window', () => {
    const c = relogio();
    const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: c.now });
    rl.hit('a');
    expect(rl.hit('a').allowed).toBe(false);
    c.avancar(1000);
    expect(rl.hit('a').allowed).toBe(true);
  });

  it('never grows past maxKeys: evicts the oldest key when full', () => {
    const c = relogio();
    const rl = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 2, now: c.now });
    rl.hit('a');
    rl.hit('b');
    expect(rl.hit('c').allowed).toBe(true);
    expect(rl.size()).toBe(2);
    // 'a' was evicted, 'b' and 'c' are still counted
    expect(rl.hit('b').allowed).toBe(false);
    expect(rl.hit('c').allowed).toBe(false);
  });

  it('sweeps expired keys', () => {
    const c = relogio();
    const rl = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 10, now: c.now });
    rl.hit('a');
    rl.hit('b');
    c.avancar(1000);
    rl.sweep();
    expect(rl.size()).toBe(0);
  });

  it('does not sweep on every request when full (bounded cost under a flood)', () => {
    const c = relogio();
    const rl = createRateLimiter({ limit: 5, windowMs: 1000, maxKeys: 100, now: c.now });
    for (let i = 0; i < 10_000; i++) rl.hit(`k${i}`);
    expect(rl.size()).toBe(100);
  });
});

describe('chaveIp', () => {
  it('keeps IPv4 and unwraps IPv4-mapped IPv6', () => {
    expect(chaveIp('200.1.2.3')).toBe('200.1.2.3');
    expect(chaveIp('::ffff:200.1.2.3')).toBe('200.1.2.3');
  });
  it('groups IPv6 by /64 so rotating addresses share one bucket', () => {
    const a = chaveIp('2804:14c:1a2b:3c4d:1111:2222:3333:4444');
    expect(a).toBe('2804:14c:1a2b:3c4d::/64');
    expect(chaveIp('2804:14C:1A2B:3C4D::99')).toBe(a);
    expect(chaveIp('2804:014c:1a2b:3c4d:ffff::1')).toBe(a);
    expect(chaveIp('2804:14c:1a2b:3c4e::1')).not.toBe(a);
  });
  it('expands "::" in the network part', () => {
    expect(chaveIp('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(chaveIp('::1')).toBe('0:0:0:0::/64');
    expect(chaveIp('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
  });
});

describe('normalizarPath', () => {
  it('decodes, lowercases and collapses slashes', () => {
    expect(normalizarPath('/%61rquivos/x?w=400')).toBe('/arquivos/x');
    expect(normalizarPath('//ARQUIVOS//x')).toBe('/arquivos/x');
    expect(normalizarPath('/healthz#a')).toBe('/healthz');
  });
  it('returns null for malformed encoding', () => {
    expect(normalizarPath('/%E0%A4%A')).toBeNull();
  });
});

describe('securityHeaders', () => {
  it('sends HSTS only over https', () => {
    expect(securityHeaders({ https: true })['Strict-Transport-Security']).toMatch(/max-age=31536000/);
    expect(securityHeaders({ https: false })['Strict-Transport-Security']).toBeUndefined();
  });
  it('locks down framing, objects and base URI', () => {
    const csp = securityHeaders({ https: false })['Content-Security-Policy'];
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });
  it('allows no third-party scripts, styles, fonts, connections or form targets', () => {
    const csp: string = securityHeaders({ https: false })['Content-Security-Policy'];
    const diretiva = (nome: string) => csp.split('; ').find((d) => d.startsWith(nome + ' '));
    for (const d of ['script-src', 'style-src', 'font-src', 'connect-src', 'form-action']) {
      expect(diretiva(d)).not.toMatch(/https?:/);
    }
  });
});

describe('intEnv', () => {
  it('parses non-negative integers and falls back otherwise', () => {
    expect(intEnv('42', 1)).toBe(42);
    expect(intEnv('0', 1)).toBe(0);
    expect(intEnv(undefined, 7)).toBe(7);
    expect(intEnv('abc', 7)).toBe(7);
    expect(intEnv('-5', 7)).toBe(7);
  });
  it('enforces the minimum so "0" can never block every request', () => {
    expect(intEnv('0', 600, 1)).toBe(600);
    expect(intEnv('0', 60_000, 1000)).toBe(60_000);
    expect(intEnv('2000', 60_000, 1000)).toBe(2000);
  });
});
