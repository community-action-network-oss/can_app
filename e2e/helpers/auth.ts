import type { Page } from '@playwright/test';

import { clearMail, latestCode } from './mailpit';

async function sendCodeAndVerify(page: Page, email: string) {
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send me a code' }).click();
  await page.getByLabel('6 digit code').waitFor();
  await page.getByLabel('6 digit code').fill(await latestCode(email));
  await page.getByRole('button', { name: 'Continue' }).click();
}

/** WF-SIGNIN-1/2: email, then the code read from Mailpit. Ends signed in. */
export async function signInAs(page: Page, email: string) {
  await clearMail(email);
  await page.goto('/sign-in');
  await sendCodeAndVerify(page, email);
  await page.waitForURL((u) => !u.pathname.startsWith('/sign-in'));
}

/** Invite sign-up (WF-SIGNUP): invite, email, age checkbox, then the code. Ends on /welcome. */
export async function signUpWithInvite(page: Page, invite: string, email: string) {
  await clearMail(email);
  await page.goto('/sign-up');
  await page.getByLabel('Invite code').fill(invite);
  await page.getByLabel('Email').fill(email);
  await page.getByText('I am 18 or older').click();
  await page.getByRole('button', { name: 'Send me a code' }).click();
  await page.getByLabel('6 digit code').fill(await latestCode(email));
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL('**/welcome');
}
