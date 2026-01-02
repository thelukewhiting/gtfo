import { useState, useEffect } from "react";
import * as Location from "expo-location";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { usePushToken } from "./usePushToken";
import { BACKGROUND_LOCATION_TASK } from "../tasks/backgroundLocation";
import "../tasks/backgroundLocation";

export function useLocation() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { pushToken } = usePushToken();
  const updateLocation = useMutation(api.devices.updateLocation);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    async function startLocationUpdates() {
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
      try {
        let { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
        if (bgStatus !== "granted") {
          const result = await Location.requestBackgroundPermissionsAsync();
          bgStatus = result.status;
        }
        // If granted, enable background tracking by default
        if (bgStatus === "granted") {
          const bgEnabled = await AsyncStorage.getItem("backgroundTrackingEnabled");
          if (bgEnabled === null) {
            // First time - auto-enable since they granted permission
            await AsyncStorage.setItem("backgroundTrackingEnabled", "true");
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

      // Only start background tracking if user has enabled it in settings
      try {
        const bgEnabled = await AsyncStorage.getItem("backgroundTrackingEnabled");
        if (bgEnabled === "true") {
          const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
          if (bgStatus === "granted") {
            const hasStarted = await Location.hasStartedLocationUpdatesAsync(
              BACKGROUND_LOCATION_TASK
            );
            if (!hasStarted) {
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
            }
          }
        }
      } catch (error) {
        console.log("Background location updates not available:", error);
      }

      // Watch for location changes
      try {
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 1000,
            timeInterval: 60000,
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
  }, [pushToken]);

  return { location, errorMsg };
}
