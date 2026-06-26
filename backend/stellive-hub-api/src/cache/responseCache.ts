export interface ResponseCachePolicy {
  ttlMs: number;
  staleMs: number;
}

export interface ResponseCacheOptions {
  now?: () => number;
}

interface CacheEntry<T> {
  value: T;
  freshUntil: number;
  staleUntil: number;
  createdAt: number;
}

export class ResponseCache {
  private readonly now: () => number;
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  private readonly loads = new Map<string, Promise<unknown>>();
  private readonly refreshes = new Map<string, Promise<unknown>>();

  constructor(options: ResponseCacheOptions = {}) {
    this.now = options.now ?? (() => Date.now());
  }

  async getOrLoad<T>(key: string, policy: ResponseCachePolicy, loadFresh: () => Promise<T>): Promise<T> {
    const entry = this.entries.get(key) as CacheEntry<T> | undefined;
    const now = this.now();
    if (entry && entry.freshUntil > now) return entry.value;

    if (entry && entry.staleUntil > now) {
      this.startRefresh(key, policy, loadFresh);
      return entry.value;
    }

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
    this.entries.set(key, {
      value,
      freshUntil: now + policy.ttlMs,
      staleUntil: now + policy.ttlMs + policy.staleMs,
      createdAt: now,
    });
  }
}
