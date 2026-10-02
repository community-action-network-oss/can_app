import type { MessageId } from '../i18n';
import type { Session } from './SessionContext';

export type Area = { href: string; label: MessageId; roles?: string[] };

export const BREAKPOINT = 768;

// Order is the nav order. No count badges on nav items.
export const AREAS: Area[] = [
  { href: '/', label: 'nav.discover' },
  { href: '/report', label: 'nav.report' },
  { href: '/me', label: 'nav.me' },
  { href: '/policy', label: 'nav.policy' },
  { href: '/review', label: 'nav.review', roles: ['auditor', 'labeler'] },
];

export const visibleAreas = (s: Session) =>
  AREAS.filter((a) => !a.roles || a.roles.some((r) => s.roles?.includes(r)));

export const isActive = (href: string, path: string) =>
  href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
