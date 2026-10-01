import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { size, space, useTheme } from '../../theme';

export function Screen({ children }: { children: ReactNode }) {
  const { color } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView
        contentContainerStyle={{
          width: '100%',
          maxWidth: size.contentMaxWidth,
          alignSelf: 'center',
          padding: space('4'),
          gap: space('4'),
        }}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
