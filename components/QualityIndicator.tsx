import { View, Text, StyleSheet } from "react-native";

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

export default function QualityIndicator({ quality }: Props) {
  return (
    <View style={[styles.container, { backgroundColor: QUALITY_COLORS[quality] + "20" }]}>
      <Text style={styles.emoji}>{QUALITY_EMOJI[quality]}</Text>
      <Text style={[styles.text, { color: QUALITY_COLORS[quality] }]}>
        {quality}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  emoji: {
    fontSize: 24,
  },
  text: {
    fontSize: 18,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
});
