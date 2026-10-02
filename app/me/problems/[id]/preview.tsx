import { useLocalSearchParams } from 'expo-router';

import { Screen } from '../../../../src/components/civic';
import { PreviewScreen } from '../../../../src/features/submit/PreviewScreen';
import { RequireAuth } from '../../../../src/session/RequireAuth';

/*
 preview                         flags
 This is exactly what people     This is exactly what people would see
 would see                       ...
 Volunteers see it with personal  Please check
 details hidden.                  ! Fix before sending: Condition (hard)
 Shown as @handle                 ? Names someone: Affected
 Condition ... Affected ...         [ Keep as written ]
 An automated review checks it.  [ Back to edit ]
 [ Back to edit ]
*/
export default function PreviewRoute() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  return (
    <Screen>
      <RequireAuth>
        <PreviewScreen id={(Array.isArray(id) ? id[0] : id) ?? ''} />
      </RequireAuth>
    </Screen>
  );
}
