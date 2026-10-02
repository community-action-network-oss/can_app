import { expect, test, type Page } from '@playwright/test';

import { expectNoSeriousAxeViolations } from './helpers/axe';
import { signInAs } from './helpers/auth';

// Needs API :4000, Mailpit :8025 and the fixture seed (`npm run e2e` runs scripts/e2e-prepare.mjs).
const API = process.env.E2E_API_URL ?? 'http://localhost:4000';

// Click the first card (proves list to detail navigation), then go straight to a fixture problem that
// has a status panel: some fixtures are tombstones, and the sticky emergency notice can cover lower cards.
const openFirst = async (page: Page) => {
  await page.goto('/');
  const open = page.getByRole('button', { name: /^Open: Fictional example:/ });
  await expect(open.first()).toBeVisible();
  // Keyboard, not pointer: the sticky emergency notice covers cards below the fold.
  await open.first().focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/problems\/[^/]+$/);
  const res = await fetch(`${API}/v1/problems`);
  const { items } = (await res.json()) as { items: { id: string; state: string }[] };
  const live = items.find((p) => p.state !== 'withdrawn');
  if (!live) throw new Error('No live fixture problem: run npm run e2e:prepare');
  await page.goto(`/problems/${live.id}`);
  await expect(page.getByRole('heading', { name: 'Where this stands' })).toBeVisible();
};

test('list shows fixture problems and detail shows a status label', async ({ page }) => {
  await openFirst(page);
  await expect(page.getByText(/◆ \S/).first()).toBeVisible();
});

// Auth is rate limited per email (5 per 10 min), so each viewport uses its own member and no retry.
test.describe('sign in', () => {
  test.describe.configure({ retries: 0 });
  test('seeded member signs in and My activity is reachable', async ({ page }, info) => {
    const who = info.project.name === 'phone-360' ? 'member-one' : 'member-two';
    await signInAs(page, `${who}@example.org`);
    await page.getByRole('link', { name: 'My activity' }).click();
    await expect(page).toHaveURL(/\/me$/);
    await expect(page.getByRole('heading', { level: 1, name: 'My activity' })).toBeVisible();
  });
});

// Real findings on 2026-10-02 (see 02-u21 report): error toast on anonymous load (button-name,
// nested-interactive) and nav colour contrast. Remove fixme when those are fixed.
test('axe: no serious issues on list and detail', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
  await expectNoSeriousAxeViolations(page);
  await openFirst(page);
  await expectNoSeriousAxeViolations(page);
});
