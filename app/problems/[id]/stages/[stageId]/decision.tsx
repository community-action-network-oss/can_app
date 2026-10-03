import { useLocalSearchParams } from 'expo-router';

import { Screen } from '../../../../../src/components/civic';
import { ChoiceRecord } from '../../../../../src/decisions/ChoiceRecord';
import { StageControls } from '../../../../../src/stages/controls/StageControls';

/*
 Test harness for the stage workspace (12-u18), which mounts both parts itself.
 Choice
   Chosen: Option 1: ...        Why: ...        Decided by @ann (steward)
   [ Policy v1, transitional stewardship ]
   Legal check: L4 National law: A rule limits this (blocks this choice), articles, corpus
   [ Make the choice ]  (poster only, stage in progress, no choice yet)
 Stage controls
   Checking evidence | [ Start this stage ] [ Send evidence for checking ] [ Mark as blocked ]
*/
export default function DecisionRoute() {
  const p = useLocalSearchParams<{ id: string | string[]; stageId: string | string[] }>();
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  return (
    <Screen>
      <ChoiceRecord problemId={one(p.id)} stageId={one(p.stageId)} />
      <StageControls stageId={one(p.stageId)} />
    </Screen>
  );
}
