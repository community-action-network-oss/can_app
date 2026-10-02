import { WelcomeScreen } from '../src/auth/WelcomeScreen';
import { RequireAuth } from '../src/session/RequireAuth';

export default function WelcomeRoute() {
  return (
    <RequireAuth>
      <WelcomeScreen />
    </RequireAuth>
  );
}
