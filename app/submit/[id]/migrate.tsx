import { useLocalSearchParams } from 'expo-router';

import { Screen } from '../../../src/components/civic';
import { MigrationScreen } from '../../../src/features/submit/MigrationScreen';
import { RequireAuth } from '../../../src/session/RequireAuth';

/*
 WF-FORM-5 states
 minor, moved by itself      major, to confirm            unavailable            grace ended
 Facts                       Move to the new version      Facts                  Facts
 New optional fields were    Nothing moves until you say  A newer form version   You started on version 1.0.0.
 added to this form. Your    so.                          exists, but this       A newer version is available.
 answers are unchanged.      Carried over: Where to Where draft cannot move      New or changed: Scope
 (answers editable)          [x] Move my answer from      yet. Your draft stays  The time to stay on your
                                 Scope to Reach: wide     on your version and    version has ended. Move ...
 Banner (pinned, grace on)   [ ] Remove my answer for     nothing is lost.       [ Move to the new version ]
 You started on version 1.0.0 Old note: text             (form still editable)  (no Stay button)
 [ Move ] [ Stay ]           New questions: Reach
 You can stay until 3 Nov    Confirm every answer above   Move stays disabled until every row is checked.
*/
// Route glue only: lives under app/submit so this unit writes nothing outside its set.
export default function MigrateRoute() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const did = (Array.isArray(id) ? id[0] : id) ?? 'new';
  return (
    <Screen>
      <RequireAuth>
        <MigrationScreen id={did} />
      </RequireAuth>
    </Screen>
  );
}
