// Browser storage can throw (privacy modes, disabled storage, quota), so every
// access goes through these wrappers.

function getStore(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

function read(kind: 'local' | 'session', key: string): string | null {
  try {
    return getStore(kind)?.getItem(key) ?? null
  } catch {
    return null
  }
}

function write(
  kind: 'local' | 'session',
  key: string,
  value: string | null | undefined
): void {
  try {
    const store = getStore(kind)
    if (!store) return
    if (value === null || value === undefined || value === '') {
      store.removeItem(key)
    } else {
      store.setItem(key, value)
    }
  } catch {
    // Ignore storage failures; callers keep working with in-memory state.
  }
}

export const readLocal = (key: string) => read('local', key)
export const writeLocal = (key: string, value: string | null | undefined) =>
  write('local', key, value)
export const readSession = (key: string) => read('session', key)
export const writeSession = (key: string, value: string | null | undefined) =>
  write('session', key, value)
