import { render, screen } from '@testing-library/react-native';

import { Button, ButtonText } from '../src/components/ui/button';
import { GluestackUIProvider } from '../src/components/ui/gluestack-ui-provider';
import { gluestackTheme } from '../src/theme/gluestack.generated';
import tokens from '../src/theme/tokens.json';

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

describe('generated gluestack theme', () => {
  it.each(['light', 'dark'] as const)('exposes every token colour in %s', (mode) => {
    const vars: Record<string, string> = gluestackTheme[mode];
    const { color, status } = tokens.themes[mode];
    for (const [k, { value }] of Object.entries(color)) {
      expect(vars[`--can-${kebab(k)}`]).toBe(value);
    }
    for (const [s, { fg, bg }] of Object.entries(status)) {
      expect(vars[`--can-status-${s}-fg`]).toBe(fg);
      expect(vars[`--can-status-${s}-bg`]).toBe(bg);
    }
    expect(vars['--primary']).toBe(color.primary.value);
    expect(vars['--background']).toBe(color.bg.value);
  });

  it('renders a generated component inside the provider', async () => {
    await render(
      <GluestackUIProvider mode="light">
        <Button accessibilityLabel="Go">
          <ButtonText>Go</ButtonText>
        </Button>
      </GluestackUIProvider>,
    );
    expect(screen.getByText('Go')).toBeTruthy();
  });
});
