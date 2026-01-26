import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";

type Quality = "Poor" | "Fair" | "Good" | "Great" | "Excellent";

interface Props {
  quality: Quality;
}

const QUALITY_COLORS: Record<Quality, string> = {
  Poor: "#666",
  Fair: "#f4a261",
  Good: "#e9c46a",
  Great: "#ff6b35",
  Excellent: "#ffd166",
};

const QUALITY_EMOJI: Record<Quality, string> = {
  Poor: "☁️",
  Fair: "🌤️",
  Good: "🌅",
  Great: "🔥",
  Excellent: "✨",
};

// Animation configs per quality level
const ANIMATION_CONFIG: Record<Quality, { duration: number; minOpacity: number; minScale: number }> = {
  Poor: { duration: 3000, minOpacity: 0.7, minScale: 1 },
  Fair: { duration: 2500, minOpacity: 0.8, minScale: 1 },
  Good: { duration: 2000, minOpacity: 0.85, minScale: 0.98 },
  Great: { duration: 1500, minOpacity: 0.9, minScale: 0.97 },
  Excellent: { duration: 1200, minOpacity: 0.85, minScale: 0.96 },
};

export default function QualityIndicator({ quality }: Props) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const config = ANIMATION_CONFIG[quality];

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: config.duration / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: config.duration / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [quality, pulseAnim]);

  const config = ANIMATION_CONFIG[quality];

  const animatedStyle = {
    opacity: pulseAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, config.minOpacity],
    }),
    transform: [
      {
        scale: pulseAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, config.minScale],
        }),
      },
    ],
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: QUALITY_COLORS[quality] + "20" },
        animatedStyle,
      ]}
    >
      <Text style={styles.emoji}>{QUALITY_EMOJI[quality]}</Text>
      <Text style={[styles.text, { color: QUALITY_COLORS[quality] }]}>
        {quality}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
    gap: 10,
  },
  emoji: {
    fontSize: 32,
  },
  text: {
    fontSize: 24,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 3,
  },
});
