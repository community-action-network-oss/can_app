const MAIL = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025';

const q = (email: string) => encodeURIComponent(`to:${email}`);

/** Drop old mail for an address so the next code read cannot be stale. */
export async function clearMail(email: string): Promise<void> {
  await fetch(`${MAIL}/api/v1/search?query=${q(email)}`, { method: 'DELETE' });
}

/** Poll Mailpit for the newest 6 digit code sent to an address. */
export async function latestCode(email: string, timeoutMs = 15_000): Promise<string> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const res = await fetch(`${MAIL}/api/v1/search?query=${q(email)}`);
    const { messages = [] } = (await res.json()) as { messages?: { ID: string }[] };
    if (messages[0]) {
      const m = (await (await fetch(`${MAIL}/api/v1/message/${messages[0].ID}`)).json()) as {
        Text: string;
      };
      const code = /\b(\d{6})\b/.exec(m.Text)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`No sign-in code arrived in Mailpit for ${email}`);
}
