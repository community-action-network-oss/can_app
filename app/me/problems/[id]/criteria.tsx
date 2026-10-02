import { router, useLocalSearchParams } from 'expo-router';

import { Screen } from '../../../../src/components/civic';
import { CriteriaScreen } from '../../../../src/preparation/criteria';
import { RequireAuth } from '../../../../src/session/RequireAuth';

/*
 +------------------------------------+
 | When is this solved                |
 | Write final acceptance criteria... |
 | 1 criterion                        |
 | Example, synthetic: "..."          |
 | Item 1 [fields]  [Remove item 1]   |
 | [Add another]  [Submit]  [Back]    |
 +------------------------------------+ */
// Route glue: the only place that names the schema field holding the final criteria.
export default function CriteriaRoute() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const did = (Array.isArray(id) ? id[0] : id) ?? '';
  return (
    <Screen>
      <RequireAuth>
        <CriteriaScreen
          id={did}
          fieldKey="final_acceptance_criteria"
          onBack={() => router.push(`/me/problems/${did}` as never)}
        />
      </RequireAuth>
    </Screen>
  );
}
