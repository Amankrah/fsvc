import React, { useEffect } from 'react';
import { View, Platform, Dimensions, PixelRatio, LogBox } from 'react-native';

// Suppress known React Native Paper warning about overflow on Surface
LogBox.ignoreLogs([
  'When setting overflow to hidden on Surface',
]);
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Fraunces_700Bold, Fraunces_400Regular } from '@expo-google-fonts/fraunces';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { Provider as PaperProvider, MD3LightTheme, configureFonts } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as ScreenOrientation from 'expo-screen-orientation';
import RootNavigator from './src/navigation/RootNavigator';
import { paperThemeColors, colors } from './src/constants/theme';
import { ToastProvider } from './src/components/Toast';

// "Savanna Intelligence" — all Paper components inherit these tokens.
// Screens must NOT hardcode hex values; import from src/constants/theme.ts instead.
//
// Paper's MD3 typescale defaults to System font; we override every role so
// Searchbar, Dialog, Chip, Text variant="…" etc. all render in DM Sans
// to match the hand-styled headings used throughout the screens.
const paperFonts = configureFonts({
  config: {
    displayLarge:    { fontFamily: 'DMSans-Bold' },
    displayMedium:   { fontFamily: 'DMSans-Bold' },
    displaySmall:    { fontFamily: 'DMSans-Bold' },
    headlineLarge:   { fontFamily: 'DMSans-Bold' },
    headlineMedium:  { fontFamily: 'DMSans-Bold' },
    headlineSmall:   { fontFamily: 'DMSans-Bold' },
    titleLarge:      { fontFamily: 'DMSans-SemiBold' },
    titleMedium:     { fontFamily: 'DMSans-SemiBold' },
    titleSmall:      { fontFamily: 'DMSans-SemiBold' },
    labelLarge:      { fontFamily: 'DMSans-Medium' },
    labelMedium:     { fontFamily: 'DMSans-Medium' },
    labelSmall:      { fontFamily: 'DMSans-Medium' },
    bodyLarge:       { fontFamily: 'DMSans-Regular' },
    bodyMedium:      { fontFamily: 'DMSans-Regular' },
    bodySmall:       { fontFamily: 'DMSans-Regular' },
  },
});

const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    ...paperThemeColors,
  },
  fonts: paperFonts,
};

export default function App() {
  const [fontsLoaded] = useFonts({
    'Fraunces-Bold': Fraunces_700Bold,
    'Fraunces-Regular': Fraunces_400Regular,
    'DMSans-Regular': DMSans_400Regular,
    'DMSans-Medium': DMSans_500Medium,
    'DMSans-SemiBold': DMSans_600SemiBold,
    'DMSans-Bold': DMSans_700Bold,
  });

  useEffect(() => {
    // Lock phones to portrait; leave tablets free to rotate (landscape survey layout).
    // Tablet heuristic: diagonal screen size ≥ 7 inches (≈ 600dp shortest side).
    if (Platform.OS !== 'web') {
      const { width, height } = Dimensions.get('screen');
      const shortSideDp = Math.min(width, height) / PixelRatio.get();
      const isTablet = shortSideDp >= 600;
      if (isTablet) {
        ScreenOrientation.unlockAsync();
      } else {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
    }

    // For web, ensure MaterialCommunityIcons font is loaded
    if (Platform.OS === 'web') {
      const link = document.createElement('link');
      link.href = 'https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background.default }} />
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={paperTheme}>
          <ToastProvider>
            <StatusBar style="dark" backgroundColor="transparent" translucent />
            <RootNavigator />
          </ToastProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
