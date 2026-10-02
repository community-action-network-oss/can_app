// Nothing under src/forms/schema may name a problem field: the renderer is schema driven.
const fs = require('fs');
const path = require('path');
const problem = require('./fixtures/problem.schema.json');

it('source under src/forms/schema names no problem field', () => {
  const dir = path.join(__dirname, '../../src/forms/schema');
  const src = fs
    .readdirSync(dir)
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n');
  // stage_plan is also a generic widget name (a slot), so it is allowed.
  for (const n of Object.keys(problem.properties).filter((k) => k !== 'stage_plan')) {
    expect(src).not.toMatch(new RegExp(`['"\`]${n}['"\`]`));
  }
});
