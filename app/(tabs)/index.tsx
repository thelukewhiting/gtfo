import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAction, useQuery } from "convex/react";
import * as Location from "expo-location";
import { api } from "../../convex/_generated/api";
import { useLocation } from "../../hooks/useLocation";
import { usePushToken } from "../../hooks/usePushToken";
import QualityIndicator from "../../components/QualityIndicator";

interface SunsetData {
  quality: "Poor" | "Fair" | "Good" | "Great" | "Excellent";
  qualityPercent: number;
  sunsetTime: string;
  isDemo?: boolean;
  cloudCover?: number;
  sunsetAzimuth?: number;
  goldenHourStart?: string;
  goldenHourEnd?: string;
  blueHourStart?: string;
  blueHourEnd?: string;
}

// DEBUG: Set to true to test elapsed sunset state
const DEBUG_FORCE_ELAPSED = false;
// DEBUG: Set to true to simulate tomorrow's forecast not being available
const DEBUG_NO_TOMORROW = false;

export default function HomeScreen() {
  const { location, errorMsg } = useLocation();
  usePushToken(); // Initialize push notifications
  const [sunsetData, setSunsetData] = useState<SunsetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [lastGeocodedCoords, setLastGeocodedCoords] = useState<{lat: number, lng: number} | null>(null);
  const [isTomorrow, setIsTomorrow] = useState(false);

  const getSunsetQuality = useAction(api.sunsets.getSunsetQuality);

  const getLocalDateString = (offsetDays = 0) => {
    const now = new Date();
    now.setDate(now.getDate() + offsetDays);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const fetchSunset = async () => {
    if (!location) return;

    try {
      // First, fetch today's sunset
      const todayData = await getSunsetQuality({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        date: getLocalDateString(),
      });

      // Check if today's sunset has already passed
      const todaySunsetPassed = DEBUG_FORCE_ELAPSED || (todayData
        ? new Date(todayData.sunsetTime).getTime() < Date.now()
        : false);

      if (todaySunsetPassed) {
        // Try to fetch tomorrow's forecast
        const tomorrowData = DEBUG_NO_TOMORROW ? null : await getSunsetQuality({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          date: getLocalDateString(1),
        });

        if (tomorrowData) {
          // Tomorrow's forecast is available
          setSunsetData(tomorrowData);
          setIsTomorrow(true);
        } else {
          // Tomorrow's forecast not available, show today's (elapsed)
          setSunsetData(todayData);
          setIsTomorrow(false);
        }
      } else {
        // Today's sunset hasn't passed yet
        setSunsetData(todayData);
        setIsTomorrow(false);
      }
    } catch (error) {
      console.error("Failed to fetch sunset:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Calculate distance between two coordinates in km
  const getDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  useEffect(() => {
    if (location) {
      fetchSunset();
      // Only reverse geocode if moved >5km or first time
      const shouldGeocode = !lastGeocodedCoords ||
        getDistanceKm(
          location.coords.latitude,
          location.coords.longitude,
          lastGeocodedCoords.lat,
          lastGeocodedCoords.lng
        ) > 5;
      if (shouldGeocode) {
        fetchPlaceName();
      }
    }
  }, [location]);

  const fetchPlaceName = async () => {
    if (!location) return;
    try {
      const [place] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      if (place) {
        const name = place.city || place.subregion || place.region || place.country;
        setPlaceName(name || null);
        setLastGeocodedCoords({
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        });
      }
    } catch (error) {
      // Silently fail - place name is optional
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchSunset();
  };

  const formatSunsetTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Determine if we're showing an elapsed sunset (today's sunset that has passed)
  const isElapsed = !isTomorrow && sunsetData
    ? (DEBUG_FORCE_ELAPSED || new Date(sunsetData.sunsetTime).getTime() < Date.now())
    : false;

  // Determine subtitle text
  const getSubtitle = () => {
    if (isTomorrow) return "Tomorrow's Sunset";
    return "Tonight's Sunset";
  };

  if (errorMsg) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#ff6b35"
          />
        }
      >
        <Text style={styles.title}>GTFO</Text>
        <Text style={styles.subtitle}>{getSubtitle()}</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#ff6b35" style={styles.loader} />
        ) : sunsetData ? (
          <View style={[styles.card, isElapsed && styles.cardElapsed]}>
            {isElapsed && (
              <View style={styles.elapsedBadge}>
                <Text style={styles.elapsedBadgeText}>PAST SUNSET</Text>
              </View>
            )}
            {sunsetData.isDemo && !isElapsed && (
              <View style={styles.demoBadge}>
                <Text style={styles.demoBadgeText}>DEMO MODE</Text>
              </View>
            )}
            <View style={isElapsed ? { opacity: 0.5 } : undefined}>
              <QualityIndicator quality={sunsetData.quality} />
            </View>
            <Text style={[styles.percent, isElapsed && styles.textElapsed]}>
              {Math.round(sunsetData.qualityPercent)}%
            </Text>
            <Text style={styles.timeLabel}>
              {isElapsed ? "Sunset was at" : "Sunset at"}
            </Text>
            <Text style={[styles.time, isElapsed && styles.textElapsed]}>
              {formatSunsetTime(sunsetData.sunsetTime)}
            </Text>

            {sunsetData.cloudCover !== undefined && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Cloud Cover</Text>
                <Text style={styles.infoValue}>{sunsetData.cloudCover}%</Text>
              </View>
            )}

            {sunsetData.goldenHourStart && sunsetData.goldenHourEnd && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Golden Hour</Text>
                <Text style={styles.infoValue}>
                  {formatSunsetTime(sunsetData.goldenHourStart)} - {formatSunsetTime(sunsetData.goldenHourEnd)}
                </Text>
              </View>
            )}

            {sunsetData.blueHourStart && sunsetData.blueHourEnd && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Blue Hour</Text>
                <Text style={styles.infoValue}>
                  {formatSunsetTime(sunsetData.blueHourStart)} - {formatSunsetTime(sunsetData.blueHourEnd)}
                </Text>
              </View>
            )}

            {sunsetData.isDemo && !isElapsed && (
              <Text style={styles.demoNote}>
                Add SUNSETHUE_API_KEY for real data
              </Text>
            )}

            {isElapsed && (
              <Text style={styles.elapsedNote}>
                Tomorrow's forecast coming soon
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.noData}>
              Unable to fetch sunset data.{"\n"}
              Pull down to refresh.
            </Text>
          </View>
        )}

        {placeName && (
          <Text style={styles.location}>{placeName}</Text>
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
    flexGrow: 1,
    padding: 20,
    alignItems: "center",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#ff6b35",
    marginTop: 40,
    letterSpacing: 8,
  },
  subtitle: {
    fontSize: 18,
    color: "#888",
    marginTop: 8,
    marginBottom: 40,
  },
  loader: {
    marginTop: 60,
  },
  card: {
    backgroundColor: "#16213e",
    borderRadius: 20,
    padding: 30,
    width: "100%",
    alignItems: "center",
  },
  percent: {
    fontSize: 64,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 20,
  },
  timeLabel: {
    fontSize: 14,
    color: "#888",
    marginTop: 20,
  },
  time: {
    fontSize: 28,
    fontWeight: "600",
    color: "#fff",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#2a3a5e",
  },
  infoLabel: {
    fontSize: 14,
    color: "#888",
  },
  infoValue: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "500",
  },
  noData: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    lineHeight: 24,
  },
  location: {
    fontSize: 14,
    color: "#888",
    marginTop: 30,
  },
  errorText: {
    fontSize: 16,
    color: "#ff6b6b",
    textAlign: "center",
  },
  demoBadge: {
    backgroundColor: "#ff6b35",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  demoBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  demoNote: {
    fontSize: 12,
    color: "#666",
    marginTop: 16,
  },
  cardElapsed: {
    opacity: 0.85,
    borderWidth: 1,
    borderColor: "#2a3a5e",
  },
  elapsedBadge: {
    backgroundColor: "#4a4a5e",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  elapsedBadgeText: {
    color: "#aaa",
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  textElapsed: {
    opacity: 0.6,
  },
  elapsedNote: {
    fontSize: 13,
    color: "#888",
    marginTop: 20,
    fontStyle: "italic",
  },
});
