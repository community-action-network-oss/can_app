import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';

import { ApiError } from '../../api/errors';
import { Box, CivicButton, CivicHeading, CivicText, StatusMessage } from '../../components/civic';
import { load } from '../../drafts/draftStore';
import { SavedIndicator } from '../../drafts/SavedIndicator';
import { useDraft } from '../../drafts/useDraft';
import { SchemaForm } from '../../forms/schema/SchemaForm';
import { UNKNOWN_KEY, type Schema, type Value } from '../../forms/schema/model';
import { useContentSchema } from '../../forms/schema/useContentSchema';
import { useT } from '../../i18n';
import { ContextProfileRows } from './ContextProfileRows';
import { mapFieldErrors, withoutFields } from './schemaParts';
import { schemaErrorId } from './schemaErrors';
import { saveDraft } from './saveDraft';

export type LinkedPart = { key: string; label: string; href: string };
type Dto = NonNullable<ReturnType<typeof useContentSchema>['data']>;

type Props = {
  id: string;
  /** Top-level fields edited on their own screens: shown as read-only links, never as inputs. */
  linked: LinkedPart[];
  /** Top-level fields of the context confirmation section (rendered by ContextProfileRows). */
  context: string[];
};

/** WF-PREP-1 facts section. Pins the draft's schema version; a version no longer served keeps the draft read-only. */
export function FactsSection({ id, linked, context }: Props) {
  const t = useT();
  const local = useQuery({ queryKey: ['local-draft'], queryFn: load, staleTime: 0 });
  const pinned = local.data ? String(local.data.schemaVersion) : undefined;
  const ready = !local.isPending;
  const pinnedQ = useContentSchema('problem', { version: pinned, enabled: ready });
  const gone = pinnedQ.error instanceof ApiError && pinnedQ.error.status === 404 && !!pinned;
  const activeQ = useContentSchema('problem', { enabled: gone });
  const q = gone ? activeQ : pinnedQ;

  if (!q.data) {
    if (q.error && !(q.error instanceof ApiError && q.error.kind === 'offline'))
      return <StatusMessage state="error" message={t('detail.error')} />;
    if (q.error) return <StatusMessage state="error" message={t('common.offline.banner')} />;
    return <StatusMessage state="loading" message={t('common.loading')} />;
  }
  return <Body id={id} dto={q.data} retired={gone} linked={linked} context={context} />;
}

function Body({ id, dto, retired, linked, context }: Props & { dto: Dto; retired: boolean }) {
  const t = useT();
  const stamps = {
    schemaId: dto.schema_id,
    schemaVersion: dto.schema_version,
    schemaHash: dto.schema_hash,
  };
  const d = useDraft(stamps);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiError | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const changed =
    !!d.draft &&
    (String(d.draft.schemaVersion) !== dto.schema_version ||
      d.draft.schemaHash !== dto.schema_hash);
  const readOnly = retired || changed;
  const schema = withoutFields(dto.schema as Schema, [...linked.map((l) => l.key), ...context]);
  const value: Value = { ...(d.draft?.body ?? {}), [UNKNOWN_KEY]: d.draft?.unknown ?? {} };

  const onChange = (v: Value) => {
    const { [UNKNOWN_KEY]: unk, ...body } = v;
    d.save({ body, unknown: (unk ?? {}) as Record<string, unknown> });
  };
  const onSubmit = async (answers: Value, unknown: Record<string, string>) => {
    setBusy(true);
    setErr(undefined);
    setFormError(undefined);
    try {
      const content = {
        ...answers,
        ...(Object.keys(unknown).length ? { [UNKNOWN_KEY]: unknown } : {}),
      };
      const sid = await saveDraft(id, content, {
        schemaVersion: dto.schema_version,
        schemaHash: dto.schema_hash,
      });
      router.push({ pathname: '/me/problems/[id]/preview', params: { id: sid } });
    } catch (e) {
      if (e instanceof ApiError) setErr(e);
      setFormError(schemaErrorId(e) ? t(schemaErrorId(e)!) : t('common.error.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box className="gap-4" testID="facts-section">
      <CivicHeading level={1}>{t('prep.part.facts')}</CivicHeading>
      <CivicText variant="caption" muted>
        {t('prep.private')}
      </CivicText>
      {readOnly ? (
        <CivicText variant="bodyStrong" testID="version-note">
          {t(retired ? 'form.version.retired' : 'form.version.newer')}
        </CivicText>
      ) : null}
      <SchemaForm
        schema={schema}
        messages={dto.messages}
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        readOnly={readOnly}
        busy={busy}
        formError={formError}
        fieldErrors={mapFieldErrors(err?.status === 400 ? err.fieldErrors : undefined)}
      />
      <SavedIndicator
        status={d.status}
        savedAt={d.savedAt}
        labels={{
          saved: (time) => t('form.savedLocal.at', { time }),
          failed: t('form.savedLocal.failed'),
        }}
      />
      <ContextProfileRows />
      <Box className="gap-2" testID="linked-parts">
        {linked.map((l) => (
          <CivicButton
            key={l.key}
            variant="secondary"
            label={l.label}
            accessibilityLabel={l.label}
            onPress={() => router.push(l.href as never)}
          />
        ))}
      </Box>
    </Box>
  );
}
