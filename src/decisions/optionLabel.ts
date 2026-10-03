import type { components } from '../api/schema';

/** A short name for an option: its first piece of plain text, else "Option n". The schema decides the fields, so none is named. */
export function optionLabel(
  o: components['schemas']['StageOptionDto'],
  n: number,
  t: (id: 'option.n', v: { n: number }) => string,
): string {
  const text = Object.values(o.content).find((v) => typeof v === 'string' && v.trim()) as
    string | undefined;
  const name = t('option.n', { n });
  return text ? `${name}: ${text.length > 60 ? `${text.slice(0, 57)}...` : text}` : name;
}
