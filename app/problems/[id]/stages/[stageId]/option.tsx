import { useLocalSearchParams } from 'expo-router';

import { Screen } from '../../../../../src/components/civic';
import { RequireAuth } from '../../../../../src/session/RequireAuth';
import { OptionForm } from '../../../../../src/stages/options/OptionForm';

/*
 Suggest an option          2 of 4 replies left today
 (form from the stage_option schema)    At zero: Post is off, draft kept
 [ Post ]
*/
export default function OptionRoute() {
  const p = useLocalSearchParams<{ id: string | string[]; stageId: string | string[] }>();
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  return (
    <Screen>
      <RequireAuth>
        <OptionForm problemId={one(p.id)} stageId={one(p.stageId)} />
      </RequireAuth>
    </Screen>
  );
}
