import { useState, useEffect } from "react";
import * as Location from "expo-location";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { usePushToken } from "./usePushToken";

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

      // Get initial location
      try {
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation(currentLocation);
        setErrorMsg(null);

        // Update backend with current location
        if (pushToken) {
          try {
            await updateLocation({
              pushToken,
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
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
