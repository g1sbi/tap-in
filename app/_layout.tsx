import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import 'react-native-reanimated';
import '../polyfills';

// Import configuration overrides (must be imported early to apply before game starts)
import '@/lib/config-overrides';

// Only import react-native-get-random-values on native platforms
if (Platform.OS !== 'web') {
  require('react-native-get-random-values');
}

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeHydrated } from '@/lib/stores';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isHydrated = useThemeHydrated();

  // Wait for theme store to hydrate from AsyncStorage
  if (!isHydrated) {
    return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  }

  return (
    <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </NavigationThemeProvider>
  );
}
