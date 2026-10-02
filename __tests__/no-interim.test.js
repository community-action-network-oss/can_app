const { readFileSync, readdirSync, statSync } = require('fs');
const { join } = require('path');

const tokens = require('../src/theme/tokens.json');

const walk = (d) =>
  readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

describe('status vocabulary (D-51)', () => {
  it('has no interim reference in src, app or global.css', () => {
    const files = [...walk('src'), ...walk('app'), 'global.css'].filter((f) =>
      /\.(tsx?|json|css)$/.test(f),
    );
    const hits = files.filter((f) => /interim/i.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });

  it.each(['light', 'dark'])('defines status.transitional in %s', (mode) => {
    const s = tokens.themes[mode].status;
    expect(s.transitional).toBeDefined();
    expect(s.interim).toBeUndefined();
  });
});
