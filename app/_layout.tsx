import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaListener } from 'react-native-safe-area-context';
import { Uniwind } from 'uniwind';

import { queryClient } from '../src/api/query-client';
import { AppShell } from '../src/components/civic';
import { GluestackUIProvider } from '../src/components/ui/gluestack-ui-provider';
import { I18nProvider } from '../src/i18n';
import { SessionExpiredSheet } from '../src/session/SessionExpiredSheet';
import { SessionProvider } from '../src/session/SessionProvider';
import '../global.css';

export default function RootLayout() {
  return (
    <SafeAreaListener onChange={({ insets }) => Uniwind.updateInsets(insets)}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <GluestackUIProvider mode="system">
          <QueryClientProvider client={queryClient}>
            <I18nProvider>
              <SessionProvider>
                <AppShell>
                  <Stack screenOptions={{ headerShown: false }} />
                </AppShell>
                <SessionExpiredSheet />
              </SessionProvider>
            </I18nProvider>
          </QueryClientProvider>
        </GluestackUIProvider>
      </GestureHandlerRootView>
    </SafeAreaListener>
  );
}
