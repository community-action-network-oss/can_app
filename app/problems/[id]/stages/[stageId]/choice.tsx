import { useLocalSearchParams } from 'expo-router';

import { Screen } from '../../../../../src/components/civic';
import { ChoiceForm } from '../../../../../src/decisions/ChoiceForm';
import { RequireAuth } from '../../../../../src/session/RequireAuth';

/*
 Make the choice
 (form from the stage_choice schema; options picked from this stage)
 If the law check holds or blocks it, a plain note says so and nothing is lost.
 [ Record the choice ]
*/
export default function ChoiceRoute() {
  const p = useLocalSearchParams<{ id: string | string[]; stageId: string | string[] }>();
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  return (
    <Screen>
      <RequireAuth>
        <ChoiceForm problemId={one(p.id)} stageId={one(p.stageId)} />
      </RequireAuth>
    </Screen>
  );
}
