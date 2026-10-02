// src/preparation is schema driven: it names none of the core problem fields (route glue in app/ may).
const fs = require('fs');
const path = require('path');
const problem = require('./forms/fixtures/problem.schema.json');

it('src/preparation names no core problem field', () => {
  const dir = path.join(__dirname, '../src/preparation');
  const src = fs
    .readdirSync(dir)
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n');
  const core = Object.entries(problem.properties)
    .filter(([, v]) => v['x-ui'].order <= 14)
    .map(([k]) => k);
  expect(core.length).toBeGreaterThanOrEqual(8);
  for (const n of core) expect(src).not.toMatch(new RegExp(`['"\`]${n}['"\`]`));
});
