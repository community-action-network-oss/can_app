import type { components } from '../../api/schema';
import { msg, pathLabel, type Schema, type Value } from '../../forms/schema/model';

export type Plan = components['schemas']['MigrationPlanDto'];
export type Mapping = components['schemas']['MigrationMappingDto'];

const isMajorPinned = (p: Plan) => p.bump === 'major' && p.state === 'pinned';
/** A response that is not a plan (or a plan with nothing pending) shows nothing. */
export const graceEnded = (p: Plan, now = Date.now()) =>
  !!p.grace_ends_at && Date.parse(p.grace_ends_at) <= now;
export const needsMove = (p: Plan) => isMajorPinned(p);
export const minorNotice = (p: Plan) => p.bump === 'minor' && p.state === 'migrated';

/** Rows the person must confirm one by one. Copies apply without a click. */
export const toConfirm = (p: Plan) => p.mapping.filter((m) => m.needs_confirmation);
export const rowKey = (m: Mapping) => `${m.from_path}>${m.to_path}`;

/** Paths of what is new or changed, for the banner. */
export function changedPaths(p: Plan): string[] {
  const moved = p.mapping.filter(
    (m) => m.to_path && (m.from_path !== m.to_path || m.needs_confirmation),
  );
  return [...new Set([...p.new_required, ...moved.map((m) => m.to_path)])];
}

export const labels = (
  schema: Schema | undefined,
  messages: Record<string, unknown>,
  paths: string[],
) => paths.map((p) => (schema ? pathLabel(schema, (id) => msg(messages, id), p) : p)).join(', ');

const del = (v: Value, path: string): Value => {
  const [k, ...rest] = path.split('.');
  if (!(k in v)) return v;
  if (!rest.length) {
    const { [k]: _gone, ...keep } = v;
    return keep;
  }
  const child = v[k];
  return child && typeof child === 'object' && !Array.isArray(child)
    ? { ...v, [k]: del(child as Value, rest.join('.')) }
    : v;
};
const put = (v: Value, path: string, x: unknown): Value => {
  const [k, ...rest] = path.split('.');
  if (!rest.length) return { ...v, [k]: x };
  const child = v[k];
  const base = child && typeof child === 'object' && !Array.isArray(child) ? (child as Value) : {};
  return { ...v, [k]: put(base, rest.join('.'), x) };
};

/**
 * The local answers after the server applied the confirmed plan: copies and confirmed rows move,
 * dropped answers go, skipped rows stay. Mirrors the server so the next save sends the right content.
 */
export function applyPlan(body: Value, plan: Plan, confirmed: ReadonlySet<string>): Value {
  const applied = plan.mapping.filter((m) => !m.needs_confirmation || confirmed.has(rowKey(m)));
  let out = body;
  for (const m of applied) if (m.from_path !== m.to_path) out = del(out, m.from_path);
  for (const m of applied)
    if (m.to_path && m.carried_value != null) out = put(out, m.to_path, m.carried_value);
  for (const d of plan.dropped) out = del(out, d);
  return out;
}
