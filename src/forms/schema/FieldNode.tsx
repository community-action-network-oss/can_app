import { useEffect, type ReactNode } from 'react';
import type { TextInput } from 'react-native';

import {
  Box,
  CheckboxField,
  ChoiceField,
  CivicButton,
  CivicHeading,
  CivicText,
  FormField,
  TextField,
} from '../../components/civic';
import { useT } from '../../i18n';
import {
  GROUPS,
  KNOWN,
  STRING_LISTS,
  SLOTS,
  UNKNOWN_KEY,
  fieldsOf,
  getPath,
  msg,
  resolve,
  widgetOf,
  type Errors,
  type Field,
  type Node,
  type Schema,
  type Value,
} from './model';

export type Hint = { text: string; rule_id: string; policy_version: string };
export type Ctx = {
  root: Schema;
  messages: Record<string, unknown>;
  value: Value;
  set: (path: string, v: unknown) => void;
  /** Set or clear (undefined) the "I do not know this yet" answer for a path. */
  setUnknown: (path: string, why: string | undefined) => void;
  errors: Errors;
  hints: Record<string, Hint>;
  assisted: ReadonlySet<string>;
  readOnly: boolean;
  /** Mount points for custom editors (stage_plan, area_picker), keyed by widget name. */
  slots: Record<
    string,
    (p: { path: string; value: unknown; onChange: (v: unknown) => void }) => ReactNode
  >;
  ref: (path: string) => (el: TextInput | null) => void;
  /** Picker options per widget name (stage_ref, criterion_ref), from the host. `preset` fills an empty field once. */
  choices: Record<string, { options: { value: string; label: string }[]; preset?: string }>;
};

