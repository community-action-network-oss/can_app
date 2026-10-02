import { useLocalSearchParams } from 'expo-router';

import { Screen } from '../../../../src/components/civic';
import { useT } from '../../../../src/i18n';
import { FactsSection } from '../../../../src/features/submit/FactsSection';
import { RequireAuth } from '../../../../src/session/RequireAuth';

/*
 empty                          error (server field)           flags / read-only
 Prepare: Facts and causes      ...                            Prepare: Facts and causes
 Private. Only you can see.     What is the condition?         A newer version is available.
 Section 1 of 6: The condition  [Gaps in the pavement      ]  (answers shown, not editable)
 0 of 12 needed fields answered ! Say at least 20 characters   Section 1 of 6 ...
 What is the condition? (req)   [ Back ] [ Next ]             Saved on this device at 10:42
 [                          ]
 [ Next ]                       Linked parts (read-only links)
 Saved on this device at 10:42  [ Trusted sources ] [ When it is solved ]
 Context: not available yet     [ Stages (optional) ]
*/
// Route glue: the only place that names fields owned by other screens (sources, criteria, stages, area, context).
export default function FactsRoute() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const did = (Array.isArray(id) ? id[0] : id) ?? 'new';
  const base = `/me/problems/${did}`;
  return (
    <Screen>
      <RequireAuth>
        <FactsSection
          id={did}
          context={['context_profile']}
          linked={[
            { key: 'sources', label: t('prep.part.sources'), href: `${base}/sources` },
            {
              key: 'final_acceptance_criteria',
              label: t('prep.part.criteria'),
              href: `${base}/criteria`,
            },
            { key: 'stage_plan', label: t('prep.part.stages'), href: `${base}/stages` },
            { key: 'affected_area', label: t('submit.part.area'), href: `${base}/area` },
          ]}
        />
      </RequireAuth>
    </Screen>
  );
}
