import { Chip, CivicHeading, CivicText, Row } from '../../src/components/civic';
import { useT } from '../../src/i18n';
import { LANGS, TOPICS } from '../../src/profile/model';
import { Step } from '../../src/profile/Step';
import { toggle } from '../../src/profile/useProfile';

export default function About() {
  const t = useT();
  return (
    <Step name="about" title={t('profile.about.title')} keys={['languages', 'affects', 'causes']}>
      {(d, set) => (
        <>
          <CivicHeading level={2}>{t('profile.about.languages')}</CivicHeading>
          <Row>
            {LANGS.map((k) => (
              <Chip
                key={k}
                label={t(`profile.lang.${k}`)}
                selected={d.languages.includes(k)}
                onToggle={() => set({ languages: toggle(d.languages, k) })}
              />
            ))}
          </Row>
          <CivicHeading level={2}>{t('profile.about.affects')}</CivicHeading>
          <Row>
            {TOPICS.map((k) => (
              <Chip
                key={k}
                label={t(`profile.topic.${k}`)}
                selected={d.affects.includes(k)}
                onToggle={() => set({ affects: toggle(d.affects, k) })}
              />
            ))}
          </Row>
          <CivicHeading level={2}>{t('profile.about.causes')}</CivicHeading>
          <Row>
            {TOPICS.map((k) => (
              <Chip
                key={k}
                label={t(`profile.topic.${k}`)}
                selected={d.causes.includes(k)}
                onToggle={() => set({ causes: toggle(d.causes, k) })}
              />
            ))}
          </Row>
          <CivicText variant="caption" muted>
            {t('profile.about.topics')}
          </CivicText>
        </>
      )}
    </Step>
  );
}
