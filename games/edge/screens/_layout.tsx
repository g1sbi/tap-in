import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initializeAuth } from '@/games/edge/lib/auth';

export default function RootLayout() {
  useEffect(() => {
    // Initialize anonymous auth on app startup
    initializeAuth().catch((error) => {
      console.error('Failed to initialize auth:', error);
      // Log detailed error for debugging
      if (error instanceof Error) {
        console.error('Auth error details:', {
          message: error.message,
          stack: error.stack,
        });
      }
      // App will continue to work, but some features may be limited
      // User can retry by restarting the app
    });
  }, []);

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#0a0a0a',
          },
          headerTintColor: '#00f0ff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          contentStyle: {
            backgroundColor: '#0a0a0a',
          },
        }}
      >
        <Stack.Screen
          name="index"
          options={{ title: 'EDGE', headerShown: false }}
        />
        <Stack.Screen name="room/[code]/lobby" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}

