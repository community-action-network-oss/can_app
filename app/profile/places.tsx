import { useState } from 'react';

import { Chip, CivicButton, CivicText, Row, TextField } from '../../src/components/civic';
import { useT } from '../../src/i18n';
import { Step } from '../../src/profile/Step';

// ponytail: the on-phone location check (ADR 0016, WF-PROFILE-4) needs a location module that is not installed.
// Until it lands, a place is chosen by name only: allowed for matching, never an impact label.
export default function Places() {
  const t = useT();
  const [text, setText] = useState('');
  return (
    <Step name="places" title={t('profile.places.title')} keys={['places']}>
      {(d, set) => {
        const add = () => {
          const v = text.trim().slice(0, 40);
          if (v && !d.places.includes(v)) set({ places: [...d.places, v] });
          setText('');
        };
        return (
          <>
            <CivicText>{t('profile.places.body')}</CivicText>
            <TextField
              value={text}
              onChangeText={setText}
              maxLength={40}
              accessibilityLabel={t('profile.places.search')}
              placeholder={t('profile.places.search')}
            />
            <CivicButton
              variant="secondary"
              label={t('profile.places.add')}
              accessibilityLabel={t('profile.places.add')}
              onPress={add}
            />
            <Row>
              {d.places.map((p) => (
                <Chip
                  key={p}
                  label={p}
                  selected
                  onToggle={() => set({ places: d.places.filter((x) => x !== p) })}
                />
              ))}
            </Row>
            {d.places.length === 0 ? <CivicText muted>{t('profile.noneChosen')}</CivicText> : null}
            <CivicText variant="caption" muted>
              {t('profile.places.privacy')}
            </CivicText>
          </>
        );
      }}
    </Step>
  );
}
