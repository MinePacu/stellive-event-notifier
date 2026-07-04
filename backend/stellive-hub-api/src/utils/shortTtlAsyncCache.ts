export interface ShortTtlAsyncCacheOptions {
  ttlMs: number;
  now?: () => number;
}

export class ShortTtlAsyncCache<T> {
  private value: T | undefined;
  private hasValue = false;
  private expiresAt = 0;
  private inFlight: Promise<T> | undefined;
  private readonly now: () => number;

  constructor(private readonly options: ShortTtlAsyncCacheOptions) {
    this.now = options.now ?? Date.now;
  }

  getOrLoad(loader: () => Promise<T> | T): Promise<T> {
    if (this.hasValue && this.now() < this.expiresAt) {
      return Promise.resolve(this.value as T);
    }
    if (this.inFlight) {
      return this.inFlight;
    }

    const refresh = Promise.resolve()
      .then(loader)
      .then((value) => {
        this.value = value;
        this.hasValue = true;
        this.expiresAt = this.now() + this.options.ttlMs;
        return value;
      });
    const inFlight = refresh.finally(() => {
      if (this.inFlight === inFlight) {
        this.inFlight = undefined;
      }
    });
    this.inFlight = inFlight;
    return inFlight;
  }
}
