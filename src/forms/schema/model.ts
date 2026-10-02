// Pure helpers over a content schema. Nothing here names a content field: all structure comes from the schema.
export type Node = {
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  properties?: Record<string, Node>;
  required?: string[];
  items?: Node;
  $ref?: string;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  pattern?: string;
  'x-ui'?: {
    widget?: string;
    label_msg?: string;
    help_msg?: string;
    order?: number;
    group?: string;
  };
  'x-guidance'?: {
    why?: string;
    good?: string;
    min_chars?: number;
    max_chars?: number;
    [k: string]: unknown;
  };
  'x-checks'?: { allow_unknown?: boolean; [k: string]: unknown };
  [k: string]: unknown;
};
export type Schema = Node & { id?: string; version?: string; $defs?: Record<string, Node> };
export type Value = Record<string, unknown>;
export type Errors = Record<string, { id: string; values?: Record<string, number> }>;
/** Reserved value key: dotted path -> "what would help find out" for fields answered "I do not know this yet". */
export const UNKNOWN_KEY = '$unknown';

export const resolve = (root: Schema, n: Node): Node => {
  if (!n.$ref) return n;
  const ref = root.$defs?.[n.$ref.replace('#/$defs/', '')];
  return ref ? { ...ref, ...n, $ref: undefined } : n;
};

export const KNOWN = new Set([
  'text',
  'textarea',
  'url',
  'date',
  'ref',
  'taxonomy_pick',
  'select',
  'toggle',
  'checkbox',
  'list',
  'group',
  'readonly',
  'hidden',
  'stage_plan',
  'area_picker',
]);
export const SLOTS = new Set(['stage_plan', 'area_picker']);

export function widgetOf(n: Node): string {
  const w = n['x-ui']?.widget;
  if (w) return w;
  if (n.enum) return 'select';
  const t = Array.isArray(n.type) ? n.type[0] : n.type;
  if (t === 'array') return 'list';
  if (t === 'object') return 'group';
  if (t === 'boolean') return 'toggle';
  return 'text';
}

export type Field = { key: string; node: Node; required: boolean; widget: string };

/** Fields of an object node, ordered by x-ui.order (unordered last, stable). Hidden ones are included; callers skip them. */
export function fieldsOf(root: Schema, obj: Node): Field[] {
  const req = new Set(obj.required ?? []);
  return Object.entries(obj.properties ?? {})
    .map(([key, n], i) => ({ key, node: resolve(root, n), i }))
    .sort((a, b) => (a.node['x-ui']?.order ?? 1e9) - (b.node['x-ui']?.order ?? 1e9) || a.i - b.i)
    .map(({ key, node }) => ({ key, node, required: req.has(key), widget: widgetOf(node) }));
}

export type Section = { id: string; fields: Field[] };
export function sectionsOf(root: Schema): Section[] {
  const out: Section[] = [];
  for (const f of fieldsOf(root, root)) {
    if (f.widget === 'hidden') continue;
    const id = f.node['x-ui']?.group ?? '';
    let s = out.find((x) => x.id === id);
    if (!s) out.push((s = { id, fields: [] }));
    s.fields.push(f);
  }
  return out;
}

export const msg = (messages: Record<string, unknown>, id?: string) =>
  id ? (typeof messages[id] === 'string' ? (messages[id] as string) : id) : '';

export const getPath = (v: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((a, k) => (a == null ? a : (a as Record<string, unknown>)[k]), v);

export function setPath(v: Value, path: string, next: unknown): Value {
  const [k, ...rest] = path.split('.');
  const cur = v[k];
  const child = rest.length
    ? setPath(
        Array.isArray(cur)
          ? ((cur as unknown[]).slice() as unknown as Value)
          : ((cur as Value | undefined) ?? {}),
        rest.join('.'),
        next,
      )
    : next;
  if (Array.isArray(v)) {
    const copy = v.slice();
    copy[Number(k)] = child;
    return copy as unknown as Value;
  }
  return { ...v, [k]: child };
}

const empty = (v: unknown) =>
  v == null ||
  v === '' ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0);

export const isAnswered = (v: unknown, unknownMap: Value | undefined, path: string) =>
  !empty(v) || unknownMap?.[path] !== undefined;

