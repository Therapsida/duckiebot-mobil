
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';
import 'react-native-reanimated';
import { TamaguiProvider, Theme } from 'tamagui';
import config from '../tamagui.config';

import { DuckiebotProvider } from "@/context/DuckiebotContext";
import { MultiRosProvider } from '@/context/RosContext';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  
  const [loaded] = useFonts({
    Silkscreen: require('../assets/fonts/Silkscreen-Regular.ttf'),
    SilkscreenBold : require('../assets/fonts/Silkscreen-Bold.ttf'),
  })

  useEffect(() => {
    if (loaded) {
     SplashScreen.hideAsync();
     ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    }
  }, [loaded])

  if (!loaded) return null

  return (
    <TamaguiProvider config={config}>
      <Theme name="pixel-duck">

      {/*
        Provider order matters:
          DuckiebotProvider  — discovers robots, exposes showMocks toggle
            MultiRosProvider — consumes DuckiebotContext to auto-connect each
                               real robot as soon as it is discovered; keeps
                               connections alive forever (auto-reconnect).
      */}
      <DuckiebotProvider>
        <MultiRosProvider>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="qr" options={{ headerShown: false }} />
            <Stack.Screen name="map-3d" options={{ headerShown: false }} />
            <Stack.Screen name="details/[id]" options={{ headerShown: false }} />
          </Stack>
        </MultiRosProvider>
      </DuckiebotProvider>

      <StatusBar style="auto" />
    </Theme>
    </TamaguiProvider>
  );
}