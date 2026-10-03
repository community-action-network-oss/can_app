import { useLocalSearchParams } from 'expo-router';

import { Screen } from '../../../../../src/components/civic';
import { StageOptions } from '../../../../../src/stages/options/StageOptions';

/*
 Options
 Shown in the order they were added. No ranking.
 | Field     | Option 1 | Option 2 |      narrow: one card per option
 | Mechanism | ...      | ...      |
 [ Suggest an option ]   (members only; guests read)
*/
export default function OptionsRoute() {
  const p = useLocalSearchParams<{ id: string | string[]; stageId: string | string[] }>();
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  return (
    <Screen>
      <StageOptions problemId={one(p.id)} stageId={one(p.stageId)} />
    </Screen>
  );
}
