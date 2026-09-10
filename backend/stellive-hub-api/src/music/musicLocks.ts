import { randomUUID } from "node:crypto";

export type MusicSyncLockRelease = () => void | Promise<void>;
export type MusicSyncLockAcquireResult = MusicSyncLockRelease | null;

export interface MusicSyncLock {
  acquire(key: string, ttlMs: number): MusicSyncLockAcquireResult | Promise<MusicSyncLockAcquireResult>;
}

export class InMemoryMusicSyncLock implements MusicSyncLock {
  private readonly locks = new Map<string, { token: string; expiresAt: number }>();

  acquire(key: string, ttlMs: number): MusicSyncLockRelease | null {
    const now = Date.now();
    const existing = this.locks.get(key);
    if (existing && existing.expiresAt > now) return null;

    const token = randomUUID();
    this.locks.set(key, { token, expiresAt: now + ttlMs });
    let released = false;
    return () => {
      if (released) return;
      released = true;
      // Only the current owner may release; a stale release after TTL expiry must not
      // delete a lock another worker has since acquired.
      const current = this.locks.get(key);
      if (current && current.token === token) this.locks.delete(key);
    };
  }
}

export interface RedisMusicSyncLockClient {
  set(key: string, value: string, expiryMode: "PX", ttlMs: number, setMode: "NX"): Promise<"OK" | null>;
  eval(script: string, numberOfKeys: number, key: string, value: string): Promise<unknown>;
  quit(): Promise<unknown>;
}

export interface RedisMusicSyncLockOptions {
  keyPrefix?: string;
  createToken?: () => string;
}

const releaseIfOwnerScript = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0
`;

export class RedisMusicSyncLock implements MusicSyncLock {
  private readonly keyPrefix: string;
  private readonly createToken: () => string;

  constructor(
    private readonly client: RedisMusicSyncLockClient,
    options: RedisMusicSyncLockOptions = {},
  ) {
    this.keyPrefix = options.keyPrefix ?? "stellive-hub:music-sync-lock";
    this.createToken = options.createToken ?? randomUUID;
  }

  async acquire(key: string, ttlMs: number): Promise<MusicSyncLockAcquireResult> {
    const redisKey = `${this.keyPrefix}:${key}`;
    const token = this.createToken();
    const acquired = await this.client.set(redisKey, token, "PX", ttlMs, "NX");
    if (acquired !== "OK") return null;

    let released = false;
    return async () => {
      if (released) return;
      released = true;
      await this.client.eval(releaseIfOwnerScript, 1, redisKey, token);
    };
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}
