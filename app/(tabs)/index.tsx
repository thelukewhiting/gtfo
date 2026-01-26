import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Animated,
  Dimensions,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAction } from "convex/react";
import { useFocusEffect } from "expo-router";
import * as Location from "expo-location";
import { api } from "../../convex/_generated/api";
import { useLocation } from "../../hooks/useLocation";
import { usePushToken } from "../../hooks/usePushToken";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

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

type Quality = "Poor" | "Fair" | "Good" | "Great" | "Excellent";

// Color schemes - distinct for each quality
const QUALITY_GRADIENTS: Record<Quality, string[]> = {
  Poor: ["#1a1a2e", "#252538", "#1a1a2e"],
  Fair: ["#1a1a2e", "#2e2a3d", "#3d3555", "#1a1a2e"],
  Good: ["#1a1a2e", "#3d3520", "#4a4025", "#3a3520", "#1a1a2e"],
  Great: ["#1a1a2e", "#3d2a2a", "#553535", "#4a3030", "#1a1a2e"],
  Excellent: ["#1a1a2e", "#3d2a3d", "#553555", "#4a3048", "#1a1a2e"],
};

const QUALITY_ACCENT: Record<Quality, string> = {
  Poor: "#888",
  Fair: "#c9a87c",
  Good: "#e6b455",
  Great: "#ff7849",
  Excellent: "#ff9ef5",
};

const QUALITY_EMOJI: Record<Quality, string> = {
  Poor: "☁️",
  Fair: "🌤️",
  Good: "🌅",
  Great: "🔥",
  Excellent: "✨",
};

// DEBUG flags
const DEBUG_FORCE_ELAPSED = false;
const DEBUG_NO_TOMORROW = false;

// Floating particle component
function FloatingParticle({ quality, delay, index }: { quality: Quality; delay: number; index: number }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;

  const startX = useMemo(() => Math.random() * SCREEN_WIDTH, []);
  const startY = useMemo(() => SCREEN_HEIGHT * 0.4 + Math.random() * SCREEN_HEIGHT * 0.4, []);
  const driftX = useMemo(() => (Math.random() - 0.5) * 80, []);
  const duration = useMemo(() => 10000 + Math.random() * 8000, []);

  const particleColor = useMemo(() => {
    const colors: Record<Quality, string[]> = {
      Poor: ["rgba(136,136,136,0.2)", "rgba(100,100,120,0.15)"],
      Fair: ["rgba(201,168,124,0.25)", "rgba(180,150,100,0.2)"],
      Good: ["rgba(230,180,85,0.3)", "rgba(200,160,70,0.25)"],
      Great: ["rgba(255,120,73,0.35)", "rgba(255,150,100,0.3)"],
      Excellent: ["rgba(255,158,245,0.4)", "rgba(255,180,240,0.35)"],
    };
    return colors[quality][index % 2];
  }, [quality, index]);

  const size = useMemo(() => {
    const sizes: Record<Quality, number> = { Poor: 3, Fair: 4, Good: 5, Great: 6, Excellent: 8 };
    return sizes[quality] + Math.random() * 4;
  }, [quality]);

  useEffect(() => {
    const startAnimation = () => {
      translateY.setValue(0);
      translateX.setValue(0);
      opacity.setValue(0);
      scale.setValue(0.5);

      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -250 - Math.random() * 100,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: driftX,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(opacity, {
              toValue: 1,
              duration: duration * 0.15,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 1,
              duration: duration * 0.7,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: duration * 0.15,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(scale, {
              toValue: 1,
              duration: duration * 0.4,
              easing: Easing.out(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 0.2,
              duration: duration * 0.6,
              easing: Easing.in(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]).start(() => startAnimation());
    };

    startAnimation();
  }, [quality]);

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: startX,
          top: startY,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: particleColor,
          transform: [{ translateY }, { translateX }, { scale }],
          opacity,
        },
      ]}
    />
  );
}

