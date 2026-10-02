import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { size, space } from '../../theme';
import { Box } from '../ui/box';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <Box className="flex-1 bg-can-bg">
      <SafeAreaView style={{ flex: 1 }}>
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
    </Box>
  );
}
