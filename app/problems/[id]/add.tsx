import { useLocalSearchParams } from 'expo-router';

import { Screen } from '../../../src/components/civic';
import { AddContribution } from '../../../src/contributions/AddContribution';
import { RequireAuth } from '../../../src/session/RequireAuth';

/*
 Add to this problem
 2 of 4 replies left today          At zero: "You have used your replies for today"
 Make it count. ...                 "You can reply again at 14:30. ..." / "Your draft is kept."
 What kind? ( ) Question ...        [ Post ] is off, the form stays editable
 (form from the contribution schema)
 [ Post ]
*/
export default function AddContributionRoute() {
  const p = useLocalSearchParams<{ id: string | string[]; stageId?: string | string[] }>();
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return (
    <Screen>
      <RequireAuth>
        <AddContribution problemId={one(p.id) ?? ''} stageId={one(p.stageId) || undefined} />
      </RequireAuth>
    </Screen>
  );
}
