import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

export const BACKGROUND_LOCATION_TASK = "background-location-updates";
const PUSH_TOKEN_KEY = "expoPushToken";
const MANUAL_LOCATION_KEY = "manualLocation";
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
const convexClient = convexUrl ? new ConvexHttpClient(convexUrl) : null;

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.log("Background location task error:", error);
    return;
  }

  // Skip updates when in manual location mode
  const manualData = await AsyncStorage.getItem(MANUAL_LOCATION_KEY);
  if (manualData) {
    return;
  }

  if (!convexClient) {
    console.log("Missing EXPO_PUBLIC_CONVEX_URL for background updates");
    return;
  }

  const taskData = data as { locations?: Location.LocationObject[] } | undefined;
  const locations = taskData?.locations;
  if (!locations || locations.length === 0) return;

  const latest = locations[locations.length - 1];
  const pushToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  if (!pushToken) return;

  const timezone = Localization.getCalendars()[0]?.timeZone || "UTC";

  try {
    await convexClient.mutation(api.devices.updateLocation, {
      pushToken,
      latitude: latest.coords.latitude,
      longitude: latest.coords.longitude,
      timezone,
    });
  } catch (err) {
    console.log("Failed to update location in background:", err);
  }
});
