/** Accepts only a same-app path. Anything else (absolute URL, //host, backslash tricks) falls back to home. */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
  if (/[\u0000-\u001f]/.test(value)) return '/';
  return value;
}
