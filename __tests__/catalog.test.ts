import en from '../src/i18n/en.json';

test('en catalog has no em or en dashes', () => {
  for (const [id, msg] of Object.entries(en)) {
    expect({ id, bad: /[–—]/.test(msg) }).toEqual({ id, bad: false });
  }
});
