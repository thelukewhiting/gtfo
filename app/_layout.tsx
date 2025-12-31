import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

const convex = new ConvexReactClient(
  process.env.EXPO_PUBLIC_CONVEX_URL as string
);

export default function RootLayout() {
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("hasOnboarded").then((value) => {
      setHasOnboarded(value === "true");
    });
  }, []);

  if (hasOnboarded === null) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ConvexProvider client={convex}>
        <Stack screenOptions={{ headerShown: false }}>
          {!hasOnboarded ? (
            <Stack.Screen name="onboarding" />
          ) : (
            <Stack.Screen name="(tabs)" />
          )}
        </Stack>
      </ConvexProvider>
    </SafeAreaProvider>
  );
}
