import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaListener } from 'react-native-safe-area-context';
import { Uniwind } from 'uniwind';

import { GluestackUIProvider } from '../src/components/ui/gluestack-ui-provider';
import { I18nProvider } from '../src/i18n';
import '../global.css';

export default function RootLayout() {
  const [client] = useState(() => new QueryClient());
  return (
    <SafeAreaListener onChange={({ insets }) => Uniwind.updateInsets(insets)}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <GluestackUIProvider mode="system">
          <QueryClientProvider client={client}>
            <I18nProvider>
              <Stack screenOptions={{ headerShown: false }} />
            </I18nProvider>
          </QueryClientProvider>
        </GluestackUIProvider>
      </GestureHandlerRootView>
    </SafeAreaListener>
  );
}
