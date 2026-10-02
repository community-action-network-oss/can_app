import { Chip, CivicText, Row } from '../../src/components/civic';
import { useT } from '../../src/i18n';
import { KNOW } from '../../src/profile/model';
import { Step } from '../../src/profile/Step';
import { toggle } from '../../src/profile/useProfile';

export default function Know() {
  const t = useT();
  return (
    <Step name="know" title={t('profile.know.title')} keys={['know']}>
      {(d, set) => (
        <>
          <CivicText>{t('profile.know.body')}</CivicText>
          <Row>
            {KNOW.map((k) => (
              <Chip
                key={k}
                label={t(`profile.know.${k}`)}
                selected={d.know.includes(k)}
                onToggle={() => set({ know: toggle(d.know, k) })}
              />
            ))}
          </Row>
          {d.know.length === 0 ? <CivicText muted>{t('profile.noneChosen')}</CivicText> : null}
        </>
      )}
    </Step>
  );
}
