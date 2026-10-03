import { useEffect, useMemo, useRef, useState } from 'react';
import type { TextInput } from 'react-native';

import {
  Box,
  CivicButton,
  CivicHeading,
  CivicText,
  FormError,
  SubmitButton,
} from '../../components/civic';
import { useT } from '../../i18n';
import { FieldNode, type Ctx, type Hint } from './FieldNode';
import {
  UNKNOWN_KEY,
  msg,
  progress,
  sectionsOf,
  stripServerSet,
  setPath,
  unsupported,
  validate,
  withBooleanDefaults,
  type Errors,
  type Schema,
  type Value,
} from './model';

type Props = {
  schema: Schema;
  messages: Record<string, unknown>;
  value: Value;
  onChange: (v: Value) => void;
  /** field path (dotted) -> server hint. Empty until plan 10 hints land. */
  hints?: Record<string, Hint>;
  /** field paths shown with the "Assisted" marker. */
  assisted?: ReadonlySet<string>;
  /** Called with the answers (without the unknown map) and the unknown map. May throw ApiError-like fieldErrors. */
  onSubmit: (value: Value, unknown: Record<string, string>) => unknown;
  readOnly?: boolean;
  /** Resolved label of the final-section button. Defaults to "Submit". */
  submitLabel?: string;
  /** Turns the final button off (for example while a reply allowance is used up). Fields stay editable. */
  submitDisabled?: boolean;
  /** Server field errors keyed by dotted path (ApiError.fieldErrors). */
  fieldErrors?: Record<string, string>;
  formError?: string;
  busy?: boolean;
  slots?: Ctx['slots'];
  /** Options for stage_ref and criterion_ref pickers, by widget name. */
  choices?: Ctx['choices'];
  /** Told about unsupported widgets (dotted path and widget name) so the host can log them. */
  onUnsupported?: (u: { path: string; widget: string; required: boolean }[]) => void;
};

const NONE: Record<string, never> = {};
const NO_SET: ReadonlySet<string> = new Set();

/** One renderer for any content schema version. The form never names a field. */
export function SchemaForm(p: Props) {
  const t = useT();
  const { schema, messages, value, onChange } = p;
  const sections = useMemo(() => sectionsOf(schema, value), [schema, value]);
  const bad = useMemo(() => unsupported(schema), [schema]);
  const [index, setIndex] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const refs = useRef(new Map<string, TextInput | null>());
  const focusNext = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (bad.length) p.onUnsupported?.(bad);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bad]);
  // After each render: focus the field a failed submit asked for (its section is mounted by now).
  useEffect(() => {
    const f = focusNext.current;
    focusNext.current = undefined;
    if (f) refs.current.get(f)?.focus();
  });

  // Server errors can name a field in another section: open the first section that has one.
  const [seenErrors, setSeenErrors] = useState(p.fieldErrors);
  if (seenErrors !== p.fieldErrors) {
    setSeenErrors(p.fieldErrors);
    const first = Object.keys(p.fieldErrors ?? {})[0]?.split('.')[0];
    const at = sections.findIndex((s) => s.fields.some((f) => f.key === first));
    if (at >= 0) setIndex(at);
  }

  // Server errors arrive as plain text keyed by path; shown through the same inline slot.
  const shown: Errors = useMemo(() => {
    const out: Errors = { ...errors };
    for (const [k, m] of Object.entries(p.fieldErrors ?? {})) out[k] = { id: `server:${m}` };
    return out;
  }, [errors, p.fieldErrors]);

  const ctx: Ctx = {
    root: schema,
    messages,
    value,
    errors: shown,
    hints: p.hints ?? NONE,
    assisted: p.assisted ?? NO_SET,
    readOnly: !!p.readOnly,
    slots: p.slots ?? NONE,
    choices: p.choices ?? NONE,
    set: (path, v) => {
      onChange(setPath(value, path, v));
      if (errors[path]) setErrors(({ [path]: _gone, ...rest }) => rest);
    },
    setUnknown: (path, why) => {
      const cur = { ...((value[UNKNOWN_KEY] as Value | undefined) ?? {}) };
      if (why === undefined) delete cur[path];
      else cur[path] = why;
      onChange({ ...value, [UNKNOWN_KEY]: cur });
    },
    ref: (path) => (el) => void refs.current.set(path, el),
  };
  const unknownMap = value[UNKNOWN_KEY] as Value | undefined;
  const blocked = bad.some((u) => u.required);
  const sec = sections[Math.min(index, sections.length - 1)];
  const last = index >= sections.length - 1;
  const pr = progress(schema, value);

  const submit = () => {
    const errs = validate(schema, schema, value, unknownMap);
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) {
      const top = first.split('.')[0];
      const at = sections.findIndex((s) => s.fields.some((f) => f.key === top));
      if (at >= 0) setIndex(at);
      focusNext.current = first;
      return;
    }
    const { [UNKNOWN_KEY]: _u, ...answers } = withBooleanDefaults(
      schema,
      schema,
      stripServerSet(schema, schema, value),
    );
    return p.onSubmit(answers, (unknownMap ?? {}) as Record<string, string>);
  };

  if (!sec) return null;
  const sectionLabel = msg(messages, `schema.${schema.id}.group.${sec.id}`);
  // fieldErrors text: ids starting "server:" are literal text, the rest are message ids (resolved in FieldNode via t()).
  return (
    <Box className="gap-4" testID="schema-form">
      <Box className="gap-1">
        <CivicText variant="bodyStrong">
          {t('form.progress', {
            n: index + 1,
            total: sections.length,
            section: sec.id ? sectionLabel : '',
          })}
        </CivicText>
        <CivicText variant="caption">
          {t('form.progress.fields', { done: pr.done, required: pr.required })}
        </CivicText>
        {schema.version ? (
          <CivicText variant="caption" muted>
            {t('form.version', { version: schema.version })}
          </CivicText>
        ) : null}
      </Box>
      <CivicHeading level={2}>{sec.id ? sectionLabel : ''}</CivicHeading>
      {sec.fields.map((f) => (
        <FieldNode key={f.key} field={f} path={f.key} ctx={ctx} />
      ))}
      <FormError message={p.formError} />
      {blocked && last ? (
        <CivicText variant="caption">{t('form.field.unsupportedBlocks')}</CivicText>
      ) : null}
      <Box className="gap-2">
        {index > 0 ? (
          <CivicButton
            variant="secondary"
            label={t('common.back')}
            accessibilityLabel={t('common.back')}
            onPress={() => setIndex(index - 1)}
          />
        ) : null}
        {!last ? (
          <CivicButton
            label={t('common.next')}
            accessibilityLabel={t('common.next')}
            onPress={() => setIndex(index + 1)}
          />
        ) : p.readOnly ? null : (
          <SubmitButton
            label={p.submitLabel ?? t('form.submit')}
            busy={p.busy}
            disabled={blocked || p.submitDisabled}
            onPress={() => void submit()}
          />
        )}
      </Box>
    </Box>
  );
}
