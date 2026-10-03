import { useLocalSearchParams } from 'expo-router';

import { Screen } from '../../../src/components/civic';
import { ProblemScreen } from '../../../src/review/problem';
import { RequireAuth } from '../../../src/session/RequireAuth';

export default function ReviewProblemRoute() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  return (
    <Screen>
      <RequireAuth>
        <ProblemScreen id={(Array.isArray(id) ? id[0] : id) ?? ''} />
      </RequireAuth>
    </Screen>
  );
}
