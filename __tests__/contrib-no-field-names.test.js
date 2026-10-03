// src/contributions is schema driven: it names no per-type contribution field (D-58).
const fs = require('fs');
const path = require('path');

it('source under src/contributions names no per-type field', () => {
  const dir = path.join(__dirname, '../src/contributions');
  const src = fs
    .readdirSync(dir)
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n');
  for (const n of [
    'hypothesis',
    'mechanism',
    'uncertainty',
    'assumptions',
    'basis',
    'evidence_refs',
  ])
    expect(src).not.toMatch(new RegExp(`['"\`]${n}['"\`]`));
});
