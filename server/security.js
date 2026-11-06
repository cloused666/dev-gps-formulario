import { createHash, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';

const productionHosts = new Set(['formulario.caiotimoteo.com.br', 'dev-gps-form.vercel.app']);

export function validOrigin(headers = {}, env = process.env) {
  const host = headers.host;
  const origin = headers.origin;
  if (typeof host !== 'string' || typeof origin !== 'string') return false;
  try {
    const url = new URL(origin);
    if (url.origin !== origin || url.host.toLowerCase() !== host.toLowerCase()) return false;
    if (headers['sec-fetch-site'] && !['same-origin', 'none'].includes(headers['sec-fetch-site'])) return false;
    if (env.VERCEL === '1' && url.protocol !== 'https:') return false;
    if (env.VERCEL_ENV === 'production' && !productionHosts.has(url.hostname.toLowerCase())) return false;
    return ['http:', 'https:'].includes(url.protocol);
  } catch { return false; }
}

// A supplemental, bounded limiter per warm function instance, NOT a distributed
// quota. Turnstile remains mandatory. Restarting/scaling resets these counters.
// Raw IP addresses are never stored or logged. A per-process salt changes on restart.
export function createSubmissionLimiter({ limit = 10, windowMs = 60_000, maxEntries = 10_000, now = Date.now } = {}) {
  const salt = randomBytes(32);
  const buckets = new Map();
  let nextSweep = 0;
  return (req, env = process.env) => {
    // Trust only Vercel's sanitized header when actually hosted on Vercel.
    const ip = env.VERCEL === '1' ? req.headers?.['x-vercel-forwarded-for'] : req.socket?.remoteAddress;
    if (typeof ip !== 'string' || !isIP(ip)) return { allowed: true };
    const time = now();
    if (time >= nextSweep) {
      for (const [key, bucket] of buckets) if (bucket.until <= time) buckets.delete(key);
      nextSweep = time + windowMs;
    }
    const key = createHash('sha256').update(salt).update(ip).digest('hex');
    let bucket = buckets.get(key);
    if (bucket && bucket.until <= time) { buckets.delete(key); bucket = undefined; }
    if (!bucket) {
      // Bound memory without evicting active clients' existing limits.
      if (buckets.size >= maxEntries) return { allowed: true };
      bucket = { count: 0, until: time + windowMs };
      buckets.set(key, bucket);
    }
    if (bucket.count >= limit) return { allowed: false, retryAfter: Math.max(1, Math.ceil((bucket.until - time) / 1000)) };
    bucket.count++;
    return { allowed: true };
  };
}
