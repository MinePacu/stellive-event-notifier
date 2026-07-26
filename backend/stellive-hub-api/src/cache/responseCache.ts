export interface ResponseCachePolicy {
  ttlMs: number;
  staleMs: number;
}

export interface ResponseCacheOptions {
  now?: () => number;
  maxEntries?: number;
}

interface CacheEntry<T> {
  value: T;
  freshUntil: number;
  staleUntil: number;
  createdAt: number;
  lastAccessedAt: number;
}

interface InFlightLoad {
  promise: Promise<unknown>;
  revision: number;
}

export class ResponseCache {
  private readonly now: () => number;
  private readonly maxEntries: number;
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  private readonly loads = new Map<string, InFlightLoad>();
  private readonly refreshes = new Map<string, InFlightLoad>();
  private readonly revisions = new Map<string, number>();

  constructor(options: ResponseCacheOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    const maxEntries = Math.trunc(options.maxEntries ?? 256);
    this.maxEntries = Number.isFinite(maxEntries) && maxEntries > 0 ? maxEntries : 256;
  }

  async getOrLoad<T>(key: string, policy: ResponseCachePolicy, loadFresh: () => Promise<T>): Promise<T> {
    const entry = this.entries.get(key) as CacheEntry<T> | undefined;
    const now = this.now();
    if (entry && entry.freshUntil > now) {
      this.touch(key, entry, now);
      return entry.value;
    }

    if (entry && entry.staleUntil > now) {
      this.touch(key, entry, now);
      this.startRefresh(key, policy, loadFresh);
      return entry.value;
    }

    if (entry) this.entries.delete(key);

    return this.getOrLoadFresh(key, policy, loadFresh);
  }

  async getOrLoadFresh<T>(key: string, policy: ResponseCachePolicy, loadFresh: () => Promise<T>): Promise<T> {
    const revision = this.revisionFor(key);
    const existingLoad = this.loads.get(key);
    if (existingLoad?.revision === revision) return existingLoad.promise as Promise<T>;

    let inFlight: InFlightLoad;
    const promise = Promise.resolve()
      .then(loadFresh)
      .then((value) => {
        if (this.revisionFor(key) === revision) this.store(key, value, policy);
        return value;
      })
      .finally(() => {
        if (this.loads.get(key) === inFlight) this.loads.delete(key);
      });
    inFlight = { promise, revision };
    this.loads.set(key, inFlight);
    return promise;
  }

  invalidatePrefix(prefix: string): number {
    const keys = new Set([
      ...this.entries.keys(),
      ...this.loads.keys(),
      ...this.refreshes.keys(),
    ]);
    let invalidated = 0;
    for (const key of keys) {
      if (!key.startsWith(prefix)) continue;
      if (this.entries.delete(key)) invalidated += 1;
      this.revisions.set(key, this.revisionFor(key) + 1);
    }
    return invalidated;
  }

  async waitForRefreshes(): Promise<void> {
    await Promise.allSettled([...this.refreshes.values()].map((refresh) => refresh.promise));
  }

  private startRefresh<T>(key: string, policy: ResponseCachePolicy, loadFresh: () => Promise<T>): void {
    const revision = this.revisionFor(key);
    if (this.refreshes.get(key)?.revision === revision) return;

    let inFlight: InFlightLoad;
    const promise = this.getOrLoadFresh(key, policy, loadFresh)
      .catch(() => undefined)
      .finally(() => {
        if (this.refreshes.get(key) === inFlight) this.refreshes.delete(key);
      });
    inFlight = { promise, revision };
    this.refreshes.set(key, inFlight);
  }

  private store<T>(key: string, value: T, policy: ResponseCachePolicy): void {
    const now = this.now();
    this.entries.delete(key);
    this.entries.set(key, {
      value,
      freshUntil: now + policy.ttlMs,
      staleUntil: now + policy.ttlMs + policy.staleMs,
      createdAt: now,
      lastAccessedAt: now,
    });
    this.evictIfNeeded(now);
  }

  private touch(key: string, entry: CacheEntry<unknown>, now: number): void {
    entry.lastAccessedAt = now;
    this.entries.delete(key);
    this.entries.set(key, entry);
  }

  private pruneExpired(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.staleUntil <= now) this.entries.delete(key);
    }
  }

  private evictIfNeeded(now: number): void {
    if (this.entries.size <= this.maxEntries) return;
    this.pruneExpired(now);
    if (this.entries.size <= this.maxEntries) return;

    const oldest = [...this.entries.entries()].sort(([, left], [, right]) =>
      left.lastAccessedAt - right.lastAccessedAt || left.createdAt - right.createdAt
    );
    for (const [key] of oldest) {
      if (this.entries.size <= this.maxEntries) break;
      this.entries.delete(key);
    }
  }

  private revisionFor(key: string): number {
    return this.revisions.get(key) ?? 0;
  }
}
