export interface FcmRateLimiterConfig {
  enabled: boolean;
  maxPerSecond: number;
  maxPerMinute: number;
  burst: number;
  now?: () => number;
}

export interface FcmRateLimitDecision {
  allowed: boolean;
  retryAfterMs?: number;
}

interface Bucket {
  tokens: number;
  capacity: number;
  refillPerMs: number;
}

export class FcmRateLimiter {
  private readonly now: () => number;
  private readonly second: Bucket;
  private readonly minute: Bucket;
  private lastRefillAt: number;

  constructor(private readonly config: FcmRateLimiterConfig) {
    this.now = config.now ?? Date.now;
    this.second = {
      tokens: config.burst,
      capacity: config.burst,
      refillPerMs: config.maxPerSecond / 1_000
    };
    const minuteCapacity = Math.min(config.burst, config.maxPerMinute);
    this.minute = {
      tokens: minuteCapacity,
      capacity: minuteCapacity,
      refillPerMs: config.maxPerMinute / 60_000
    };
    this.lastRefillAt = this.now();
  }

  tryAcquire(count = 1): FcmRateLimitDecision {
    if (!this.config.enabled || count <= 0) return { allowed: true };
    this.refill();
    if (this.second.tokens >= count && this.minute.tokens >= count) {
      this.second.tokens -= count;
      this.minute.tokens -= count;
      return { allowed: true };
    }
    return {
      allowed: false,
      retryAfterMs: Math.ceil(Math.max(this.waitFor(this.second, count), this.waitFor(this.minute, count)))
    };
  }

  private refill(): void {
    const current = this.now();
    const elapsed = Math.max(0, current - this.lastRefillAt);
    this.lastRefillAt = current;
    for (const bucket of [this.second, this.minute]) {
      bucket.tokens = Math.min(bucket.capacity, bucket.tokens + elapsed * bucket.refillPerMs);
    }
  }

  private waitFor(bucket: Bucket, count: number): number {
    if (bucket.tokens >= count) return 0;
    if (bucket.refillPerMs <= 0 || count > bucket.capacity) return 60_000;
    return (count - bucket.tokens) / bucket.refillPerMs;
  }
}
