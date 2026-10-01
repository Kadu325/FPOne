/**
 * Limitador de tentativas de login (janela deslizante, em memória).
 */
interface Bucket {
  hits: number[];
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

export class SlidingWindowLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly maxKeys = 10_000,
    private readonly now: () => number = Date.now,
  ) {}

  private prune(bucket: Bucket, t: number): void {
    const cutoff = t - this.windowMs;
    while (bucket.hits.length && (bucket.hits[0] ?? Infinity) <= cutoff) bucket.hits.shift();
  }

  check(key: string): RateLimitResult {
    const t = this.now();
    const bucket = this.buckets.get(key);
    if (!bucket) return { allowed: true, retryAfterSec: 0 };
    this.prune(bucket, t);
    if (bucket.hits.length === 0) {
      this.buckets.delete(key);
      return { allowed: true, retryAfterSec: 0 };
    }
    if (bucket.hits.length >= this.max) {
      const retryAfterMs = (bucket.hits[0] ?? t) + this.windowMs - t;
      return { allowed: false, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
    }
    return { allowed: true, retryAfterSec: 0 };
  }

  hit(key: string): void {
    const t = this.now();
    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= this.maxKeys) this.evictOldest();
      bucket = { hits: [] };
      this.buckets.set(key, bucket);
    }
    this.prune(bucket, t);
    bucket.hits.push(t);
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  private evictOldest(): void {
    const first = this.buckets.keys().next();
    if (!first.done) this.buckets.delete(first.value);
  }
}

function intEnv(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

const WINDOW_MS = intEnv("LOGIN_RATE_WINDOW_MINUTES", 15) * 60_000;

const g = globalThis as unknown as {
  __fponeUserLimiter?: SlidingWindowLimiter;
  __fponeIpLimiter?: SlidingWindowLimiter;
};

export const userLimiter = (g.__fponeUserLimiter ??= new SlidingWindowLimiter(
  intEnv("LOGIN_MAX_FAILS_PER_USER", 5),
  WINDOW_MS,
));
export const ipLimiter = (g.__fponeIpLimiter ??= new SlidingWindowLimiter(
  intEnv("LOGIN_MAX_FAILS_PER_IP", 20),
  WINDOW_MS,
));

export function clientIpFrom(headers: Headers | undefined): string | null {
  if (!headers || process.env.TRUST_PROXY !== "true") return null;
  const xff = headers.get("x-forwarded-for");
  if (xff) return (xff.split(",")[0] ?? "").trim() || null;
  return headers.get("x-real-ip")?.trim() || null;
}