// Sun arc with visible path
function SunArc({ sunsetTime, quality }: { sunsetTime: string; quality: Quality }) {
  const sunPosition = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.1)).current;

  useEffect(() => {
    const updatePosition = () => {
      const now = new Date();
      const sunset = new Date(sunsetTime);
      const sunrise = new Date(sunset);
      sunrise.setHours(sunrise.getHours() - 12);

      const totalDaylight = sunset.getTime() - sunrise.getTime();
      const elapsed = now.getTime() - sunrise.getTime();
      const progress = Math.max(0, Math.min(1, elapsed / totalDaylight));

      Animated.spring(sunPosition, {
        toValue: progress,
        useNativeDriver: true,
        tension: 20,
        friction: 10,
      }).start();
    };

    updatePosition();
    const interval = setInterval(updatePosition, 60000);
    return () => clearInterval(interval);
  }, [sunsetTime]);

  // Glow animation - smooth breathing effect
  useEffect(() => {
    const config: Record<Quality, { speed: number; maxScale: number; minOpacity: number; maxOpacity: number }> = {
      Poor: { speed: 5000, maxScale: 1.2, minOpacity: 0.1, maxOpacity: 0.2 },
      Fair: { speed: 4000, maxScale: 1.3, minOpacity: 0.15, maxOpacity: 0.3 },
      Good: { speed: 3000, maxScale: 1.4, minOpacity: 0.2, maxOpacity: 0.4 },
      Great: { speed: 2200, maxScale: 1.6, minOpacity: 0.25, maxOpacity: 0.5 },
      Excellent: { speed: 1800, maxScale: 1.8, minOpacity: 0.3, maxOpacity: 0.6 },
    };

    const { speed, maxScale, minOpacity, maxOpacity } = config[quality];

    // Set initial values to match animation start
    glowScale.setValue(1);
    glowOpacity.setValue(minOpacity);

    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(glowScale, {
            toValue: maxScale,
            duration: speed / 2,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glowScale, {
            toValue: 1,
            duration: speed / 2,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(glowOpacity, {
            toValue: maxOpacity,
            duration: speed / 2,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: minOpacity,
            duration: speed / 2,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [quality]);

  const sunColor = QUALITY_ACCENT[quality];
  const arcWidth = SCREEN_WIDTH - 60;
  const arcHeight = 55;

  // Generate arc dots
  const arcDots = useMemo(() => {
    const dots = [];
    const numDots = 24;
    for (let i = 0; i <= numDots; i++) {
      const t = i / numDots;
      const x = (t - 0.5) * arcWidth;
      const y = -Math.sin(t * Math.PI) * arcHeight;
      dots.push({ x, y, t });
    }
    return dots;
  }, [arcWidth, arcHeight]);

  return (
    <View style={styles.sunArcWrapper}>
      {/* Arc path - dotted line */}
      <View style={styles.arcContainer}>
        {arcDots.map((dot, i) => (
          <View
            key={i}
            style={[
              styles.arcDot,
              {
                left: arcWidth / 2 + dot.x,
                bottom: -dot.y,
                opacity: 0.15 + dot.t * 0.15,
              },
            ]}
          />
        ))}

        {/* Horizon line */}
        <View style={styles.horizonLine}>
          <LinearGradient
            colors={["transparent", "rgba(255,255,255,0.2)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {/* Sun */}
        <Animated.View
          style={[
            styles.sunContainer,
            {
              transform: [
                {
                  translateX: sunPosition.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-arcWidth / 2, arcWidth / 2],
                  }),
                },
                {
                  translateY: sunPosition.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, -arcHeight, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Outer glow */}
          <Animated.View
            style={[
              styles.sunOuterGlow,
              {
                backgroundColor: sunColor,
                opacity: glowOpacity,
                transform: [{ scale: glowScale }],
              },
            ]}
          />
          {/* Inner glow */}
          <Animated.View
            style={[
              styles.sunInnerGlow,
              {
                backgroundColor: sunColor,
                opacity: glowOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.5],
                }),
              },
            ]}
          />
          {/* Sun core */}
          <View style={[styles.sunCore, { backgroundColor: sunColor }]} />
        </Animated.View>
      </View>

      {/* Labels */}
      <View style={styles.arcLabels}>
        <Text style={styles.arcLabel}>sunrise</Text>
        <Text style={styles.arcLabel}>sunset</Text>
      </View>
    </View>
  );
}

// Countdown component
function Countdown({ sunsetTime, accentColor }: { sunsetTime: string; accentColor: string }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const sunset = new Date(sunsetTime);
      const diff = sunset.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft("Now!");
        setIsUrgent(true);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setIsUrgent(hours === 0 && minutes < 30);

      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${seconds}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [sunsetTime]);

  return (
    <View style={styles.countdownContainer}>
      <Text style={[styles.countdownTime, isUrgent && { color: accentColor }]}>{timeLeft}</Text>
      <Text style={styles.countdownLabel}>until sunset</Text>
    </View>
  );
}

export default function HomeScreen() {
  const { location, errorMsg, isManualMode, manualPlaceName, isBackgroundEnabled, refreshLocation } = useLocation();
  usePushToken();
  const [sunsetData, setSunsetData] = useState<SunsetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [lastGeocodedCoords, setLastGeocodedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isTomorrow, setIsTomorrow] = useState(false);

  const getSunsetQuality = useAction(api.sunsets.getSunsetQuality);

  // Refresh location and sunset data when tab gains focus (to pick up manual location changes from settings)
  const [focusTrigger, setFocusTrigger] = useState(0);
  useFocusEffect(
    useCallback(() => {
      refreshLocation();
      setFocusTrigger(prev => prev + 1);
    }, [refreshLocation])
  );

  // Use manual place name when in manual mode
  const displayPlaceName = isManualMode ? manualPlaceName : placeName;

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
      const todayData = await getSunsetQuality({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        date: getLocalDateString(),
      });

      const todaySunsetPassed =
        DEBUG_FORCE_ELAPSED || (todayData ? new Date(todayData.sunsetTime).getTime() < Date.now() : false);

      if (todaySunsetPassed) {
        const tomorrowData = DEBUG_NO_TOMORROW
          ? null
          : await getSunsetQuality({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              date: getLocalDateString(1),
            });

        if (tomorrowData) {
          setSunsetData(tomorrowData);
          setIsTomorrow(true);
        } else {
          setSunsetData(todayData);
          setIsTomorrow(false);
        }
      } else {
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

  const getDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  useEffect(() => {
    if (location) {
      fetchSunset();
      const shouldGeocode =
        !lastGeocodedCoords ||
        getDistanceKm(location.coords.latitude, location.coords.longitude, lastGeocodedCoords.lat, lastGeocodedCoords.lng) > 5;
      if (shouldGeocode && !isManualMode) {
        fetchPlaceName();
      }
    }
  }, [location, focusTrigger]);

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
      // Silently fail
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

  const formatTimeShort = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).replace(" ", "").toLowerCase();
  };

  const isElapsed =
    !isTomorrow && sunsetData
      ? DEBUG_FORCE_ELAPSED || new Date(sunsetData.sunsetTime).getTime() < Date.now()
      : false;

  const quality = sunsetData?.quality || "Poor";
  const accentColor = QUALITY_ACCENT[quality];
  const particleCount = { Poor: 5, Fair: 7, Good: 10, Great: 14, Excellent: 20 }[quality];

  if (errorMsg) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={QUALITY_GRADIENTS.Poor} style={StyleSheet.absoluteFill} />
        <View style={styles.centered}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Gradient background */}
      <LinearGradient
        colors={QUALITY_GRADIENTS[quality]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Floating particles */}
      {sunsetData &&
        !loading &&
        Array.from({ length: particleCount }).map((_, i) => (
          <FloatingParticle key={i} quality={quality} delay={i * 500} index={i} />
        ))}

      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accentColor} />}
          showsVerticalScrollIndicator={false}
        >

          {loading ? (
            <ActivityIndicator size="large" color={accentColor} style={styles.loader} />
          ) : sunsetData ? (
            <View style={[styles.content, isElapsed && styles.contentElapsed]}>
              {/* Badges */}
              <View style={styles.badgeRow}>
                {isElapsed && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>PAST SUNSET</Text>
                  </View>
                )}
                {sunsetData.isDemo && !isElapsed && (
                  <View style={[styles.badge, styles.demoBadge]}>
                    <Text style={styles.badgeText}>DEMO</Text>
                  </View>
                )}
              </View>

              {/* Prediction label */}
              <Text style={styles.predictionLabel}>
                {isTomorrow ? "Tomorrow's" : "Tonight's"} Prediction
              </Text>

              {/* HERO: Quality */}
              <View style={styles.heroSection}>
                <Text style={styles.heroEmoji}>{QUALITY_EMOJI[quality]}</Text>
                <Text style={[styles.heroQuality, { color: accentColor }]}>{quality}</Text>
              </View>

              {/* Sun arc */}
              {!isElapsed && <SunArc sunsetTime={sunsetData.sunsetTime} quality={quality} />}

              {/* Countdown - prominent */}
              {!isElapsed && <Countdown sunsetTime={sunsetData.sunsetTime} accentColor={accentColor} />}

              {/* Sunset time */}
              <View style={styles.sunsetTimeSection}>
                <Text style={styles.sunsetTimeLabel}>{isElapsed ? "Sunset was" : "Sunset"}</Text>
                <Text style={[styles.sunsetTime, { color: accentColor }]}>
                  {formatSunsetTime(sunsetData.sunsetTime)}
                </Text>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Hour times - compact inline display */}
              {!isElapsed && (sunsetData.goldenHourStart || sunsetData.blueHourStart) && (
                <View style={styles.hourTimesRow}>
                  {sunsetData.goldenHourStart && sunsetData.goldenHourEnd && (
                    <View style={styles.hourTimeItem}>
                      <Text style={[styles.hourTimeLabel, { color: "#e6a756" }]}>Golden</Text>
                      <Text style={styles.hourTimeValue}>
                        {formatTimeShort(sunsetData.goldenHourStart)}–{formatTimeShort(sunsetData.goldenHourEnd)}
                      </Text>
                    </View>
                  )}
                  {sunsetData.blueHourStart && sunsetData.blueHourEnd && (
                    <View style={styles.hourTimeItem}>
                      <Text style={[styles.hourTimeLabel, { color: "#5b8bd6" }]}>Blue</Text>
                      <Text style={styles.hourTimeValue}>
                        {formatTimeShort(sunsetData.blueHourStart)}–{formatTimeShort(sunsetData.blueHourEnd)}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Cloud cover */}
              {sunsetData.cloudCover !== undefined && (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Cloud cover</Text>
                  <Text style={styles.metaValue}>{sunsetData.cloudCover}%</Text>
                </View>
              )}

              {isElapsed && <Text style={styles.elapsedNote}>Tomorrow's forecast coming soon</Text>}

              <View style={styles.locationFooter}>
                {displayPlaceName && <Text style={styles.location}>{displayPlaceName}</Text>}
                {(isManualMode || isBackgroundEnabled) && (
                  <View style={styles.locationBadgeRow}>
                    {isManualMode && (
                      <View style={[styles.locationBadge, styles.manualBadge]}>
                        <Text style={styles.locationBadgeText}>MANUAL</Text>
                      </View>
                    )}
                    {isBackgroundEnabled && !isManualMode && (
                      <View style={[styles.locationBadge, styles.backgroundBadge]}>
                        <Text style={styles.locationBadgeText}>BACKGROUND</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.noData}>Unable to fetch sunset data</Text>
              <Text style={styles.noDataSub}>Pull down to refresh</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  locationFooter: {
    marginTop: "auto",
    alignItems: "center",
    paddingTop: 20,
  },
  location: {
    fontSize: 14,
    color: "rgba(255,255,255,0.4)",
  },
  loader: {
    marginTop: 100,
  },
  content: {
    flex: 1,
    alignItems: "center",
  },
  contentElapsed: {
    opacity: 0.6,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    minHeight: 24,
  },
  badge: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  demoBadge: {
    backgroundColor: "rgba(255,107,53,0.3)",
  },
  manualBadge: {
    backgroundColor: "rgba(107,155,255,0.3)",
  },
  badgeText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  locationBadgeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  locationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  locationBadgeText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  backgroundBadge: {
    backgroundColor: "rgba(100,200,100,0.3)",
  },
  predictionLabel: {
    fontSize: 16,
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 1,
    marginBottom: 8,
  },
  heroSection: {
    alignItems: "center",
    marginBottom: 40,
  },
  heroEmoji: {
    fontSize: 56,
    marginBottom: 4,
  },
  heroQuality: {
    fontSize: 42,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 6,
  },
  sunArcWrapper: {
    width: "100%",
    marginBottom: 16,
  },
  arcContainer: {
    width: "100%",
    height: 70,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  arcDot: {
    position: "absolute",
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#fff",
  },
  horizonLine: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  sunContainer: {
    position: "absolute",
    bottom: 0,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  sunOuterGlow: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  sunInnerGlow: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  sunCore: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  arcLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    marginTop: 8,
  },
  arcLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.3)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  countdownContainer: {
    alignItems: "center",
    marginBottom: 12,
  },
  countdownTime: {
    fontSize: 40,
    fontWeight: "300",
    color: "#fff",
    letterSpacing: 2,
  },
  countdownLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginTop: 4,
  },
  sunsetTimeSection: {
    alignItems: "center",
    marginBottom: 12,
  },
  sunsetTimeLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  sunsetTime: {
    fontSize: 24,
    fontWeight: "600",
    letterSpacing: 1,
  },
  divider: {
    width: 60,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginBottom: 12,
  },
  hourTimesRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    marginBottom: 12,
  },
  hourTimeItem: {
    alignItems: "center",
  },
  hourTimeLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  hourTimeValue: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    marginTop: 4,
  },
  metaLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.4)",
  },
  metaValue: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
  },
  noDataContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  noData: {
    fontSize: 18,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 8,
  },
  noDataSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.3)",
  },
  errorText: {
    fontSize: 16,
    color: "#ff6b6b",
    textAlign: "center",
  },
  elapsedNote: {
    fontSize: 14,
    color: "rgba(255,255,255,0.4)",
    marginTop: 20,
    fontStyle: "italic",
  },
  particle: {
    position: "absolute",
  },
});
