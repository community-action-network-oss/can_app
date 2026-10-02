import { api } from '../../api/client';
import { unwrap } from '../../api/unwrap';

type Stamps = { schemaVersion: string; schemaHash: string };

// Server draft version per draft id, from the last response. ponytail: in memory only, there is no GET /v1/drafts/:id yet.
const versions = new Map<string, number>();

/** Creates ('new') or updates the server draft with the content and the pinned schema stamps. Returns the draft id. */
export async function saveDraft(id: string, content: Record<string, unknown>, s: Stamps) {
  const body = { content, ...s };
  const d =
    id === 'new'
      ? await unwrap(api.POST('/v1/drafts', { body }))
      : await unwrap(
          api.PATCH('/v1/drafts/{id}', {
            params: { path: { id } },
            body: { ...body, expectedVersion: versions.get(id) ?? 0 },
          }),
        );
  versions.set(d.id, d.version);
  return d.id;
}
