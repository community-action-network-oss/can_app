// The controls draw whatever the API lists: no input registry keyed by field name (D-58).
const fs = require('fs');
const path = require('path');

it('StageControls.tsx names no transition field', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../src/stages/controls/StageControls.tsx'),
    'utf8',
  );
  for (const n of ['blocker', 'attempts', 'clearedNote', 'nextRoute', 'sourceVersion', 'evidence'])
    expect(src).not.toMatch(new RegExp(`['"\`]${n}['"\`]`));
});
