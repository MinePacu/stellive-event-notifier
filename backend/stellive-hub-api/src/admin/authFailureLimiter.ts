import type { FastifyReply } from "fastify";
import type { AuthResult } from "./adminAuth.js";

export interface AuthFailureLimiterOptions {
  maxFailures?: number;
  windowMs?: number;
  maxKeys?: number;
  now?: () => number;
}

interface FailureWindow {
  count: number;
  windowStartMs: number;
}

/** In-memory fixed-window limiter for failed admin/internal credential attempts, keyed by client IP. */
export class AuthFailureLimiter {
  private readonly failures = new Map<string, FailureWindow>();
  private readonly maxFailures: number;
  private readonly windowMs: number;
  private readonly maxKeys: number;
  private readonly now: () => number;

  constructor(options: AuthFailureLimiterOptions = {}) {
    this.maxFailures = options.maxFailures ?? 10;
    this.windowMs = options.windowMs ?? 15 * 60 * 1000;
    this.maxKeys = options.maxKeys ?? 10_000;
    this.now = options.now ?? Date.now;
  }

  get size(): number {
    return this.failures.size;
  }

  /** Seconds until the key may try again, or undefined when it is not currently blocked. */
  retryAfterSeconds(key: string): number | undefined {
    const entry = this.failures.get(key);
    if (!entry) return undefined;

    const now = this.now();
    if (this.isExpired(entry, now)) {
      this.failures.delete(key);
      return undefined;
    }
    if (entry.count < this.maxFailures) return undefined;

    return Math.max(1, Math.ceil((entry.windowStartMs + this.windowMs - now) / 1000));
  }

  recordFailure(key: string): void {
    const now = this.now();
    const entry = this.failures.get(key);
    if (entry && !this.isExpired(entry, now)) {
      entry.count += 1;
      return;
    }

    this.failures.delete(key);
    if (this.failures.size >= this.maxKeys) this.makeRoom(now);
    this.failures.set(key, { count: 1, windowStartMs: now });
  }

  reset(key: string): void {
    this.failures.delete(key);
  }

  /** Success clears the key; wrong credentials count; missing or unconfigured credentials are ignored. */
  recordResult(key: string, auth: AuthResult): void {
    if (auth.ok) {
      this.reset(key);
    } else if (auth.reason === "invalid_token" || auth.reason === "invalid_authorization_scheme") {
      this.recordFailure(key);
    }
  }

  private isExpired(entry: FailureWindow, now: number): boolean {
    return now - entry.windowStartMs >= this.windowMs;
  }

  private makeRoom(now: number): void {
    for (const [key, entry] of this.failures) {
      if (this.isExpired(entry, now)) this.failures.delete(key);
    }
    while (this.failures.size >= this.maxKeys) {
      const oldestKey = this.failures.keys().next().value;
      if (oldestKey === undefined) return;
      this.failures.delete(oldestKey);
    }
  }
}

export function sendAuthRateLimited(reply: FastifyReply, retryAfterSeconds: number) {
  return reply.code(429).header("Retry-After", String(retryAfterSeconds)).send({ error: "auth_rate_limited" });
}
