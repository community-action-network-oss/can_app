// Fails on physical (left/right) style props. Use start/end so layouts mirror in RTL.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const re =
  /\b(margin|padding|border)(Left|Right)\b|\b(left|right)\s*:|\btext-(left|right)\b|\b(ml|mr|pl|pr)-\d|textAlign:\s*['"](left|right)['"]/;
const bad = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|css)$/.test(name) && !name.endsWith('.d.ts')) {
      readFileSync(p, 'utf8')
        .split('\n')
        .forEach((l, i) => re.test(l) && bad.push(`${p}:${i + 1}: ${l.trim()}`));
    }
  }
};
['app', 'src'].forEach(walk);
if (bad.length) {
  console.error('Physical left/right properties found, use start/end:\n' + bad.join('\n'));
  process.exit(1);
}
console.log('logical properties ok');
