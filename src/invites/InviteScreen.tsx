import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { api } from '../api/client';
import { ApiError } from '../api/errors';
import { unwrap } from '../api/unwrap';
import {
  Box,
  CivicButton,
  CivicHeading,
  CivicText,
  StatusMessage,
  TextField,
} from '../components/civic';
import { useT, type MessageId } from '../i18n';
import { useSession } from '../navigation/SessionContext';

const STEWARD_ROLES = ['moderator', 'admin', 'steward'];
const DEFAULT_DAYS = '14';
type Issued = { code: string; expiresAt: string };

function errorId(e: unknown): MessageId {
  const kind = e instanceof ApiError ? e.kind : 'server';
  return kind === 'offline'
    ? 'common.offline.banner'
    : kind === 'rate_limited'
      ? 'mod.invite.rateLimited'
      : kind === 'not_permitted'
        ? 'mod.invite.notPermitted'
        : 'common.error.generic';
}

/*
 +--------------------------------------+
 | Issue an invite                      |
 | Expires in (days, 1 to 30) [ 14 ]    |
 | [ Create code ]                      |
 | Code (shown once): ABCD-EFGH-...     |
 | Share it exactly as shown, dashes    |
 | and capitals included.  [ Done ]     |
 | Your invites                         |
 | Issued 3 Oct, expires 17 Oct  Unused |
 +--------------------------------------+ */
/** WF-MOD-INVITE-1. The code lives only in this component's state: never in the query cache, a mutation or storage. */
export function InviteScreen() {
  const t = useT();
  const qc = useQueryClient();
  const { roles } = useSession();
  const steward = !!roles?.some((r) => STEWARD_ROLES.includes(r));
  const [now] = useState(() => Date.now());
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<Issued>();
  const [issueErr, setIssueErr] = useState<unknown>();
  const list = useQuery({
    queryKey: ['invites'],
    enabled: steward,
    queryFn: () => unwrap(api.GET('/v1/invites')),
  });

  if (!steward) return <StatusMessage state="error" message={t('mod.invite.notPermitted')} />;

  const n = Number(days);
  const daysError =
    days.trim() === '' || !Number.isInteger(n) || n < 1 || n > 30
      ? t('mod.invite.daysInvalid')
      : undefined;

  const issue = async () => {
    if (daysError || busy) return;
    setBusy(true);
    setIssueErr(undefined);
    try {
      const r = await unwrap(api.POST('/v1/invites', { body: { expiresInDays: n } }));
      setIssued({ code: r.code, expiresAt: r.expiresAt });
      void qc.invalidateQueries({ queryKey: ['invites'] });
    } catch (e) {
      setIssueErr(e);
    } finally {
      setBusy(false);
    }
  };

  const rows = list.data;
  return (
    <Box className="gap-4" testID="invite-screen">
      <CivicHeading level={1}>{t('mod.invite.title')}</CivicHeading>
      {issued ? (
        <Box className="gap-2 rounded-md border border-can-border bg-can-surface p-4">
          <CivicText variant="label">{t('mod.invite.codeLabel')}</CivicText>
          <CivicText variant="bodyStrong" selectable testID="invite-code">
            {issued.code}
          </CivicText>
          <CivicText>
            {t('mod.invite.expires', { date: new Date(issued.expiresAt).getTime() })}
          </CivicText>
          <CivicText>{t('mod.invite.onceWarning')}</CivicText>
          <CivicText>{t('mod.invite.note')}</CivicText>
          <CivicText>{t('mod.invite.exact')}</CivicText>
          <CivicButton
            label={t('mod.invite.done')}
            accessibilityLabel={t('mod.invite.done')}
            onPress={() => setIssued(undefined)}
          />
        </Box>
      ) : (
        <Box className="gap-3">
          <TextField
            label={t('mod.invite.days')}
            hint={t('mod.invite.daysHint')}
            value={days}
            onChangeText={setDays}
            inputMode="numeric"
            error={days !== DEFAULT_DAYS ? daysError : undefined}
          />
          <CivicButton
            label={t('mod.invite.create')}
            accessibilityLabel={t('mod.invite.create')}
            onPress={() => void issue()}
            disabled={busy || !!daysError}
          />
          {issueErr ? <StatusMessage state="error" message={t(errorId(issueErr))} /> : null}
        </Box>
      )}
      <CivicHeading level={2}>{t('mod.invite.listTitle')}</CivicHeading>
      {list.error ? (
        <StatusMessage
          state="error"
          message={t(errorId(list.error))}
          action={{
            label: t('common.error.retry'),
            accessibilityLabel: t('common.error.retry'),
            onPress: () => void list.refetch(),
          }}
        />
      ) : !rows ? (
        <StatusMessage state="loading" message={t('common.loading')} />
      ) : rows.length === 0 ? (
        <StatusMessage state="empty" message={t('mod.invite.empty')} />
      ) : (
        rows.map((i) => (
          <Box key={i.id} className="gap-1 border-b border-can-border pb-2" testID="invite-row">
            <CivicText>
              {t('mod.invite.row', {
                issued: new Date(i.issuedAt).getTime(),
                expires: new Date(i.expiresAt).getTime(),
              })}
            </CivicText>
            <CivicText variant="caption" muted>
              {t(
                i.redeemed
                  ? 'mod.invite.used'
                  : new Date(i.expiresAt).getTime() < now
                    ? 'mod.invite.lapsed'
                    : 'mod.invite.waiting',
              )}
            </CivicText>
          </Box>
        ))
      )}
    </Box>
  );
}
