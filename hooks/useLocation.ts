import { useState, useEffect, useCallback } from "react";
import * as Location from "expo-location";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { usePushToken } from "./usePushToken";
import { BACKGROUND_LOCATION_TASK } from "../tasks/backgroundLocation";
import "../tasks/backgroundLocation";

const MANUAL_LOCATION_KEY = "manualLocation";

export interface ManualLocationData {
  latitude: number;
  longitude: number;
  placeName: string;
}

export function useLocation() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualPlaceName, setManualPlaceName] = useState<string | null>(null);
  const [isBackgroundEnabled, setIsBackgroundEnabled] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { pushToken } = usePushToken();
  const updateLocation = useMutation(api.devices.updateLocation);

  const refreshLocation = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    async function startLocationUpdates() {
      // Check for manual mode first
      const manualDataStr = await AsyncStorage.getItem(MANUAL_LOCATION_KEY);
      if (manualDataStr) {
        try {
          const manualData: ManualLocationData = JSON.parse(manualDataStr);
          setIsManualMode(true);
          setManualPlaceName(manualData.placeName);
          // Create synthetic location object
          setLocation({
            coords: {
              latitude: manualData.latitude,
              longitude: manualData.longitude,
              altitude: null,
              accuracy: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: Date.now(),
          });
          setErrorMsg(null);
          return; // Skip GPS tracking in manual mode
        } catch {
          // Invalid stored data, clear it
          await AsyncStorage.removeItem(MANUAL_LOCATION_KEY);
        }
      }

      setIsManualMode(false);
      setManualPlaceName(null);

      // Check current permission status
      let { status } = await Location.getForegroundPermissionsAsync();

      // Request permission if not granted
      if (status !== "granted") {
        const result = await Location.requestForegroundPermissionsAsync();
        status = result.status;
      }

      if (status !== "granted") {
        setErrorMsg("Location permission not granted. Please enable in Settings.");
        return;
      }

      // Request background permission and auto-enable if granted
      let shouldEnableBackground = false;
      try {
        let { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
        if (bgStatus !== "granted") {
          const result = await Location.requestBackgroundPermissionsAsync();
          bgStatus = result.status;
        }
        // If granted, check if we should auto-enable
        if (bgStatus === "granted") {
          const bgEnabled = await AsyncStorage.getItem("backgroundTrackingEnabled");
          if (bgEnabled === null) {
            // First time - auto-enable since they granted permission
            await AsyncStorage.setItem("backgroundTrackingEnabled", "true");
            shouldEnableBackground = true;
          } else if (bgEnabled === "true") {
            shouldEnableBackground = true;
          }
        }
      } catch (error) {
        console.log("Background permission request failed:", error);
      }

      // Get initial location
      try {
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation(currentLocation);
        setErrorMsg(null);

        // Update backend with current location
        if (pushToken) {
          const timezone = Localization.getCalendars()[0]?.timeZone || "UTC";
          try {
            await updateLocation({
              pushToken,
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
              timezone,
            });
          } catch (e) {
            console.log("Failed to update location in backend:", e);
          }
        }
      } catch (error) {
        console.error("Failed to get location:", error);
        setErrorMsg("Failed to get current location. Please try again.");
        return;
      }

      // Start background tracking if enabled (either from settings or auto-enabled on first install)
      if (shouldEnableBackground) {
        try {
          const hasStarted = await Location.hasStartedLocationUpdatesAsync(
            BACKGROUND_LOCATION_TASK
          );
          if (!hasStarted) {
            await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
              accuracy: Location.Accuracy.Balanced,
              distanceInterval: 8000, // ~5 miles - sunset quality doesn't vary much within this
              timeInterval: 60 * 60 * 1000, // 1 hour max
              pausesUpdatesAutomatically: true,
              showsBackgroundLocationIndicator: true,
              foregroundService: {
                notificationTitle: "GTFO is tracking location",
                notificationBody: "Keeping sunset predictions accurate while you travel.",
              },
            });
          }
          setIsBackgroundEnabled(true);
        } catch (error) {
          console.log("Background location updates not available:", error);
          setIsBackgroundEnabled(false);
        }
      } else {
        // Check if background tracking is actually running
        try {
          const hasStarted = await Location.hasStartedLocationUpdatesAsync(
            BACKGROUND_LOCATION_TASK
          );
          setIsBackgroundEnabled(hasStarted);
        } catch {
          setIsBackgroundEnabled(false);
        }
      }

      // Watch for location changes
      try {
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 8000, // ~5 miles - match background interval
            timeInterval: 300000, // 5 minutes
          },
          async (newLocation) => {
            setLocation(newLocation);
            if (!pushToken) return;
            const timezone = Localization.getCalendars()[0]?.timeZone || "UTC";
            try {
              await updateLocation({
                pushToken,
                latitude: newLocation.coords.latitude,
                longitude: newLocation.coords.longitude,
                timezone,
              });
            } catch (e) {
              console.log("Failed to update location in backend:", e);
            }
          }
        );
      } catch (error) {
        console.log("Failed to watch position:", error);
      }
    }

    startLocationUpdates();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [pushToken, refreshTrigger]);

  return { location, errorMsg, isManualMode, manualPlaceName, isBackgroundEnabled, refreshLocation };
}