/** Unsupported widgets anywhere in the tree, with whether blocking applies (required on its parent chain). */
export function unsupported(root: Schema, obj: Node = root, prefix = '', req = true) {
  const out: { path: string; widget: string; required: boolean }[] = [];
  for (const f of fieldsOf(root, obj)) {
    const path = prefix + f.key;
    if (!KNOWN.has(f.widget)) out.push({ path, widget: f.widget, required: req && f.required });
    else if (f.widget === 'group')
      out.push(...unsupported(root, f.node, path + '.', req && f.required));
    else if (f.widget === 'list') {
      const item = f.node.items && resolve(root, f.node.items);
      if (item && !KNOWN.has(widgetOf(item)))
        out.push({ path: path + '.[]', widget: widgetOf(item), required: req && f.required });
      else if (item && widgetOf(item) === 'group')
        out.push(...unsupported(root, item, path + '.[].', false));
    }
  }
  return out;
}

const NON_INPUT = new Set(['readonly', 'hidden', ...SLOTS]);

/** Client checks from the schema only: required, length bounds, enum, URL shape. The server stays authoritative. */
export function validate(
  root: Schema,
  obj: Node,
  value: Value,
  unknownMap: Value | undefined,
  prefix = '',
): Errors {
  const errs: Errors = {};
  for (const f of fieldsOf(root, obj)) {
    const path = prefix + f.key;
    const v = value?.[f.key];
    const n = f.node;
    if (NON_INPUT.has(f.widget) || !KNOWN.has(f.widget)) continue;
    const allowUnknown = n['x-checks']?.allow_unknown && !n.enum?.includes('unknown');
    if (allowUnknown && unknownMap?.[path] !== undefined) {
      if (!String(unknownMap[path]).trim()) errs[path] = { id: 'form.error.unknownWhy' };
      continue;
    }
    if (f.widget === 'group') {
      Object.assign(errs, validate(root, n, (v as Value) ?? {}, unknownMap, path + '.'));
    } else if (f.widget === 'list') {
      const arr = Array.isArray(v) ? v : [];
      if (f.required && arr.length === 0) errs[path] = { id: 'common.validation.required' };
      const item = n.items && resolve(root, n.items);
      if (item) {
        arr.forEach((x, i) => {
          if (widgetOf(item) === 'group')
            Object.assign(errs, validate(root, item, x as Value, unknownMap, `${path}.${i}.`));
          else
            Object.assign(
              errs,
              validate(
                root,
                { properties: { [i]: item }, required: [String(i)] },
                arr as unknown as Value,
                unknownMap,
                path + '.',
              ),
            );
        });
      }
    } else if (f.widget === 'toggle' || f.widget === 'checkbox') {
      if (n.const === true && v !== true) errs[path] = { id: 'common.validation.required' };
    } else if (empty(v)) {
      if (f.required) errs[path] = { id: 'common.validation.required' };
    } else if (n.enum) {
      if (!n.enum.includes(v)) errs[path] = { id: 'form.error.choice' };
    } else if (typeof v === 'string') {
      const g = n['x-guidance'];
      const min = g?.min_chars ?? n.minLength;
      const max = g?.max_chars ?? n.maxLength;
      if (min && v.length < min)
        errs[path] = { id: 'form.error.tooShort', values: { count: v.length, min } };
      else if (max && v.length > max)
        errs[path] = { id: 'common.validation.tooLong', values: { count: v.length, max } };
      else if (f.widget === 'url' && !/^https?:\/\/\S+$/.test(v))
        errs[path] = { id: 'form.error.url' };
    }
  }
  return errs;
}

/** Needed top-level fields and how many are answered, for "x of y needed fields answered". */
export function progress(root: Schema, value: Value) {
  const unk = value[UNKNOWN_KEY] as Value | undefined;
  const needed = fieldsOf(root, root).filter(
    (f) => f.required && !NON_INPUT.has(f.widget) && KNOWN.has(f.widget),
  );
  return {
    required: needed.length,
    done: needed.filter((f) => isAnswered(value[f.key], unk, f.key)).length,
  };
}
