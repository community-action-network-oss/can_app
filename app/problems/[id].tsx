import { useLocalSearchParams } from 'expo-router';

import { Screen } from '../../src/components/civic';
import { ProblemDetail } from '../../src/problems/ProblemDetail';

/*
 normal                         tombstone                    not found / offline
 < Problems                     This item is no longer shown   Not found            You are offline.
 Title (h1)                     Removed on 3 Oct 2026.         We could not find    [Try again]
 Started by @ana in Amsterdam   Reason text                    this.                [< Problems]
 +-- Status ----------------+   [< Problems]                  [< Problems]
 | ◆ Open: gathering facts  |
 | ▲ Needs investigation    |
 | plain explanation        |
 | Needed next: ...         |
 | Decided under policy v2  |
 +--------------------------+
 About / Known / Not yet known
 History (timeline) [Load more]
*/
export default function ProblemScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  return (
    <Screen>
      <ProblemDetail id={(Array.isArray(id) ? id[0] : id) ?? ''} />
    </Screen>
  );
}
