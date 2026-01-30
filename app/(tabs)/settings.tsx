import { useState, useEffect, useRef } from "react";
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
import { useLocation, ManualLocationData } from "../../hooks/useLocation";
import { BACKGROUND_LOCATION_TASK } from "../../tasks/backgroundLocation";
import { LocationSearch } from "../../components/LocationSearch";

const MANUAL_LOCATION_KEY = "manualLocation";

const DEV_TAP_COUNT = 7;
const DEV_TAP_TIMEOUT = 3000; // 3 seconds to complete taps

type QualityLevel = "Fair" | "Good" | "Great";

interface DebugResult {
  success: boolean;
  device: {
    found: boolean;
    notifyMorning?: boolean;
    notifyHourBefore?: boolean;
    minQuality?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
  };
  sunset: {
    fetched: boolean;
    quality?: string;
    qualityPercent?: number;
    sunsetTime?: string;
    isDemo?: boolean;
    error?: string;
  };
  notification: {
    wouldSend: boolean;
    reason: string;
    threshold?: number;
  };
}

export default function SettingsScreen() {
  const { pushToken } = usePushToken();
  const { isManualMode, manualPlaceName, refreshLocation } = useLocation();
  const device = useQuery(
    api.devices.getByToken,
    pushToken ? { pushToken } : "skip"
  );
  const updatePreferences = useMutation(api.devices.updatePreferences);
  const updateLocationMode = useMutation(api.devices.updateLocationMode);
  const sendTestNotification = useAction(api.sunsets.sendTestNotification);
  const debugSunsetCheck = useAction(api.sunsets.debugSunsetCheck);

  const [notifyMorning, setNotifyMorning] = useState(true);
  const [notifyHourBefore, setNotifyHourBefore] = useState(true);
  const [notifyTenMinBefore, setNotifyTenMinBefore] = useState(true);
  const [minQuality, setMinQuality] = useState<QualityLevel>("Good");
  const [backgroundTracking, setBackgroundTracking] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null);
  const [devModeUnlocked, setDevModeUnlocked] = useState(false);
  const [manualLocationEnabled, setManualLocationEnabled] = useState(false);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [savedBackgroundTracking, setSavedBackgroundTracking] = useState<boolean | null>(null);

  const tapCountRef = useRef(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setManualLocationEnabled(isManualMode);
  }, [isManualMode]);

  useEffect(() => {
    if (device) {
      setNotifyMorning(device.notifyMorning);
      setNotifyHourBefore(device.notifyHourBefore);
      setNotifyTenMinBefore(device.notifyTenMinBefore ?? true);
      setMinQuality(device.minQuality);
    }
  }, [device]);

  useEffect(() => {
    // Check if dev mode was previously unlocked
    AsyncStorage.getItem("devModeUnlocked").then((value) => {
      if (value === "true") {
        setDevModeUnlocked(true);
      }
    });
  }, []);

  useEffect(() => {
    // Check if background tracking is enabled (based on user preference)
    const checkBackgroundStatus = async () => {
      try {
        const bgEnabled = await AsyncStorage.getItem("backgroundTrackingEnabled");
        setBackgroundTracking(bgEnabled === "true");
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

  const handleToggleTenMinBefore = async (value: boolean) => {
    setNotifyTenMinBefore(value);
    if (pushToken) {
      await updatePreferences({ pushToken, notifyTenMinBefore: value });
    }
  };

  const handleAboutTap = () => {
    tapCountRef.current += 1;

    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    if (tapCountRef.current >= DEV_TAP_COUNT) {
      setDevModeUnlocked(true);
      AsyncStorage.setItem("devModeUnlocked", "true");
      tapCountRef.current = 0;
    } else {
      tapTimeoutRef.current = setTimeout(() => {
        tapCountRef.current = 0;
      }, DEV_TAP_TIMEOUT);
    }
  };

  const handleQualityChange = async (quality: QualityLevel) => {
    setMinQuality(quality);
    if (pushToken) {
      await updatePreferences({ pushToken, minQuality: quality });
    }
  };

  const handleToggleBackgroundTracking = async (value: boolean) => {
    // Update state and preference immediately
    setBackgroundTracking(value);
    await AsyncStorage.setItem("backgroundTrackingEnabled", value ? "true" : "false");

    try {
      if (value) {
        const { status } = await Location.requestBackgroundPermissionsAsync();
        if (status === "granted") {
          await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
            accuracy: Location.Accuracy.Low,
            distanceInterval: 8000, // ~5 miles
            timeInterval: 60 * 60 * 1000, // 1 hour
            pausesUpdatesAutomatically: true,
            showsBackgroundLocationIndicator: false,
            // Defer updates to batch them and reduce wake-ups (approximates significant location changes)
            deferredUpdatesDistance: 500, // meters before batched update
            deferredUpdatesInterval: 15 * 60 * 1000, // 15 min minimum between batches
            foregroundService: {
              notificationTitle: "GTFO is tracking location",
              notificationBody: "Keeping sunset predictions accurate while you travel.",
            },
          });
        }
      } else {
        const hasStarted = await Location.hasStartedLocationUpdatesAsync(
          BACKGROUND_LOCATION_TASK
        );
        if (hasStarted) {
          await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        }
      }
    } catch (error) {
      console.log("Failed to toggle background tracking:", error);
    }
  };

  const handleToggleManualLocation = async (value: boolean) => {
    if (value) {
      // Save current background tracking state before disabling
      setSavedBackgroundTracking(backgroundTracking);
      // Show search modal to select location
      setShowLocationSearch(true);
    } else {
      // Switching back to auto mode
      setManualLocationEnabled(false);
      await AsyncStorage.removeItem(MANUAL_LOCATION_KEY);

      if (pushToken) {
        try {
          await updateLocationMode({
            pushToken,
            locationMode: "auto",
          });
        } catch (e) {
          console.log("Failed to update location mode:", e);
        }
      }

      // Restore background tracking state if it was enabled before
      const wasEnabled = await AsyncStorage.getItem("backgroundTrackingWasEnabled");
      if (wasEnabled === "true") {
        await handleToggleBackgroundTracking(true);
        await AsyncStorage.removeItem("backgroundTrackingWasEnabled");
      }

      refreshLocation();
    }
  };

  const handleLocationSelect = async (result: { latitude: number; longitude: number; placeName: string }) => {
    setShowLocationSearch(false);
    setManualLocationEnabled(true);

    // Save to AsyncStorage
    const manualData: ManualLocationData = {
      latitude: result.latitude,
      longitude: result.longitude,
      placeName: result.placeName,
    };
    await AsyncStorage.setItem(MANUAL_LOCATION_KEY, JSON.stringify(manualData));

    // Update backend
    if (pushToken) {
      try {
        await updateLocationMode({
          pushToken,
          locationMode: "manual",
          manualLatitude: result.latitude,
          manualLongitude: result.longitude,
          manualPlaceName: result.placeName,
        });
      } catch (e) {
        console.log("Failed to update location mode:", e);
      }
    }

    // Disable background tracking when in manual mode
    if (backgroundTracking) {
      await AsyncStorage.setItem("backgroundTrackingWasEnabled", "true");
      await handleToggleBackgroundTracking(false);
    }

    refreshLocation();
  };

  const handleLocationSearchClose = () => {
    setShowLocationSearch(false);
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

  const handleDebugCheck = async () => {
    if (!pushToken) return;

    setDebugLoading(true);
    try {
      const result = await debugSunsetCheck({ pushToken });
      setDebugResult(result);
    } catch (error) {
      console.error("Debug check failed:", error);
    } finally {
      setDebugLoading(false);
    }
  };

  const formatSunsetTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.appName}>GTFO</Text>
          <Text style={styles.appTagline}>Get The F*** Outside</Text>
        </View>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Morning Alert</Text>
              <Text style={styles.rowSubtitle}>
                Get notified around 11am local time
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
                Reminder 1 hour before sunset
              </Text>
            </View>
            <Switch
              value={notifyHourBefore}
              onValueChange={handleToggleHourBefore}
              trackColor={{ false: "#333", true: "#ff6b35" }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>10 Minute Reminder</Text>
              <Text style={styles.rowSubtitle}>
                Last call before sunset starts
              </Text>
            </View>
            <Switch
              value={notifyTenMinBefore}
              onValueChange={handleToggleTenMinBefore}
              trackColor={{ false: "#333", true: "#ff6b35" }}
              thumbColor="#fff"
            />
          </View>
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
              <Text style={styles.rowTitle}>Manual Location</Text>
              <Text style={styles.rowSubtitle}>
                Override GPS with a custom location
              </Text>
            </View>
            <Switch
              value={manualLocationEnabled}
              onValueChange={handleToggleManualLocation}
              trackColor={{ false: "#333", true: "#ff6b35" }}
              thumbColor="#fff"
            />
          </View>

          {manualLocationEnabled && manualPlaceName && (
            <View style={styles.manualLocationInfo}>
              <Text style={styles.manualLocationLabel}>Current location:</Text>
              <Text style={styles.manualLocationName}>{manualPlaceName}</Text>
              <TouchableOpacity
                style={styles.changeLocationButton}
                onPress={() => setShowLocationSearch(true)}
              >
                <Text style={styles.changeLocationText}>Change Location</Text>
              </TouchableOpacity>
            </View>
          )}

          {!manualLocationEnabled && (
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
          )}
        </View>

        <View style={styles.section}>
          <TouchableOpacity onPress={handleAboutTap} activeOpacity={1}>
            <Text style={styles.sectionTitle}>About</Text>
          </TouchableOpacity>
          <Text style={styles.aboutText}>
            GTFO uses Sunsethue to predict sunset quality based on cloud cover
            and atmospheric conditions. Predictions update daily.
          </Text>
        </View>

        {devModeUnlocked && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Debug</Text>
            <Text style={styles.sectionSubtitle}>
              Check why you did or didn't get a notification today
            </Text>

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

            <TouchableOpacity
              style={[styles.testButton, { marginTop: 12 }]}
              onPress={handleDebugCheck}
              disabled={debugLoading || !pushToken}
            >
              {debugLoading ? (
                <ActivityIndicator color="#ff6b35" size="small" />
              ) : (
                <Text style={styles.testButtonText}>Check Today's Sunset</Text>
              )}
            </TouchableOpacity>

            {debugResult && (
              <View style={styles.debugResults}>
                <View style={styles.debugCard}>
                  <Text style={styles.debugCardTitle}>Today's Prediction</Text>
                  {debugResult.sunset.fetched ? (
                    <>
                      <Text style={styles.debugQuality}>
                        {debugResult.sunset.quality} ({debugResult.sunset.qualityPercent}%)
                      </Text>
                      <Text style={styles.debugDetail}>
                        Sunset at {formatSunsetTime(debugResult.sunset.sunsetTime!)}
                      </Text>
                      {debugResult.sunset.isDemo && (
                        <Text style={styles.debugWarning}>Demo mode (API key not configured)</Text>
                      )}
                    </>
                  ) : (
                    <Text style={styles.debugError}>{debugResult.sunset.error}</Text>
                  )}
                </View>

                <View
                  style={[
                    styles.debugCard,
                    debugResult.notification.wouldSend
                      ? styles.debugCardSuccess
                      : styles.debugCardWarning,
                  ]}
                >
                  <Text style={styles.debugCardTitle}>Notification Status</Text>
                  <Text style={styles.debugStatus}>
                    {debugResult.notification.wouldSend ? "Would send" : "Would NOT send"}
                  </Text>
                  <Text style={styles.debugReason}>{debugResult.notification.reason}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {device && (
          <Text style={styles.deviceInfo}>
            Device registered: {device._id.slice(-8)}
          </Text>
        )}
      </ScrollView>
      <LocationSearch
        visible={showLocationSearch}
        onClose={handleLocationSearchClose}
        onSelect={handleLocationSelect}
      />
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
  header: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 24,
  },
  appName: {
    fontSize: 42,
    fontWeight: "bold",
    color: "#ff6b35",
    letterSpacing: 6,
  },
  appTagline: {
    fontSize: 13,
    color: "rgba(255,255,255,0.4)",
    marginTop: 4,
    letterSpacing: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 24,
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
  debugResults: {
    marginTop: 16,
    gap: 12,
  },
  debugCard: {
    backgroundColor: "#16213e",
    borderRadius: 12,
    padding: 16,
  },
  debugCardSuccess: {
    borderWidth: 2,
    borderColor: "#4a9c3e",
  },
  debugCardWarning: {
    borderWidth: 2,
    borderColor: "#c9a227",
  },
  debugCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#888",
    marginBottom: 8,
  },
  debugQuality: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  debugDetail: {
    fontSize: 14,
    color: "#888",
    marginTop: 4,
  },
  debugWarning: {
    fontSize: 12,
    color: "#c9a227",
    marginTop: 8,
  },
  debugError: {
    fontSize: 14,
    color: "#e74c3c",
  },
  debugStatus: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  debugReason: {
    fontSize: 14,
    color: "#888",
    marginTop: 4,
  },
  manualLocationInfo: {
    backgroundColor: "#16213e",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  manualLocationLabel: {
    fontSize: 12,
    color: "#888",
    marginBottom: 4,
  },
  manualLocationName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#fff",
    marginBottom: 12,
  },
  changeLocationButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#ff6b35",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  changeLocationText: {
    color: "#ff6b35",
    fontSize: 14,
    fontWeight: "600",
  },
});
