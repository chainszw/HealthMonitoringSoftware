// Which browser origins may call the API. CORS_ORIGINS is a comma-separated list; an entry may
// use * for one part of a host name, so Vercel preview URLs can be allowed with one entry:
//   https://crew-health.vercel.app,https://crew-health-*.vercel.app

/** Characters an origin pattern may contain: scheme, host, port, and * wildcards. */
const PATTERN = /^[a-z0-9.:/*-]+$/i;

/** Parse CORS_ORIGINS into a list of patterns. Empty or malformed entries are dropped. */
export function parseOrigins(raw: string | undefined): string[] | undefined {
  const list = raw
    ?.split(',')
    .map((s) => s.trim().replace(/[/]+$/, ''))
    .filter((s) => PATTERN.test(s));
  return list?.length ? list : undefined;
}

/** A pattern as a regular expression: . and / match themselves, * one host-name part. */
function toRegExp(pattern: string): RegExp {
  const literal = (part: string) => part.replace(/[./]/g, (c) => `[${c}]`);
  return new RegExp(`^${pattern.split('*').map(literal).join('[a-z0-9-]*')}$`, 'i');
}

/** A matcher for Hono's cors(): returns the origin when allowed, otherwise null. */
export function originMatcher(patterns: string[]): (origin: string) => string | null {
  const rules = patterns
    .filter((p) => PATTERN.test(p))
    .map((p) => (p.includes('*') ? toRegExp(p) : p.toLowerCase()));
  return (origin) => {
    const o = origin.toLowerCase();
    return rules.some((r) => (typeof r === 'string' ? r === o : r.test(o))) ? origin : null;
  };
}
