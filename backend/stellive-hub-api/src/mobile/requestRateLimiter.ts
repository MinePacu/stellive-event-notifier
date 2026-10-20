import type { FastifyReply, FastifyRequest } from "fastify";
import { mobileError } from "./mobileError.js";

export interface RequestRateLimiterOptions {
  /** Requests allowed per key per window. 0 disables the limit. */
  maxRequests: number;
  windowMs?: number;
  maxKeys?: number;
  now?: () => number;
}

interface RequestWindow {
  count: number;
  windowStartMs: number;
}

/** In-memory fixed-window request limiter keyed by client IP, with bounded memory. */
export class RequestRateLimiter {
  private readonly windows = new Map<string, RequestWindow>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly maxKeys: number;
  private readonly now: () => number;

  constructor(options: RequestRateLimiterOptions) {
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs ?? 60_000;
    this.maxKeys = options.maxKeys ?? 10_000;
    this.now = options.now ?? Date.now;
  }

  get size(): number {
    return this.windows.size;
  }

  /** Counts one request; returns seconds until the key may retry when over the limit, otherwise undefined. */
  consume(key: string): number | undefined {
    if (this.maxRequests <= 0) return undefined;

    const now = this.now();
    const entry = this.windows.get(key);
    if (entry && !this.isExpired(entry, now)) {
      if (entry.count >= this.maxRequests) {
        return Math.max(1, Math.ceil((entry.windowStartMs + this.windowMs - now) / 1000));
      }
      entry.count += 1;
      return undefined;
    }

    this.windows.delete(key);
    if (this.windows.size >= this.maxKeys) this.makeRoom(now);
    this.windows.set(key, { count: 1, windowStartMs: now });
    return undefined;
  }

  private isExpired(entry: RequestWindow, now: number): boolean {
    return now - entry.windowStartMs >= this.windowMs;
  }

  private makeRoom(now: number): void {
    for (const [key, entry] of this.windows) {
      if (this.isExpired(entry, now)) this.windows.delete(key);
    }
    while (this.windows.size >= this.maxKeys) {
      const oldestKey = this.windows.keys().next().value;
      if (oldestKey === undefined) return;
      this.windows.delete(oldestKey);
    }
  }
}

export interface MobileRateLimiters {
  /** POST /v1/devices/register, PUT /v1/devices/token, PUT /v1/preferences. */
  write?: RequestRateLimiter;
  /** GET /v1/preferences, GET /v1/bootstrap. */
  read?: RequestRateLimiter;
}

/** Fastify onRequest hook that replies 429 with Retry-After when the client IP is over budget. */
export function rateLimitHook(limiter: RequestRateLimiter | undefined) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const retryAfterSeconds = limiter?.consume(request.ip);
    if (retryAfterSeconds === undefined) return;

    const error = mobileError("rate_limited", 429);
    return reply.code(error.statusCode).header("Retry-After", String(retryAfterSeconds)).send(error.payload);
  };
}
