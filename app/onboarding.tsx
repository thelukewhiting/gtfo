import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { getExpoPushToken } from "../hooks/usePushToken";
import * as Localization from "expo-localization";

type Step = "welcome" | "location" | "notifications" | "done";

export default function OnboardingScreen() {
  const [step, setStep] = useState<Step>("welcome");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const registerDevice = useMutation(api.devices.register);

  const handleLocationPermission = async () => {
    setLoading(true);
    setError(null);

    try {
      const { status: foregroundStatus } =
        await Location.requestForegroundPermissionsAsync();

      if (foregroundStatus !== "granted") {
        setError("Location permission is required for sunset predictions");
        setLoading(false);
        return;
      }

      // Background location doesn't work in Expo Go - skip it
      // For production, you'd need a development build
      try {
        const { status: backgroundStatus } =
          await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== "granted") {
          console.log("Background location not granted (optional)");
        }
      } catch (bgErr) {
        // Background location not supported in Expo Go - that's fine
        console.log("Background location not available in Expo Go");
      }

      setStep("notifications");
    } catch (err) {
      console.error("Location permission error:", err);
      setError("Failed to request location permission. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationPermission = async () => {
    setLoading(true);
    setError(null);

    try {
      const { status } = await Notifications.requestPermissionsAsync();

      if (status !== "granted") {
        setError("Notification permission is required to alert you about sunsets");
        setLoading(false);
        return;
      }

      // Get push token and location
      const pushToken = await getExpoPushToken();
      const location = await Location.getCurrentPositionAsync({});
      const timezone = Localization.getCalendars()[0]?.timeZone || "UTC";

      if (pushToken) {
        await registerDevice({
          pushToken,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timezone,
        });
      }

      setStep("done");
    } catch (err) {
      setError("Failed to set up notifications");
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    await AsyncStorage.setItem("hasOnboarded", "true");
    router.replace("/(tabs)");
  };

  const renderStep = () => {
    switch (step) {
      case "welcome":
        return (
          <>
            <Text style={styles.emoji}>🌅</Text>
            <Text style={styles.title}>GTFO</Text>
            <Text style={styles.subtitle}>
              Never miss a beautiful sunset again
            </Text>
            <Text style={styles.description}>
              We'll notify you when there's a particularly good sunset in your
              area based on weather conditions and atmospheric data.
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => setStep("location")}
            >
              <Text style={styles.buttonText}>Get Started</Text>
            </TouchableOpacity>
          </>
        );

      case "location":
        return (
          <>
            <Text style={styles.emoji}>📍</Text>
            <Text style={styles.title}>Location Access</Text>
            <Text style={styles.description}>
              We need your location to check sunset predictions for your area.
              We'll also monitor location changes to keep predictions accurate.
            </Text>
            {error && <Text style={styles.error}>{error}</Text>}
            <TouchableOpacity
              style={styles.button}
              onPress={handleLocationPermission}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Enable Location</Text>
              )}
            </TouchableOpacity>
          </>
        );

      case "notifications":
        return (
          <>
            <Text style={styles.emoji}>🔔</Text>
            <Text style={styles.title}>Notifications</Text>
            <Text style={styles.description}>
              Allow notifications so we can tell you when to go outside. You'll
              get alerts at 11am and 1 hour before sunset on good days.
            </Text>
            {error && <Text style={styles.error}>{error}</Text>}
            <TouchableOpacity
              style={styles.button}
              onPress={handleNotificationPermission}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Enable Notifications</Text>
              )}
            </TouchableOpacity>
          </>
        );

      case "done":
        return (
          <>
            <Text style={styles.emoji}>✨</Text>
            <Text style={styles.title}>You're All Set!</Text>
            <Text style={styles.description}>
              We'll notify you when there's a great sunset coming. Check the app
              anytime to see today's forecast.
            </Text>
            <TouchableOpacity style={styles.button} onPress={handleFinish}>
              <Text style={styles.buttonText}>Start Watching Sunsets</Text>
            </TouchableOpacity>
          </>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>{renderStep()}</View>
      <View style={styles.dots}>
        {(["welcome", "location", "notifications", "done"] as Step[]).map(
          (s, i) => (
            <View
              key={s}
              style={[
                styles.dot,
                step === s && styles.dotActive,
                (["welcome", "location", "notifications", "done"] as Step[]).indexOf(step) > i &&
                  styles.dotCompleted,
              ]}
            />
          )
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 18,
    color: "#ff6b35",
    marginBottom: 30,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 40,
  },
  button: {
    backgroundColor: "#ff6b35",
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 30,
    minWidth: 200,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  error: {
    color: "#ff6b6b",
    fontSize: 14,
    marginBottom: 20,
    textAlign: "center",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingBottom: 40,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#333",
  },
  dotActive: {
    backgroundColor: "#ff6b35",
    width: 24,
  },
  dotCompleted: {
    backgroundColor: "#ff6b35",
  },
});
