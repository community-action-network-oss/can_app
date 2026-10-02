import { Screen } from '../../src/components/civic';
import { PolicyProposalForm } from '../../src/features/policy/PolicyProposalForm';
import { RequireAuth } from '../../src/session/RequireAuth';

export default function NewPolicyProposalRoute() {
  return (
    <Screen>
      <RequireAuth>
        <PolicyProposalForm />
      </RequireAuth>
    </Screen>
  );
}
