import { useCallback, useEffect, useState } from 'react';

import { type Draft, flush, load, save } from './draftStore';

export type DraftStatus = 'saved' | 'saving' | 'unsynced';
type Schema = Pick<Draft, 'schemaId' | 'schemaVersion' | 'schemaHash'>;

/** Draft state for one schema. Independent of the session: it works signed out and across session expiry. */
export function useDraft(schema: Schema) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState<DraftStatus>('saved');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const { schemaId, schemaVersion, schemaHash } = schema;

  useEffect(() => {
    let live = true;
    void load().then((d) => {
      if (!live) return;
      setDraft(d);
      setSavedAt(d?.updatedAt ?? null);
    });
    return () => {
      live = false;
      void flush(); // leaving the screen writes what is waiting
    };
  }, []);

  const write = useCallback(
    (patch: Partial<Draft>) => {
      setStatus('saving');
      const p = save({ schemaId, schemaVersion, schemaHash, ...patch });
      // read back the in-memory draft the store now holds
      void load().then(setDraft);
      p.then(
        () => {
          setStatus('saved');
          setSavedAt(Date.now());
        },
        () => setStatus('unsynced'), // kept in memory; the indicator shows the calm warning
      );
    },
    [schemaId, schemaVersion, schemaHash],
  );

  const setField = useCallback(
    (key: string, value: unknown) => {
      void load().then((d) => write({ body: { ...(d?.body ?? {}), [key]: value } }));
    },
    [write],
  );
  const setUnknown = useCallback((unknown: Draft['unknown']) => write({ unknown }), [write]);

  return { draft, setField, setUnknown, save: write, savedAt, status };
}
