import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAction, useMutation, useQuery } from "convex/react";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../../convex/_generated/api";
import { usePushToken } from "../../hooks/usePushToken";
import { BACKGROUND_LOCATION_TASK } from "../../tasks/backgroundLocation";

type QualityLevel = "Fair" | "Good" | "Great";

export default function SettingsScreen() {
  const { pushToken } = usePushToken();
  const device = useQuery(
    api.devices.getByToken,
    pushToken ? { pushToken } : "skip"
  );
  const updatePreferences = useMutation(api.devices.updatePreferences);
  const sendTestNotification = useAction(api.sunsets.sendTestNotification);

  const [notifyMorning, setNotifyMorning] = useState(true);
  const [notifyHourBefore, setNotifyHourBefore] = useState(true);
  const [minQuality, setMinQuality] = useState<QualityLevel>("Good");
  const [backgroundTracking, setBackgroundTracking] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    if (device) {
      setNotifyMorning(device.notifyMorning);
      setNotifyHourBefore(device.notifyHourBefore);
      setMinQuality(device.minQuality);
    }
  }, [device]);

  useEffect(() => {
    // Check if background tracking is currently enabled
    const checkBackgroundStatus = async () => {
      try {
        const hasStarted = await Location.hasStartedLocationUpdatesAsync(
          BACKGROUND_LOCATION_TASK
        );
        setBackgroundTracking(hasStarted);
      } catch {
        setBackgroundTracking(false);
      }
    };
    checkBackgroundStatus();
  }, []);

  const handleToggleMorning = async (value: boolean) => {
    setNotifyMorning(value);
    if (pushToken) {
      await updatePreferences({ pushToken, notifyMorning: value });
    }
  };

  const handleToggleHourBefore = async (value: boolean) => {
    setNotifyHourBefore(value);
    if (pushToken) {
      await updatePreferences({ pushToken, notifyHourBefore: value });
    }
  };

  const handleQualityChange = async (quality: QualityLevel) => {
    setMinQuality(quality);
    if (pushToken) {
      await updatePreferences({ pushToken, minQuality: quality });
    }
  };

  const handleToggleBackgroundTracking = async (value: boolean) => {
    try {
      if (value) {
        const { status } = await Location.requestBackgroundPermissionsAsync();
        if (status !== "granted") {
          return;
        }
        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 1000,
          timeInterval: 10 * 60 * 1000,
          pausesUpdatesAutomatically: true,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: "GTFO is tracking location",
            notificationBody: "Keeping sunset predictions accurate while you travel.",
          },
        });
        setBackgroundTracking(true);
        await AsyncStorage.setItem("backgroundTrackingEnabled", "true");
      } else {
        const hasStarted = await Location.hasStartedLocationUpdatesAsync(
          BACKGROUND_LOCATION_TASK
        );
        if (hasStarted) {
          await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        }
        setBackgroundTracking(false);
        await AsyncStorage.setItem("backgroundTrackingEnabled", "false");
      }
    } catch (error) {
      console.log("Failed to toggle background tracking:", error);
    }
  };

  const handleTestNotification = async () => {
    if (!pushToken) return;

    setSendingTest(true);
    setTestSent(false);
    try {
      await sendTestNotification({ pushToken });
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
    } catch (error) {
      console.error("Failed to send test notification:", error);
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Morning Alert (11am)</Text>
              <Text style={styles.rowSubtitle}>
                Get notified after predictions update
              </Text>
            </View>
            <Switch
              value={notifyMorning}
              onValueChange={handleToggleMorning}
              trackColor={{ false: "#333", true: "#ff6b35" }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>1 Hour Reminder</Text>
              <Text style={styles.rowSubtitle}>
                Reminder before sunset starts
              </Text>
            </View>
            <Switch
              value={notifyHourBefore}
              onValueChange={handleToggleHourBefore}
              trackColor={{ false: "#333", true: "#ff6b35" }}
              thumbColor="#fff"
            />
          </View>

          <TouchableOpacity
            style={[styles.testButton, testSent && styles.testButtonSuccess]}
            onPress={handleTestNotification}
            disabled={sendingTest || !pushToken}
          >
            {sendingTest ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.testButtonText}>
                {testSent ? "Sent!" : "Send Test Notification"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Minimum Quality</Text>
          <Text style={styles.sectionSubtitle}>
            Only notify for sunsets at or above this level
          </Text>

          <View style={styles.qualityButtons}>
            {(["Fair", "Good", "Great"] as QualityLevel[]).map((level) => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.qualityButton,
                  minQuality === level && styles.qualityButtonActive,
                ]}
                onPress={() => handleQualityChange(level)}
              >
                <Text
                  style={[
                    styles.qualityButtonText,
                    minQuality === level && styles.qualityButtonTextActive,
                  ]}
                >
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Background Tracking</Text>
              <Text style={styles.rowSubtitle}>
                Update predictions while traveling
              </Text>
            </View>
            <Switch
              value={backgroundTracking}
              onValueChange={handleToggleBackgroundTracking}
              trackColor={{ false: "#333", true: "#ff6b35" }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.aboutText}>
            GTFO uses Sunsethue to predict sunset quality based on cloud cover
            and atmospheric conditions. Predictions update daily.
          </Text>
        </View>

        {device && (
          <Text style={styles.deviceInfo}>
            Device registered: {device._id.slice(-8)}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 20,
    marginBottom: 30,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ff6b35",
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#888",
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#16213e",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  rowText: {
    flex: 1,
    marginRight: 16,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#fff",
  },
  rowSubtitle: {
    fontSize: 13,
    color: "#888",
    marginTop: 4,
  },
  testButton: {
    backgroundColor: "#16213e",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ff6b35",
  },
  testButtonSuccess: {
    backgroundColor: "#2d5a27",
    borderColor: "#4a9c3e",
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ff6b35",
  },
  qualityButtons: {
    flexDirection: "row",
    gap: 12,
  },
  qualityButton: {
    flex: 1,
    backgroundColor: "#16213e",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  qualityButtonActive: {
    borderColor: "#ff6b35",
  },
  qualityButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#888",
  },
  qualityButtonTextActive: {
    color: "#ff6b35",
  },
  aboutText: {
    fontSize: 14,
    color: "#888",
    lineHeight: 22,
  },
  deviceInfo: {
    fontSize: 12,
    color: "#444",
    textAlign: "center",
    marginTop: 20,
  },
});
