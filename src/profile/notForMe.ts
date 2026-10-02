// "Not for me" list: public problem ids the person hid from their matches. On the device only; never sent anywhere.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const NAME = 'can.notforme.v1';
const web = () => Platform.OS === 'web';

export async function loadNotForMe(): Promise<Set<string>> {
  try {
    const raw = web() ? localStorage.getItem(NAME) : await SecureStore.getItemAsync(NAME);
    const j = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(j) ? j.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export async function addNotForMe(id: string): Promise<Set<string>> {
  const next = (await loadNotForMe()).add(id);
  const text = JSON.stringify([...next]);
  if (web()) localStorage.setItem(NAME, text);
  else await SecureStore.setItemAsync(NAME, text);
  return next;
}

export async function clearNotForMe(): Promise<void> {
  try {
    if (web()) localStorage.removeItem(NAME);
    else await SecureStore.deleteItemAsync(NAME);
  } catch {
    // nothing stored or store unavailable
  }
}
