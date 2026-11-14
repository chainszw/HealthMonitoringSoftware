import { describe, expect, it } from 'vitest';
import { originMatcher, parseOrigins } from './cors';
import { setupApi } from './testkit';

describe('CORS_ORIGINS parsing and matching', () => {
  it('parses a comma-separated list and drops malformed entries', () => {
    expect(parseOrigins(' https://a.vercel.app/ , ,https://b-*.vercel.app')).toEqual([
      'https://a.vercel.app',
      'https://b-*.vercel.app',
    ]);
    expect(parseOrigins('https://evil.com/<script>')).toBeUndefined();
    expect(parseOrigins('')).toBeUndefined();
    expect(parseOrigins(undefined)).toBeUndefined();
  });

  it('matches exact origins and one host-name part per *', () => {
    const allow = originMatcher([
      'https://crew-health.vercel.app',
      'https://crew-health-*.vercel.app',
    ]);
    expect(allow('https://crew-health.vercel.app')).toBe('https://crew-health.vercel.app');
    expect(allow('HTTPS://Crew-Health.vercel.app')).toBe('HTTPS://Crew-Health.vercel.app');
    expect(allow('https://crew-health-git-main-team.vercel.app')).not.toBeNull();
    expect(allow('https://crew-health-x.evil.com')).toBeNull();
    expect(allow('https://crew-health-a.b.vercel.app')).toBeNull();
    expect(allow('https://crew-healthXvercel.app')).toBeNull();
    expect(allow('http://crew-health.vercel.app')).toBeNull();
  });
});

describe('API hardening', () => {
  const api = setupApi({ corsOrigins: ['https://crew-health-*.vercel.app'] });
  const preflight = (origin: string) =>
    api.app.request('/sync', {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, content-type',
      },
    });

  it('allows configured browser origins only', async () => {
    const ok = await preflight('https://crew-health-git-main-team.vercel.app');
    expect(ok.headers.get('access-control-allow-origin')).toBe(
      'https://crew-health-git-main-team.vercel.app',
    );
    const blocked = await preflight('https://evil.example.com');
    expect(blocked.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('sends protective headers, without blocking cross-origin use', async () => {
    const res = await api.app.request('/health');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(res.headers.get('strict-transport-security')).toMatch(/max-age/);
    expect(res.headers.get('cross-origin-resource-policy')).toBeNull();
  });

  it('refuses oversized reading bodies before reading them', async () => {
    const res = await api.as(api.tokens.alpha)('/readings', {
      method: 'POST',
      body: { indicatorId: 'mood', value: 3, padding: 'x'.repeat(70 * 1024) },
    });
    expect(res.status).toBe(413);
  });
});
