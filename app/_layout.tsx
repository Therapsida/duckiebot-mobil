
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

import { RosProvider } from '@/context/RosContext';
import { DuckiebotProvider } from "../context/DuckiebotContext";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <DuckiebotProvider>
        <RosProvider> 
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="details/[id]" options={{ headerShown: false }} />
        </Stack>
      </RosProvider>
      </DuckiebotProvider>

      <StatusBar style="auto" />
    </ThemeProvider>
  );
}