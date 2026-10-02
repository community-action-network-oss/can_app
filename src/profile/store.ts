// On-device capability profile store (D-80, PROFILE-LOCAL-1). This module never touches the network.
// Native: expo-secure-store (iOS Keychain, Android Keystore-encrypted prefs). Web: AES-GCM with a non-extractable
// CryptoKey kept in IndexedDB, ciphertext in localStorage.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { emptyProfile, fromFile, ProfileSchema, type Profile, toFile } from './model';

const NAME = 'can.profile.v1';

// ---- web: encrypted localStorage ------------------------------------------------------------
const idb = <T>(run: (s: IDBObjectStore) => IDBRequest<T>, mode: IDBTransactionMode) =>
  new Promise<T>((ok, no) => {
    const open = indexedDB.open('can-profile', 1);
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

const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
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

// ---- public API ------------------------------------------------------------------------------
const web = () => Platform.OS === 'web';

/** The saved profile, or an empty one. A damaged or unreadable store reads as empty. */
export async function loadProfile(): Promise<Profile> {
  try {
    const text = web() ? await webRead() : await SecureStore.getItemAsync(NAME);
    return (text && fromFile(text)) || emptyProfile();
  } catch {
    return emptyProfile();
  }
}

/** Writes the whole profile. Called only when the person confirms a step. */
export async function saveProfile(p: Profile): Promise<void> {
  const text = toFile(ProfileSchema.parse(p));
  if (web()) await webWrite(text);
  else await SecureStore.setItemAsync(NAME, text);
}

/** Merges one confirmed step into what is saved. */
export async function saveStep(part: Partial<Profile>): Promise<Profile> {
  const next = { ...(await loadProfile()), ...part };
  await saveProfile(next);
  return next;
}

/** Key first, then the store (spec 26 section 7). */
export async function deleteProfile(): Promise<void> {
  if (web()) {
    await idb((s) => s.delete(NAME), 'readwrite'); // the key
    localStorage.removeItem(NAME); // the ciphertext
  } else {
    await SecureStore.deleteItemAsync(NAME); // key and value are one keystore entry
  }
}
