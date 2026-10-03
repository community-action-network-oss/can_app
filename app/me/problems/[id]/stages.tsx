import { router, useLocalSearchParams } from 'expo-router';

import { Screen } from '../../../../src/components/civic';
import { PlanScreen } from '../../../../src/preparation/plan';
import { RequireAuth } from '../../../../src/session/RequireAuth';

// Route glue: the only place that names the schema field holding the stage plan.
export default function StagesRoute() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const did = (Array.isArray(id) ? id[0] : id) ?? '';
  return (
    <Screen>
      <RequireAuth>
        <PlanScreen
          id={did}
          fieldKey="stage_plan"
          onBack={() => router.push(`/me/problems/${did}` as never)}
        />
      </RequireAuth>
    </Screen>
  );
}
