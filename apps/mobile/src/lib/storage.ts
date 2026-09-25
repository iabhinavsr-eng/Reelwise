import AsyncStorage from '@react-native-async-storage/async-storage';

/** Small JSON wrapper around AsyncStorage. Corrupt values read as null. */
export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function removeKey(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

export function makeId(): string {
  // RFC4122-ish v4; good enough for local ids (server rows use gen_random_uuid()).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(abortError());
    });
  });

export function abortError() {
  const e = new Error('Aborted');
  e.name = 'AbortError';
  return e;
}

export const isAbortError = (e: unknown) => e instanceof Error && e.name === 'AbortError';
