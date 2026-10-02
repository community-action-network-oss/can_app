import { Chip, CivicHeading, Row } from '../../src/components/civic';
import { useT } from '../../src/i18n';
import { KINDS, TIME } from '../../src/profile/model';
import { Step } from '../../src/profile/Step';
import { toggle } from '../../src/profile/useProfile';

export default function Give() {
  const t = useT();
  return (
    <Step name="give" title={t('profile.give.title')} keys={['time', 'kinds']}>
      {(d, set) => (
        <>
          <CivicHeading level={2}>{t('profile.give.time')}</CivicHeading>
          <Row>
            {TIME.map((k) => (
              <Chip
                key={k}
                label={t(`profile.give.time.${k}`)}
                selected={d.time === k}
                onToggle={() => set({ time: d.time === k ? null : k })}
              />
            ))}
          </Row>
          <CivicHeading level={2}>{t('profile.give.kinds')}</CivicHeading>
          <Row>
            {KINDS.map((k) => (
              <Chip
                key={k}
                label={t(`profile.give.${k}`)}
                selected={d.kinds.includes(k)}
                onToggle={() => set({ kinds: toggle(d.kinds, k) })}
              />
            ))}
          </Row>
        </>
      )}
    </Step>
  );
}
