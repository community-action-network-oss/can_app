import type { Schema } from '../../forms/schema/model';

/** The schema without the named top-level fields (they are edited on their own screens). Nothing here knows a field. */
export function withoutFields(schema: Schema, keys: readonly string[]): Schema {
  const drop = new Set(keys);
  return {
    ...schema,
    properties: Object.fromEntries(
      Object.entries(schema.properties ?? {}).filter(([k]) => !drop.has(k)),
    ),
    required: (schema.required ?? []).filter((k) => !drop.has(k)),
  };
}

/** '/content/place/region' or '/content/items/0/name' -> 'place.region' / 'items.0.name'. */
export function pointerToPath(p: string): string {
  return p
    .replace(/^\/content\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'))
    .join('.');
}

export function mapFieldErrors(fe: Record<string, string> | undefined): Record<string, string> {
  return Object.fromEntries(Object.entries(fe ?? {}).map(([k, v]) => [pointerToPath(k), v]));
}
