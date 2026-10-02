import { Screen } from '../../src/components/civic';
import { InviteScreen } from '../../src/invites';
import { RequireAuth } from '../../src/session/RequireAuth';

export default function InvitesRoute() {
  return (
    <Screen>
      <RequireAuth>
        <InviteScreen />
      </RequireAuth>
    </Screen>
  );
}
