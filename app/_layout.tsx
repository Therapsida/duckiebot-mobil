
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { TamaguiProvider, Theme } from 'tamagui';
import config from '../tamagui.config'; // Dosya yoluna dikkat et

import { RosProvider } from '@/context/RosContext';
import { DuckiebotProvider } from "../context/DuckiebotContext";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  
  const [loaded] = useFonts({
    Silkscreen: require('../assets/fonts/Silkscreen-Regular.ttf'),
    SilkscreenBold : require('../assets/fonts/Silkscreen-Bold.ttf'),
  })

  useEffect(() => {
    if (loaded) {
     SplashScreen.hideAsync();
    }
  }, [loaded])

  if (!loaded) return null

  return (
    <TamaguiProvider config={config}>
      <Theme name="pixel-duck">
    
      <DuckiebotProvider>
        <RosProvider> 
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="details/[id]" options={{ headerShown: false }} />
        </Stack>
      </RosProvider>
      </DuckiebotProvider>

      <StatusBar style="auto" />
    </Theme>
    </TamaguiProvider>
  );
}