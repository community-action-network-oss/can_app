import { useLocalSearchParams } from 'expo-router';

import { Screen } from '../../../../src/components/civic';
import { PrepWorkspace } from '../../../../src/preparation/PrepWorkspace';
import { RequireAuth } from '../../../../src/session/RequireAuth';

// Route glue: the only place that names a schema field (the sources list) and the sibling editor routes.
export default function PrepRoute() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const did = (Array.isArray(id) ? id[0] : id) ?? '';
  const base = `/me/problems/${did}`;
  return (
    <Screen>
      <RequireAuth>
        <PrepWorkspace
          id={did}
          sourcesKey="sources"
          links={{ facts: `${base}/facts`, criteria: `${base}/criteria`, stages: `${base}/stages` }}
        />
      </RequireAuth>
    </Screen>
  );
}
