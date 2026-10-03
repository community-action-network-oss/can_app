import { useLocalSearchParams } from 'expo-router';

import { Screen } from '../../../../src/components/civic';
import { ResolveScreen } from '../../../../src/review/resolve';
import { RequireAuth } from '../../../../src/session/RequireAuth';

export default function ResolveRoute() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  return (
    <Screen>
      <RequireAuth>
        <ResolveScreen id={(Array.isArray(id) ? id[0] : id) ?? ''} />
      </RequireAuth>
    </Screen>
  );
}
