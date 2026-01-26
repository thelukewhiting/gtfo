import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL;

function ConfigError() {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Configuration Error</Text>
      <Text style={styles.errorText}>
        EXPO_PUBLIC_CONVEX_URL is not configured.{"\n"}
        Please check your environment setup.
      </Text>
    </View>
  );
}

let convex: ConvexReactClient | null = null;
try {
  if (CONVEX_URL) {
    convex = new ConvexReactClient(CONVEX_URL);
  }
} catch (e) {
  console.error("Failed to initialize Convex client:", e);
}

export default function RootLayout() {
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("hasOnboarded").then((value) => {
      setHasOnboarded(value === "true");
    });
  }, []);

  if (!convex) {
    return (
      <SafeAreaProvider>
        <ConfigError />
      </SafeAreaProvider>
    );
  }

  if (hasOnboarded === null) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer} />
      </SafeAreaProvider>
    );
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

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ff6b6b",
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    lineHeight: 24,
  },
});
