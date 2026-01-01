import { ActiveRobotProvider } from '@/context/ActiveDuckiebotContext';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function DetailLayout() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
        <ActiveRobotProvider>
        <Stack
            screenOptions={{
                headerShown: false,
            }}
        >
            <Stack.Screen
                name="index"
                options={{
                    title: 'Details',
                }}
            />
        </Stack>
        </ActiveRobotProvider>
        </GestureHandlerRootView>
    );
}