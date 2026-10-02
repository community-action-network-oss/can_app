import { useEffect, useState } from 'react';

import { emptyProfile, type Profile } from './model';
import { loadProfile } from './store';

/** Saved profile, loaded once. `ready` is false until the device store has answered. */
export function useSavedProfile() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    void loadProfile().then((p) => live && (setProfile(p), setReady(true)));
    return () => {
      live = false;
    };
  }, []);
  return { profile, ready, reload: () => loadProfile().then(setProfile) };
}

export const toggle = <T>(list: readonly T[], v: T): T[] =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
