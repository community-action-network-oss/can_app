import { router } from 'expo-router';
import { useState } from 'react';
import { Platform } from 'react-native';

import {
  CivicButton,
  CivicHeading,
  CivicText,
  Row,
  Screen,
  StatusMessage,
  TextField,
} from '../../src/components/civic';
import { useT, type MessageId } from '../../src/i18n';
import { fromFile, isEmpty, toFile, type Profile } from '../../src/profile/model';
import { exportText, pickTextFile } from '../../src/profile/share';
import { deleteProfile, saveProfile } from '../../src/profile/store';
import { useSavedProfile } from '../../src/profile/useProfile';

type Notice = 'deleted' | 'imported' | 'importBad' | 'saveError' | null;

export default function Review() {
  const t = useT();
  const { profile, ready, reload } = useSavedProfile();
  const [confirming, setConfirming] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [paste, setPaste] = useState('');
  const [notice, setNotice] = useState<Notice>(null);

  const rows: { id: string; step: string; value: string[] }[] = [
    { id: 'know', step: 'know', value: profile.know.map((k) => t(`profile.know.${k}`)) },
    {
      id: 'give',
      step: 'give',
      value: [
        ...(profile.time ? [t(`profile.give.time.${profile.time}`)] : []),
        ...profile.kinds.map((k) => t(`profile.give.${k}`)),
      ],
    },
    { id: 'places', step: 'places', value: profile.places },
    { id: 'languages', step: 'about', value: profile.languages.map((k) => t(`profile.lang.${k}`)) },
    { id: 'affects', step: 'about', value: profile.affects.map((k) => t(`profile.topic.${k}`)) },
    { id: 'causes', step: 'about', value: profile.causes.map((k) => t(`profile.topic.${k}`)) },
  ];

  const load = async (text: string | null) => {
    if (text === null) return;
    const p: Profile | null = fromFile(text);
    if (!p) return setNotice('importBad');
    try {
      await saveProfile(p);
      await reload();
      setPasting(false);
      setPaste('');
      setNotice('imported');
    } catch {
      setNotice('saveError');
    }
  };

  const wipe = async () => {
    await deleteProfile();
    await reload();
    setConfirming(false);
    setNotice('deleted');
  };

  return (
    <Screen>
      <CivicHeading level={1}>{t('profile.review.title')}</CivicHeading>
      <CivicText>{t('profile.review.body')}</CivicText>
      {ready && isEmpty(profile) ? <CivicText muted>{t('profile.review.empty')}</CivicText> : null}
      {rows.map((r) => (
        <Row key={r.id}>
          <CivicText variant="bodyStrong">{t(`profile.review.row.${r.id}` as MessageId)}</CivicText>
          <CivicText>{r.value.length ? r.value.join(', ') : t('profile.review.none')}</CivicText>
          <CivicButton
            variant="secondary"
            label={t('profile.review.edit')}
            accessibilityLabel={`${t('profile.review.edit')}: ${t(`profile.review.row.${r.id}` as MessageId)}`}
            onPress={() => router.push(`/profile/${r.step}?edit=1` as never)}
          />
        </Row>
      ))}

      <CivicButton
        label={t('profile.review.export')}
        accessibilityLabel={t('profile.review.export')}
        disabled={!ready || isEmpty(profile)}
        onPress={() => void exportText(toFile(profile))}
      />
      <CivicText variant="caption" muted>
        {t('profile.review.exportNote')}
      </CivicText>
      <CivicButton
        variant="secondary"
        label={t('profile.review.import')}
        accessibilityLabel={t('profile.review.import')}
        onPress={() => (Platform.OS === 'web' ? void pickTextFile().then(load) : setPasting(true))}
      />
      {pasting ? (
        <>
          <CivicText>{t('profile.review.importPaste')}</CivicText>
          <TextField
            multiline
            value={paste}
            onChangeText={setPaste}
            accessibilityLabel={t('profile.review.importPaste')}
          />
          <CivicButton
            label={t('profile.review.import')}
            accessibilityLabel={t('profile.review.import')}
            onPress={() => void load(paste)}
          />
        </>
      ) : null}

      {confirming ? (
        <>
          <StatusMessage state="error" message={t('profile.review.delete.confirm')} />
          <Row>
            <CivicButton
              label={t('profile.review.delete.yes')}
              accessibilityLabel={t('profile.review.delete.yes')}
              onPress={() => void wipe()}
            />
            <CivicButton
              variant="secondary"
              label={t('profile.review.delete.no')}
              accessibilityLabel={t('profile.review.delete.no')}
              onPress={() => setConfirming(false)}
            />
          </Row>
        </>
      ) : (
        <CivicButton
          variant="secondary"
          label={t('profile.review.delete')}
          accessibilityLabel={t('profile.review.delete')}
          onPress={() => setConfirming(true)}
        />
      )}
      <CivicText variant="caption" muted>
        {t('profile.review.lost')}
      </CivicText>

      {notice ? (
        <StatusMessage
          state={notice === 'importBad' || notice === 'saveError' ? 'error' : 'success'}
          message={t(`profile.review.${notice}`)}
        />
      ) : null}
      <CivicButton
        label={t('profile.review.done')}
        accessibilityLabel={t('profile.review.done')}
        onPress={() => router.replace('/')}
      />
    </Screen>
  );
}
