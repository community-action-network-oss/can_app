import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';

import { api } from '../../api/client';
import { ApiError } from '../../api/errors';
import { unwrap } from '../../api/unwrap';
import {
  Box,
  CheckboxField,
  CivicButton,
  CivicHeading,
  CivicText,
  FormError,
  StatusMessage,
} from '../../components/civic';
import { flush, load, save } from '../../drafts/draftStore';
import { useT } from '../../i18n';
import type { Schema, Value } from '../../forms/schema/model';
import { useContentSchema } from '../../forms/schema/useContentSchema';
import {
  applyPlan,
  labels,
  needsMove,
  rowKey,
  toConfirm,
  type Mapping,
  type Plan,
} from './migrationPlan';
import { schemaErrorId } from './schemaErrors';
import { draftVersion, rememberVersion } from './saveDraft';
import { useMigrationPlan } from './useMigration';

/** WF-FORM-5 migration view. Nothing moves until the person confirms every non-copy row. */
export function MigrationScreen({ id }: { id: string }) {
  const t = useT();
  const q = useMigrationPlan(id);
  const plan = q.data;
  const from = useContentSchema('problem', {
    version: plan?.current.schema_version,
    enabled: !!plan,
  });
  const to = useContentSchema('problem', {
    version: plan?.target.schema_version,
    enabled: !!plan,
  });
  if (q.error) {
    const quiet = q.error instanceof ApiError && q.error.code === 'schema_migration_unavailable';
    return (
      <StatusMessage
        state="error"
        message={t(quiet ? 'form.version.unavailable' : 'common.error.generic')}
      />
    );
  }
  if (!plan || !from.data || !to.data)
    return <StatusMessage state="loading" message={t('common.loading')} />;
  if (!needsMove(plan)) return <StatusMessage state="empty" message={t('form.migrate.nothing')} />;
  return (
    <MigrationBody
      id={id}
      plan={plan}
      oldS={from.data.schema as Schema}
      oldM={from.data.messages}
      newS={to.data.schema as Schema}
      newM={to.data.messages}
    />
  );
}

type Props = {
  id: string;
  plan: Plan;
  oldS: Schema;
  oldM: Record<string, unknown>;
  newS: Schema;
  newM: Record<string, unknown>;
};

const show = (v: unknown, none: string) =>
  v == null ? none : typeof v === 'string' ? v : JSON.stringify(v);

function MigrationBody({ id, plan, oldS, oldM, newS, newM }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const [ok, setOk] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const rows = toConfirm(plan);
  const ready = rows.every((m) => ok.has(rowKey(m)));
  const none = t('form.migrate.noAnswer');
  const from = (m: Mapping) => labels(oldS, oldM, [m.from_path]);
  const to = (m: Mapping) => labels(newS, newM, [m.to_path]);
  const toggle = (k: string) =>
    setOk((s) => {
      const n = new Set(s);
      if (!n.delete(k)) n.add(k);
      return n;
    });
  const copies = plan.mapping.filter((m) => !m.needs_confirmation && m.transform === 'copy');
  const removes = rows.filter((m) => m.transform === 'drop');
  const moves = rows.filter((m) => m.transform !== 'drop');
  const unmapped = plan.dropped.filter((d) => !plan.mapping.some((m) => m.from_path === d));

  const go = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const d = await unwrap(
        api.POST('/v1/drafts/{id}/migration', {
          params: { path: { id } },
          body: {
            expectedVersion: draftVersion(id) ?? 0, // ponytail: the plan carries no version; see saveDraft gap
            mappings: rows
              .filter((m) => ok.has(rowKey(m)))
              .map((m) => ({ from_path: m.from_path, to_path: m.to_path })),
          },
        }),
      );
      rememberVersion(id, d.version);
      const local = await load();
      if (local) {
        const body = applyPlan(local.body as Value, plan, ok);
        void save({
          schemaId: plan.target.schema_id,
          schemaVersion: plan.target.schema_version,
          schemaHash: plan.target.schema_hash,
          body,
        });
        await flush();
      }
      await qc.invalidateQueries({ queryKey: ['draft-migration', id] });
      router.replace({ pathname: '/me/problems/[id]/facts', params: { id } });
    } catch (e) {
      setError(t(schemaErrorId(e) ?? 'common.error.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box className="gap-4" testID="migration-screen">
      <CivicHeading level={1}>{t('form.migrate.title')}</CivicHeading>
      <CivicText>{t('form.migrate.intro')}</CivicText>
      {copies.map((m) => (
        <CivicText key={rowKey(m)}>
          {t('form.migrate.carried', {
            from: from(m),
            to: to(m),
            value: show(m.carried_value, none),
          })}
        </CivicText>
      ))}
      {moves.map((m) => (
        <CheckboxField
          key={rowKey(m)}
          label={t('form.migrate.confirmRow', {
            from: from(m),
            to: to(m),
            value: show(m.carried_value, none),
          })}
          checked={ok.has(rowKey(m))}
          onToggle={() => toggle(rowKey(m))}
        />
      ))}
      {plan.new_required.length ? (
        <Box className="gap-1">
          <CivicHeading level={2}>{t('form.migrate.newTitle')}</CivicHeading>
          <CivicText>
            {t('form.migrate.newBody', { fields: labels(newS, newM, plan.new_required) })}
          </CivicText>
        </Box>
      ) : null}
      {removes.length || unmapped.length ? (
        <Box className="gap-1">
          <CivicHeading level={2}>{t('form.migrate.droppedTitle')}</CivicHeading>
          {unmapped.length ? (
            <CivicText>
              {t('form.migrate.droppedBody', { fields: labels(oldS, oldM, unmapped) })}
            </CivicText>
          ) : null}
          {removes.map((m) => (
            <CheckboxField
              key={rowKey(m)}
              label={t('form.migrate.removeRow', {
                from: from(m),
                value: show(m.carried_value, none),
              })}
              checked={ok.has(rowKey(m))}
              onToggle={() => toggle(rowKey(m))}
            />
          ))}
        </Box>
      ) : null}
      {error ? <FormError message={error} /> : null}
      {ready ? null : (
        <CivicText variant="caption" muted>
          {t('form.migrate.confirmFirst')}
        </CivicText>
      )}
      <CivicButton
        label={t('form.migrate.go')}
        accessibilityLabel={t('form.migrate.go')}
        disabled={!ready || busy}
        onPress={go}
      />
      <CivicButton
        variant="secondary"
        label={t('form.migrate.back')}
        accessibilityLabel={t('form.migrate.back')}
        onPress={() => router.replace({ pathname: '/me/problems/[id]/facts', params: { id } })}
      />
    </Box>
  );
}
