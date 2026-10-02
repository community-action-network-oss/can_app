import { router } from 'expo-router';
import { useState } from 'react';

import { ApiError } from '../../api/errors';
import { Box, CivicButton, CivicText } from '../../components/civic';
import { useT } from '../../i18n';
import { useContentSchema } from '../../forms/schema/useContentSchema';
import type { Schema } from '../../forms/schema/model';
import { changedPaths, graceEnded, labels, minorNotice, needsMove } from './migrationPlan';
import { useMigrationPlan } from './useMigration';

/** WF-FORM-5 banner on the facts screen: pinned (Move, Stay), minor notice, unavailable, grace ended. */
export function MigrationBanner({ id, version }: { id: string; version?: string }) {
  const t = useT();
  const q = useMigrationPlan(id);
  const plan = q.data;
  const target = useContentSchema('problem', {
    version: plan?.target?.schema_version,
    enabled: !!plan && needsMove(plan),
  });
  const [stayed, setStayed] = useState(false);

  if (q.error instanceof ApiError && q.error.code === 'schema_migration_unavailable')
    return (
      <CivicText variant="bodyStrong" testID="migration-unavailable">
        {t('form.version.unavailable')}
      </CivicText>
    );
  if (!plan?.bump) return null; // a failed or odd response never blocks the form
  if (minorNotice(plan))
    return (
      <CivicText variant="bodyStrong" testID="migration-minor">
        {t('form.version.minor')}
      </CivicText>
    );
  if (!needsMove(plan) || stayed) return null;

  const ended = graceEnded(plan);
  const move = () => router.push({ pathname: '/submit/[id]/migrate', params: { id } });
  return (
    <Box className="gap-2 p-4 border border-can-border" testID="migration-banner" role="status">
      <CivicText variant="bodyStrong">
        {t('form.version.pinned', { version: version ?? plan.current.schema_version })}
      </CivicText>
      <CivicText>{t('form.version.newer')}</CivicText>
      <CivicText>
        {t('form.version.changed', {
          fields: labels(
            target.data?.schema as Schema | undefined,
            target.data?.messages ?? {},
            changedPaths(plan),
          ),
        })}
      </CivicText>
      {plan.grace_ends_at ? (
        <CivicText testID="migration-grace">
          {ended
            ? t('form.version.graceEnded')
            : t('form.version.graceEnds', { date: Date.parse(plan.grace_ends_at) })}
        </CivicText>
      ) : null}
      <CivicButton
        label={t('form.version.move')}
        accessibilityLabel={t('form.version.move')}
        onPress={move}
      />
      {ended ? null : (
        <CivicButton
          variant="secondary"
          label={t('form.version.stay')}
          accessibilityLabel={t('form.version.stay')}
          onPress={() => setStayed(true)}
        />
      )}
    </Box>
  );
}
