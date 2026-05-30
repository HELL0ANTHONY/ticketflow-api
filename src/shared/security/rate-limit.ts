import { RateLimitError } from "#/shared/errors/application-error.js";

type RateLimitPolicy = {
  limit: number;
  windowMs: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

export function assertRateLimit(key: string, policy: RateLimitPolicy): void {
  const now = Date.now();

  if (buckets.size > 1_000) {
    pruneExpiredBuckets(now);
  }

  const bucket = buckets.get(key);

  if (bucket === undefined || bucket.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + policy.windowMs,
    });
    return;
  }

  if (bucket.count >= policy.limit) {
    throw new RateLimitError("Too many requests");
  }

  bucket.count += 1;
}

function pruneExpiredBuckets(now: number): void {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}
