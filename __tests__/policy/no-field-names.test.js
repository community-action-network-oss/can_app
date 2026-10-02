// src/features/policy is schema driven: it names none of the policy_proposal fields.
const fs = require('fs');
const path = require('path');
const schema = require('./fixtures/policy_proposal.schema.json');

it('source under src/features/policy names no policy_proposal field', () => {
  const dir = path.join(__dirname, '../../src/features/policy');
  const src = fs
    .readdirSync(dir)
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n');
  const names = Object.keys(schema.properties);
  expect(names.length).toBeGreaterThan(8);
  for (const n of names) expect(src).not.toMatch(new RegExp(`['"\`]${n}['"\`]`));
});
