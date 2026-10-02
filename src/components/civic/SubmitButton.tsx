import { useT } from '../../i18n';
import { CivicButton } from './CivicButton';

type Props = { label: string; onPress: () => void; busy?: boolean; disabled?: boolean };

/** While busy the label itself changes to text ("Sending"), so the state is never colour or spinner only. */
export function SubmitButton({ label, onPress, busy, disabled }: Props) {
  const t = useT();
  const text = busy ? t('common.submitting') : label;
  return (
    <CivicButton
      label={text}
      accessibilityLabel={text}
      aria-busy={!!busy}
      disabled={busy || disabled}
      onPress={onPress}
    />
  );
}
