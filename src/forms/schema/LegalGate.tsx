import type { components } from '../../api/schema';
import { Box, CivicText } from '../../components/civic';
import { useT, type MessageId } from '../../i18n';

type Finding = components['schemas']['LegalFindingDto'];
const KNOWN = ['constrains', 'permits', 'none_found', 'conflict', 'not_applicable', 'unjudged'];

/** Legal findings per layer, read only: a plain label, corpus version and article ids (LEGAL-CITE-1), never article text. */
export function LegalFindings({ findings }: { findings: Finding[] }) {
  const t = useT();
  return (
    <>
      {findings.map((f) => (
        <Box key={f.layer} className="gap-1" testID={`gate-${f.layer}`}>
          <CivicText variant="bodyStrong">{t(`choice.layer.${f.layer}` as MessageId)}</CivicText>
          <CivicText>
            {t(
              KNOWN.includes(f.finding)
                ? (`choice.finding.${f.finding}` as MessageId)
                : 'choice.finding.unknown',
            )}
            {f.blocks ? ` (${t('choice.gate.blocksThis')})` : ''}
          </CivicText>
          {f.article_ids?.length ? (
            <CivicText variant="caption" muted>
              {t('choice.gate.articles', { ids: f.article_ids.join(', ') })}
            </CivicText>
          ) : null}
          {f.corpus_version ? (
            <CivicText variant="caption" muted>
              {t('choice.gate.corpus', { version: f.corpus_version })}
            </CivicText>
          ) : null}
        </Box>
      ))}
    </>
  );
}

/** The legal_gate widget: display only. Reads `findings` when the host passes them; never shows free text. */
export function LegalGateView({ label, value }: { label: string; value: unknown }) {
  const t = useT();
  const findings = (value as { findings?: Finding[] } | null)?.findings;
  return (
    <Box className="gap-2" testID="legal-gate-view">
      <CivicText variant="bodyStrong">{label || t('choice.gate.title')}</CivicText>
      {Array.isArray(findings) ? <LegalFindings findings={findings} /> : null}
    </Box>
  );
}
