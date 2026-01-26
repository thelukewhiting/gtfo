import { useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type Quality = "Poor" | "Fair" | "Good" | "Great" | "Excellent";

const QUALITIES: Quality[] = ["Poor", "Fair", "Good", "Great", "Excellent"];

// Distinct color schemes for each quality
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

// Floating particle component
function FloatingParticle({ quality, delay, index }: { quality: Quality; delay: number; index: number }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;

  const startX = useMemo(() => Math.random() * (SCREEN_WIDTH - 40), []);
  const startY = useMemo(() => 50 + Math.random() * 120, []);
  const driftX = useMemo(() => (Math.random() - 0.5) * 50, []);
  const duration = useMemo(() => 6000 + Math.random() * 4000, []);

  const particleColor = useMemo(() => {
    const colors: Record<Quality, string[]> = {
      Poor: ["rgba(136,136,136,0.3)", "rgba(100,100,120,0.2)"],
      Fair: ["rgba(201,168,124,0.35)", "rgba(180,150,100,0.25)"],
      Good: ["rgba(230,180,85,0.4)", "rgba(200,160,70,0.3)"],
      Great: ["rgba(255,120,73,0.45)", "rgba(255,150,100,0.35)"],
      Excellent: ["rgba(255,158,245,0.5)", "rgba(255,180,240,0.4)"],
    };
    return colors[quality][index % 2];
  }, [quality, index]);

  const size = useMemo(() => {
    const sizes: Record<Quality, number> = { Poor: 3, Fair: 4, Good: 5, Great: 6, Excellent: 8 };
    return sizes[quality] + Math.random() * 3;
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
            toValue: -100,
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
              duration: duration * 0.2,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 1,
              duration: duration * 0.6,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: duration * 0.2,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(scale, {
              toValue: 1,
              duration: duration * 0.5,
              easing: Easing.out(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 0.3,
              duration: duration * 0.5,
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
function SunArc({ quality, sunProgress }: { quality: Quality; sunProgress: number }) {
  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.3)).current;
  const sunPosition = useRef(new Animated.Value(sunProgress)).current;

  useEffect(() => {
    Animated.timing(sunPosition, {
      toValue: sunProgress,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [sunProgress]);

  useEffect(() => {
    const config: Record<Quality, { speed: number; maxScale: number; maxOpacity: number }> = {
      Poor: { speed: 5000, maxScale: 1.2, maxOpacity: 0.2 },
      Fair: { speed: 4000, maxScale: 1.3, maxOpacity: 0.3 },
      Good: { speed: 3000, maxScale: 1.4, maxOpacity: 0.4 },
      Great: { speed: 2200, maxScale: 1.6, maxOpacity: 0.5 },
      Excellent: { speed: 1800, maxScale: 1.8, maxOpacity: 0.6 },
    };

    const { speed, maxScale, maxOpacity } = config[quality];

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
            toValue: maxOpacity * 0.5,
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
  const arcWidth = SCREEN_WIDTH - 80;
  const arcHeight = 50;

  // Generate arc dots
  const arcDots = useMemo(() => {
    const dots = [];
    const numDots = 16;
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
      <View style={styles.arcContainer}>
        {/* Arc dots */}
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

        {/* Horizon */}
        <View style={styles.horizonLine}>
          <LinearGradient
            colors={["transparent", "rgba(255,255,255,0.15)", "transparent"]}
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
          <Animated.View
            style={[
              styles.sunInnerGlow,
              {
                backgroundColor: sunColor,
                opacity: glowOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.4],
                }),
              },
            ]}
          />
          <View style={[styles.sunCore, { backgroundColor: sunColor }]} />
        </Animated.View>
      </View>

      <View style={styles.arcLabels}>
        <Text style={styles.arcLabel}>AM</Text>
        <Text style={styles.arcLabel}>PM</Text>
      </View>
    </View>
  );
}

// Progress bar for golden/blue hour
function HourProgressBar({
  label,
  progress,
  status,
  color,
}: {
  label: string;
  progress: number;
  status: "upcoming" | "active" | "passed";
  color: string;
}) {
  return (
    <View style={[styles.hourBar, status === "passed" && styles.hourBarPassed]}>
      <View style={styles.hourBarHeader}>
        <Text style={[styles.hourBarLabel, status === "active" && { color }]}>
          {label} {status === "active" && "• NOW"}
        </Text>
      </View>
      <View style={styles.hourBarTrack}>
        <View
          style={[
            styles.hourBarFill,
            {
              backgroundColor: color,
              width: `${progress * 100}%`,
              opacity: status === "passed" ? 0.3 : 1,
            },
          ]}
        />
      </View>
    </View>
  );
}

// Single quality card
function QualityCard({ quality, sunProgress, hourStatus }: {
  quality: Quality;
  sunProgress: number;
  hourStatus: "upcoming" | "active" | "passed";
}) {
  const particleCount = { Poor: 3, Fair: 4, Good: 5, Great: 6, Excellent: 8 }[quality];
  const accentColor = QUALITY_ACCENT[quality];

  return (
    <View style={styles.cardWrapper}>
      <View style={styles.card}>
        <LinearGradient
          colors={QUALITY_GRADIENTS[quality]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        {/* Particles */}
        {Array.from({ length: particleCount }).map((_, i) => (
          <FloatingParticle key={i} quality={quality} delay={i * 300} index={i} />
        ))}

        {/* Quality display */}
        <View style={styles.qualitySection}>
          <Text style={styles.qualityEmoji}>{QUALITY_EMOJI[quality]}</Text>
          <Text style={[styles.qualityText, { color: accentColor }]}>{quality}</Text>
        </View>

        {/* Sun arc */}
        <SunArc quality={quality} sunProgress={sunProgress} />

        {/* Hour bars */}
        <HourProgressBar
          label="Golden Hour"
          progress={hourStatus === "upcoming" ? 0 : hourStatus === "passed" ? 1 : 0.5}
          status={hourStatus}
          color="#e6a756"
        />
        <HourProgressBar
          label="Blue Hour"
          progress={hourStatus === "upcoming" ? 0 : hourStatus === "passed" ? 1 : 0.3}
          status={hourStatus === "passed" ? "passed" : "upcoming"}
          color="#5b8bd6"
        />
      </View>

      {/* Color info */}
      <View style={styles.colorInfo}>
        <View style={[styles.colorSwatch, { backgroundColor: accentColor }]} />
        <Text style={styles.colorLabel}>{quality.toUpperCase()} — {accentColor}</Text>
      </View>
    </View>
  );
}

export default function TestScreen() {
  const [sunProgress, setSunProgress] = useState(0.3);
  const [hourStatus, setHourStatus] = useState<"upcoming" | "active" | "passed">("upcoming");

  // Cycle through sun positions
  useEffect(() => {
    const interval = setInterval(() => {
      setSunProgress((prev) => {
        const next = prev + 0.08;
        return next > 1 ? 0 : next;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Cycle through hour statuses
  useEffect(() => {
    const statuses: ("upcoming" | "active" | "passed")[] = ["upcoming", "active", "passed"];
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % statuses.length;
      setHourStatus(statuses[index]);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Visual Test</Text>
        <Text style={styles.subtitle}>All Quality States</Text>

        <View style={styles.statusBar}>
          <Text style={styles.statusText}>Sun: {Math.round(sunProgress * 100)}%</Text>
          <Text style={styles.statusText}>Hour: {hourStatus}</Text>
        </View>

        {QUALITIES.map((quality) => (
          <QualityCard
            key={quality}
            quality={quality}
            sunProgress={sunProgress}
            hourStatus={hourStatus}
          />
        ))}
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
    paddingBottom: 100,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ff6b35",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: "#888",
    textAlign: "center",
    marginBottom: 12,
  },
  statusBar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginBottom: 20,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    color: "#666",
    fontFamily: "monospace",
  },
  cardWrapper: {
    marginBottom: 20,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    overflow: "hidden",
    minHeight: 240,
  },
  colorInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    gap: 8,
  },
  colorSwatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  colorLabel: {
    fontSize: 11,
    color: "#666",
    letterSpacing: 1,
    fontFamily: "monospace",
  },
  qualitySection: {
    alignItems: "center",
    marginBottom: 8,
    zIndex: 10,
  },
  qualityEmoji: {
    fontSize: 40,
    marginBottom: 4,
  },
  qualityText: {
    fontSize: 24,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 4,
  },
  sunArcWrapper: {
    width: "100%",
    marginBottom: 16,
    zIndex: 10,
  },
  arcContainer: {
    width: "100%",
    height: 70,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  arcDot: {
    position: "absolute",
    width: 2,
    height: 2,
    borderRadius: 1,
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
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  sunOuterGlow: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  sunInnerGlow: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  sunCore: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  arcLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    marginTop: 6,
  },
  arcLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.3)",
    textTransform: "uppercase",
  },
  hourBar: {
    width: "100%",
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    padding: 10,
    zIndex: 10,
  },
  hourBarPassed: {
    opacity: 0.4,
  },
  hourBarHeader: {
    marginBottom: 6,
  },
  hourBarLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  hourBarTrack: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 2,
    overflow: "hidden",
  },
  hourBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  particle: {
    position: "absolute",
  },
});