/** A pick over host supplied options; without any the field falls back to plain text. */
function PickField({
  widget,
  label,
  help,
  error,
  required,
  path,
  value,
  ctx,
  numeric,
}: {
  widget: string;
  label: string;
  help?: string;
  error?: string;
  required: boolean;
  path: string;
  value: unknown;
  ctx: Ctx;
  numeric: boolean;
}) {
  const c = ctx.choices[widget];
  const preset = c?.preset;
  useEffect(() => {
    if (preset !== undefined && value === undefined && !ctx.readOnly)
      ctx.set(path, numeric ? Number(preset) : preset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, value]);
  const shown = value == null ? undefined : String(value);
  if (ctx.readOnly)
    return (
      <FormField label={label} hint={help}>
        <CivicText>{c?.options.find((o) => o.value === shown)?.label ?? shown ?? ''}</CivicText>
      </FormField>
    );
  if (!c?.options.length)
    return (
      <TextField
        ref={ctx.ref(path)}
        label={label}
        accessibilityLabel={label}
        hint={help}
        error={error}
        required={required}
        value={shown ?? ''}
        inputMode={numeric ? 'numeric' : undefined}
        onChangeText={(x) =>
          ctx.set(
            path,
            numeric ? (x.replace(/\D/g, '') === '' ? undefined : Number(x.replace(/\D/g, ''))) : x,
          )
        }
      />
    );
  return (
    <ChoiceField
      label={label}
      hint={help}
      options={c.options}
      value={shown}
      onChange={(x) => ctx.set(path, numeric ? Number(x) : x)}
      error={error}
      required={required}
    />
  );
}

/** Renders one schema node at a dotted path. A registry in spirit: widget name decides the control, the node supplies everything else. */
export function FieldNode({
  field,
  path,
  ctx,
  label: labelOverride,
}: {
  field: Field;
  path: string;
  ctx: Ctx;
  label?: string;
}) {
  const t = useT();
  const { node, widget, required } = field;
  const ui = node['x-ui'];
  const label = labelOverride ?? (msg(ctx.messages, ui?.label_msg) || field.key);
  const help = ui?.help_msg ? msg(ctx.messages, ui.help_msg) : undefined;
  const g = node['x-guidance'];
  const err = ctx.errors[path];
  const error = !err
    ? undefined
    : err.id.startsWith('server:')
      ? err.id.slice(7)
      : t(err.id as never, err.values);
  const v = getPath(ctx.value, path);
  const unknownMap = ctx.value[UNKNOWN_KEY] as Value | undefined;
  const isUnknown = unknownMap?.[path] !== undefined;
  const allowUnknown = !!node['x-checks']?.allow_unknown && !node.enum?.includes('unknown');

  if (widget === 'hidden') return null;

  if (!KNOWN.has(widget)) {
    return (
      <Box className="gap-1" testID={`unsupported-${path}`}>
        <CivicText variant="label">{label}</CivicText>
        <CivicText variant="caption">{t('form.field.unsupported')}</CivicText>
        {required ? (
          <CivicText variant="caption">{t('form.field.unsupportedBlocks')}</CivicText>
        ) : null}
      </Box>
    );
  }

  const extras = (
    <>
      {g?.why ? (
        <CivicText variant="caption" muted>
          {t('form.field.why', { text: g.why })}
        </CivicText>
      ) : null}
      {g?.good ? (
        <CivicText variant="caption" muted>
          {t('form.field.exampleLabel', { text: g.good })}
        </CivicText>
      ) : null}
      {ctx.assisted.has(path) ? (
        <CivicText variant="caption" testID="assisted-marker">
          {'✎ '}
          {t('form.assist.marker')}
        </CivicText>
      ) : null}
      {ctx.hints[path] ? (
        <Box testID="field-hint">
          <CivicText variant="caption">{ctx.hints[path].text}</CivicText>
          <CivicText variant="caption" muted>
            {t('form.hint.rule', {
              ruleId: ctx.hints[path].rule_id,
              version: ctx.hints[path].policy_version,
            })}
          </CivicText>
        </Box>
      ) : null}
    </>
  );

  let control: ReactNode;
  if (GROUPS.has(widget)) {
    control = (
      <Box className="gap-4" accessibilityLabel={label}>
        <CivicHeading level={3}>{label}</CivicHeading>
        {help ? (
          <CivicText variant="caption" muted>
            {help}
          </CivicText>
        ) : null}
        {extras}
        {fieldsOf(ctx.root, node).map((f) => (
          <FieldNode key={f.key} field={f} path={`${path}.${f.key}`} ctx={ctx} />
        ))}
      </Box>
    );
    return control;
  }

  if (widget === 'list' || STRING_LISTS.has(widget)) {
    const stringList = STRING_LISTS.has(widget);
    const items = Array.isArray(v) ? (v as unknown[]) : [];
    const itemNode = node.items ? resolve(ctx.root, node.items) : ({} as Node);
    const max = node.maxItems as number | undefined;
    control = (
      <FormField label={label} hint={help} error={error} required={required}>
        {extras}
        {items.map((_, i) => (
          <Box key={i} className="gap-2 border-2 border-can-control-border p-2">
            {widgetOf(itemNode) === 'group' || stringList ? null : (
              <CivicText variant="bodyStrong">{t('form.list.item', { n: i + 1 })}</CivicText>
            )}
            <FieldNode
              field={{ key: String(i), node: itemNode, required: true, widget: widgetOf(itemNode) }}
              path={`${path}.${i}`}
              ctx={ctx}
              label={
                widgetOf(itemNode) === 'group'
                  ? t('form.list.item', { n: i + 1 })
                  : stringList
                    ? `${label}: ${t('form.list.item', { n: i + 1 })}`
                    : label
              }
            />
            {ctx.readOnly ? null : (
              <CivicButton
                variant="secondary"
                label={t('form.list.remove', { n: i + 1 })}
                accessibilityLabel={t('form.list.remove', { n: i + 1 })}
                onPress={() =>
                  ctx.set(
                    path,
                    items.filter((__, j) => j !== i),
                  )
                }
              />
            )}
          </Box>
        ))}
        {ctx.readOnly || (max && items.length >= max) ? null : (
          <CivicButton
            variant="secondary"
            label={t('form.list.add')}
            accessibilityLabel={`${t('form.list.add')}: ${label}`}
            onPress={() => ctx.set(path, [...items, blank(ctx.root, itemNode)])}
          />
        )}
      </FormField>
    );
    return control;
  }

  if (SLOTS.has(widget)) {
    const slot = ctx.slots[widget];
    return (
      <FormField label={label} hint={help} error={error} required={required}>
        {extras}
        {slot ? (
          slot({ path, value: v, onChange: (x) => ctx.set(path, x) })
        ) : (
          <CivicText variant="caption" testID={`slot-${widget}`}>
            {t('form.field.slot')}
          </CivicText>
        )}
      </FormField>
    );
  }

  if (
    widget === 'stage_ref' ||
    widget === 'criterion_ref' ||
    (widget === 'ref' && ctx.choices.ref)
  ) {
    return (
      <Box className="gap-1">
        <PickField
          widget={widget}
          label={label}
          help={help}
          error={error}
          required={required}
          path={path}
          value={v}
          ctx={ctx}
          numeric={widget === 'criterion_ref'}
        />
        {extras}
      </Box>
    );
  }

  if (widget === 'readonly') {
    return (
      <FormField label={label} hint={help}>
        <CivicText testID={`readonly-${path}`}>
          {v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v)}
        </CivicText>
      </FormField>
    );
  }

  if (widget === 'toggle' || widget === 'checkbox') {
    control = (
      <CheckboxField
        label={label}
        checked={v === true}
        onToggle={() => !ctx.readOnly && ctx.set(path, v !== true)}
        error={error}
      />
    );
    return (
      <Box className="gap-1">
        {control}
        {help ? (
          <CivicText variant="caption" muted>
            {help}
          </CivicText>
        ) : null}
        {extras}
      </Box>
    );
  }

  if (widget === 'select' || node.enum) {
    const opts = (node.enum ?? []).map((o) => ({
      value: String(o),
      label: String(o).replace(/_/g, ' '),
    }));
    return (
      <Box className="gap-1">
        <ChoiceField
          label={label}
          hint={help}
          options={opts}
          value={v as string | undefined}
          onChange={(x) => !ctx.readOnly && ctx.set(path, x)}
          error={error}
          required={required}
        />
        {extras}
      </Box>
    );
  }

  // text-like (also the safe rendering for any known widget without a special control)
  const text = typeof v === 'string' ? v : '';
  const readText = widget === 'number' && v != null ? String(v) : text;
  const max = g?.max_chars ?? node.maxLength;
  control = ctx.readOnly ? (
    <FormField label={label} hint={help}>
      <CivicText>{readText}</CivicText>
    </FormField>
  ) : isUnknown ? null : (
    <TextField
      ref={ctx.ref(path)}
      label={label}
      accessibilityLabel={label}
      hint={help}
      error={error}
      required={required}
      value={widget === 'number' ? (v == null ? '' : String(v)) : text}
      onChangeText={(x) =>
        // ponytail: whole numbers only (digits kept); add decimals when a schema needs them.
        ctx.set(
          path,
          widget === 'number' ? (/\d/.test(x) ? Number(x.replace(/\D/g, '')) : undefined) : x,
        )
      }
      multiline={widget === 'textarea'}
      maxLength={
        widget === 'textarea' || widget === 'text' ? (max as number | undefined) : undefined
      }
      inputMode={
        widget === 'url' || widget === 'evidence_url'
          ? 'url'
          : widget === 'number'
            ? 'numeric'
            : undefined
      }
    />
  );
  return (
    <Box className="gap-1">
      {isUnknown ? (
        <FormField label={label} hint={help} required={required}>
          <CivicText variant="bodyStrong">{t('form.field.unknown')}</CivicText>
        </FormField>
      ) : (
        control
      )}
      {extras}
      {allowUnknown && !ctx.readOnly ? (
        <>
          <CheckboxField
            label={t('form.field.unknown')}
            checked={isUnknown}
            onToggle={() => ctx.setUnknown(path, isUnknown ? undefined : '')}
          />
          {isUnknown ? (
            <TextField
              ref={ctx.ref(path)}
              label={t('form.field.unknownWhy')}
              accessibilityLabel={`${t('form.field.unknownWhy')}: ${label}`}
              required
              error={error}
              value={String(unknownMap?.[path] ?? '')}
              onChangeText={(x) => ctx.setUnknown(path, x)}
            />
          ) : null}
        </>
      ) : null}
    </Box>
  );
}

/** An empty value for a new list item. */
function blank(root: Schema, n: Node): unknown {
  const w = widgetOf(n);
  if (w === 'group' || (n.properties && !n['x-ui']?.widget)) {
    return Object.fromEntries(
      fieldsOf(root, n)
        .filter((f) => f.node.const !== undefined)
        .map((f) => [f.key, f.node.const]),
    );
  }
  if (w === 'list') return [];
  if (w === 'toggle' || w === 'checkbox') return false;
  return '';
}
