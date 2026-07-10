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

export class ResponseCache {
  private readonly now: () => number;
  private readonly maxEntries: number;
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  private readonly loads = new Map<string, Promise<unknown>>();
  private readonly refreshes = new Map<string, Promise<unknown>>();

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

    const existingLoad = this.loads.get(key) as Promise<T> | undefined;
    if (existingLoad) return existingLoad;

    const load = loadFresh()
      .then((value) => {
        this.store(key, value, policy);
        return value;
      })
      .finally(() => {
        this.loads.delete(key);
      });
    this.loads.set(key, load);
    return load;
  }

  async waitForRefreshes(): Promise<void> {
    await Promise.allSettled([...this.refreshes.values()]);
  }

  private startRefresh<T>(key: string, policy: ResponseCachePolicy, loadFresh: () => Promise<T>): void {
    if (this.refreshes.has(key)) return;
    const refresh = loadFresh()
      .then((value) => {
        this.store(key, value, policy);
        return value;
      })
      .catch(() => undefined)
      .finally(() => {
        this.refreshes.delete(key);
      });
    this.refreshes.set(key, refresh);
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
}
