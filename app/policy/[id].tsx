import { useLocalSearchParams } from 'expo-router';

import { Screen } from '../../src/components/civic';
import { PolicyProposalView } from '../../src/features/policy/PolicyProposalView';

// WF-POLICY-2. Readable by anyone, so no RequireAuth.
export default function PolicyProposalRoute() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  return (
    <Screen>
      <PolicyProposalView id={(Array.isArray(id) ? id[0] : id) ?? ''} />
    </Screen>
  );
}
