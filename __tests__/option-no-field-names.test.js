// src/stages/options is schema driven: it names no stage_option field (D-58).
const fs = require('fs');
const path = require('path');

it('source under src/stages/options names no schema field', () => {
  const dir = path.join(__dirname, '../src/stages/options');
  const src = fs
    .readdirSync(dir)
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n');
  for (const n of [
    'option_statement',
    'responsible_role',
    'authority_and_legal_basis',
    'cost_estimate',
    'how_it_meets_stage_criteria',
    'risks_and_rights_impact',
    'lawful_alternatives',
    'stage_ref',
  ])
    expect(src).not.toMatch(new RegExp(`['"\`]${n}['"\`]`));
  expect(src).not.toMatch(/\.sort\(|upvote|engagement/i);
});
