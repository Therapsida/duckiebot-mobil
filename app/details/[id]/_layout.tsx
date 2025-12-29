import { Stack } from 'expo-router';

export default function DetailLayout() {
    return (
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
    );
}