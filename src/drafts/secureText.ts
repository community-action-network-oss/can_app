// Private on-device text store for drafts. Same approach as src/profile/store.ts (that file is not edited here):
// native = expo-secure-store; web = AES-GCM with a non-extractable CryptoKey in IndexedDB, ciphertext in localStorage.
// SecureStore values are limited (about 2048 bytes on some platforms), so native text is split into small chunks.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const NAME = 'can.draft.v1';
// 600 UTF-16 units is at most 1800 UTF-8 bytes, under the 2048 byte limit.
export const CHUNK = 600;

const web = () => Platform.OS === 'web';

const idb = <T>(run: (s: IDBObjectStore) => IDBRequest<T>, mode: IDBTransactionMode) =>
  new Promise<T>((ok, no) => {
    const open = indexedDB.open('can-drafts', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('k');
    open.onerror = () => no(open.error);
    open.onsuccess = () => {
      const r = run(open.result.transaction('k', mode).objectStore('k'));
      r.onsuccess = () => ok(r.result);
      r.onerror = () => no(r.error);
    };
  });

async function webKey(create: boolean): Promise<CryptoKey | null> {
  const k = (await idb((s) => s.get(NAME), 'readonly')) as CryptoKey | undefined;
  if (k || !create) return k ?? null;
  const fresh = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  await idb((s) => s.put(fresh, NAME), 'readwrite');
  return fresh;
}

// Loop instead of spreading, so a long draft cannot overflow the call stack.
const b64 = (b: Uint8Array) => {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function webWrite(text: string) {
  const key = (await webKey(true))!;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text)),
  );
  localStorage.setItem(NAME, `${b64(iv)}.${b64(ct)}`);
}

async function webRead(): Promise<string | null> {
  const raw = localStorage.getItem(NAME);
  const key = await webKey(false);
  if (!raw || !key) return null;
  const [iv, ct] = raw.split('.');
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(iv) as BufferSource },
    key,
    unb64(ct) as BufferSource,
  );
  return new TextDecoder().decode(pt);
}

/** Splits text into chunks that each fit one SecureStore item. */
export const toChunks = (text: string) => {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK) out.push(text.slice(i, i + CHUNK));
  return out.length ? out : [''];
};

const count = async () => Number((await SecureStore.getItemAsync(`${NAME}.n`)) ?? 0);

export async function readText(): Promise<string | null> {
  if (web()) return webRead();
  const n = await count();
  if (!n) return null;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const p = await SecureStore.getItemAsync(`${NAME}.${i}`);
    if (p === null) return null; // torn write reads as no draft
    parts.push(p);
  }
  return parts.join('');
}

export async function writeText(text: string): Promise<void> {
  if (web()) return webWrite(text);
  const old = await count();
  const chunks = toChunks(text);
  for (let i = 0; i < chunks.length; i++) await SecureStore.setItemAsync(`${NAME}.${i}`, chunks[i]);
  await SecureStore.setItemAsync(`${NAME}.n`, String(chunks.length)); // count last: commit point
  for (let i = chunks.length; i < old; i++) await SecureStore.deleteItemAsync(`${NAME}.${i}`);
}

export async function deleteText(): Promise<void> {
  if (web()) {
    await idb((s) => s.delete(NAME), 'readwrite'); // key first
    localStorage.removeItem(NAME);
    return;
  }
  const n = await count();
  await SecureStore.deleteItemAsync(`${NAME}.n`);
  for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${NAME}.${i}`);
}
