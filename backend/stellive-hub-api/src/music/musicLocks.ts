export type MusicSyncLockRelease = () => void;

export interface MusicSyncLock {
  acquire(key: string, ttlMs: number): MusicSyncLockRelease | null;
}

export class InMemoryMusicSyncLock implements MusicSyncLock {
  private readonly locks = new Map<string, number>();

  acquire(key: string, ttlMs: number): MusicSyncLockRelease | null {
    const now = Date.now();
    const expiresAt = this.locks.get(key);
    if (expiresAt && expiresAt > now) return null;

    this.locks.set(key, now + ttlMs);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.locks.delete(key);
    };
  }
}
