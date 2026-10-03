import { Screen } from '../../../src/components/civic';
import { QueueScreen } from '../../../src/review/queue';
import { RequireAuth } from '../../../src/session/RequireAuth';

export default function ReviewProblemsRoute() {
  return (
    <Screen>
      <RequireAuth>
        <QueueScreen />
      </RequireAuth>
    </Screen>
  );
}
