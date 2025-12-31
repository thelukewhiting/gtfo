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
import { api } from "../../convex/_generated/api";
import { useLocation } from "../../hooks/useLocation";
import { usePushToken } from "../../hooks/usePushToken";
import QualityIndicator from "../../components/QualityIndicator";

interface SunsetData {
  quality: "Poor" | "Fair" | "Good" | "Great";
  qualityPercent: number;
  sunsetTime: string;
  isDemo?: boolean;
}

export default function HomeScreen() {
  const { location, errorMsg } = useLocation();
  const { pushToken } = usePushToken();
  const [sunsetData, setSunsetData] = useState<SunsetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const getSunsetQuality = useAction(api.sunsets.getSunsetQuality);
  const device = useQuery(
    api.devices.getByToken,
    pushToken ? { pushToken } : "skip"
  );

  const fetchSunset = async () => {
    if (!location) return;

    try {
      const data = await getSunsetQuality({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      setSunsetData(data);
    } catch (error) {
      console.error("Failed to fetch sunset:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (location) {
      fetchSunset();
    }
  }, [location]);

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
        <Text style={styles.subtitle}>Tonight's Sunset</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#ff6b35" style={styles.loader} />
        ) : sunsetData ? (
          <View style={styles.card}>
            {sunsetData.isDemo && (
              <View style={styles.demoBadge}>
                <Text style={styles.demoBadgeText}>DEMO MODE</Text>
              </View>
            )}
            <QualityIndicator quality={sunsetData.quality} />
            <Text style={styles.percent}>
              {Math.round(sunsetData.qualityPercent)}%
            </Text>
            <Text style={styles.timeLabel}>Sunset at</Text>
            <Text style={styles.time}>
              {formatSunsetTime(sunsetData.sunsetTime)}
            </Text>
            {sunsetData.quality === "Great" || sunsetData.quality === "Good" ? (
              <Text style={styles.goOutside}>Time to find a spot!</Text>
            ) : (
              <Text style={styles.stayInside}>Maybe tomorrow...</Text>
            )}
            {sunsetData.isDemo && (
              <Text style={styles.demoNote}>
                Add SUNSETWX_API_KEY for real data
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

        {location && (
          <Text style={styles.location}>
            {location.coords.latitude.toFixed(2)}, {location.coords.longitude.toFixed(2)}
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
  goOutside: {
    fontSize: 18,
    color: "#ff6b35",
    marginTop: 30,
    fontWeight: "600",
  },
  stayInside: {
    fontSize: 18,
    color: "#666",
    marginTop: 30,
  },
  noData: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    lineHeight: 24,
  },
  location: {
    fontSize: 12,
    color: "#555",
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
});
