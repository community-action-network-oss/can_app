import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';

import {
  CivicButton,
  CivicHeading,
  CivicText,
  Row,
  Screen,
  StatusMessage,
} from '../components/civic';
import { useT } from '../i18n';
import type { Profile } from './model';
import { saveStep } from './store';
import { useSavedProfile } from './useProfile';

export const STEPS = ['know', 'give', 'places', 'about'] as const;
type StepName = (typeof STEPS)[number];

/**
 * One registration step. Nothing is written until the person presses Next (propose, then save).
 * Skip writes nothing. When opened from the review screen (?edit=1) both buttons return there.
 */
export function Step({
  name,
  title,
  keys,
  children,
}: {
  name: StepName;
  title: string;
  /** The profile fields this step proposes; only these are saved, and only on Next. */
  keys: (keyof Profile)[];
  children: (draft: Profile, set: (part: Partial<Profile>) => void) => ReactNode;
}) {
  const t = useT();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const { profile, ready } = useSavedProfile();
  const [failed, setFailed] = useState(false);
  const [edits, setEdits] = useState<Partial<Profile>>({});
  const draft = { ...profile, ...edits };
  const set = (part: Partial<Profile>) => setEdits((e) => ({ ...e, ...part }));
  const i = STEPS.indexOf(name);
  const go = () =>
    router.push(
      edit ? '/profile' : i === STEPS.length - 1 ? '/profile' : `/profile/${STEPS[i + 1]}`,
    );
  const next = async () => {
    try {
      await saveStep(Object.fromEntries(keys.map((k) => [k, draft[k]])));
      go();
    } catch {
      setFailed(true);
    }
  };
  return (
    <Screen>
      <CivicText variant="caption" muted>
        {t('profile.step', { n: i + 1, total: STEPS.length })}
      </CivicText>
      <CivicHeading level={1}>{title}</CivicHeading>
      {ready ? children(draft, set) : null}
      <CivicText variant="caption" muted>
        {t('profile.later')}
      </CivicText>
      {failed ? <StatusMessage state="error" message={t('profile.review.saveError')} /> : null}
      <Row>
        <CivicButton
          label={t('common.next')}
          accessibilityLabel={t('common.next')}
          onPress={() => void next()}
        />
        <CivicButton
          variant="secondary"
          label={t('profile.skipStep')}
          accessibilityLabel={t('profile.skipStep')}
          onPress={go}
        />
      </Row>
    </Screen>
  );
}
