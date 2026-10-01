// Copies the design tokens (single owner: docs/design/ux/tokens.json) into the app.
import { copyFileSync, existsSync } from 'node:fs';

const src = new URL('../../docs/design/ux/tokens.json', import.meta.url);
if (!existsSync(src)) {
  console.error('../docs/design/ux/tokens.json not found. Run from the superproject checkout.');
  process.exit(1);
}
copyFileSync(src, new URL('../src/theme/tokens.json', import.meta.url));
console.log('synced src/theme/tokens.json');
