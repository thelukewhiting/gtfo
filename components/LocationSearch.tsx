import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Keyboard,
  Dimensions,
} from "react-native";
import * as Location from "expo-location";

const SCREEN_HEIGHT = Dimensions.get("window").height;

interface LocationResult {
  latitude: number;
  longitude: number;
  placeName: string;
}

interface LocationSearchProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (result: LocationResult) => void;
}

interface SearchResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

export function LocationSearch({ visible, onClose, onSelect }: LocationSearchProps) {
  const [searchText, setSearchText] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchText.trim()) return;

    Keyboard.dismiss();
    setSearching(true);
    setError(null);
    setResults([]);

    try {
      const geocoded = await Location.geocodeAsync(searchText.trim());

      if (geocoded.length === 0) {
        setError("No locations found. Try a different search.");
        setSearching(false);
        return;
      }

      const resultsWithNames: SearchResult[] = await Promise.all(
        geocoded.slice(0, 5).map(async (loc) => {
          try {
            const [place] = await Location.reverseGeocodeAsync({
              latitude: loc.latitude,
              longitude: loc.longitude,
            });
            const displayName = place
              ? [place.city, place.region, place.country].filter(Boolean).join(", ")
              : `${loc.latitude.toFixed(2)}, ${loc.longitude.toFixed(2)}`;
            return {
              latitude: loc.latitude,
              longitude: loc.longitude,
              displayName,
            };
          } catch {
            return {
              latitude: loc.latitude,
              longitude: loc.longitude,
              displayName: `${loc.latitude.toFixed(2)}, ${loc.longitude.toFixed(2)}`,
            };
          }
        })
      );

      setResults(resultsWithNames);
    } catch (err) {
      setError("Search failed. Please try again.");
      console.log("Geocoding error:", err);
    } finally {
      setSearching(false);
    }
  };

  const handleSelect = (result: SearchResult) => {
    onSelect({
      latitude: result.latitude,
      longitude: result.longitude,
      placeName: result.displayName,
    });
    setSearchText("");
    setResults([]);
  };

  const handleClose = () => {
    Keyboard.dismiss();
    setSearchText("");
    setResults([]);
    setError(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Search Location</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <TextInput
              style={styles.input}
              placeholder="Enter city or place name..."
              placeholderTextColor="#666"
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity
              style={[styles.searchButton, !searchText.trim() && styles.searchButtonDisabled]}
              onPress={handleSearch}
              disabled={!searchText.trim() || searching}
            >
              {searching ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.searchButtonText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          {searching && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#ff6b35" size="large" />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          )}

          {!searching && results.length > 0 && (
            <FlatList
              data={results}
              keyExtractor={(item, index) => `${item.latitude}-${item.longitude}-${index}`}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.resultItem} onPress={() => handleSelect(item)}>
                  <Text style={styles.resultText}>{item.displayName}</Text>
                  <Text style={styles.resultCoords}>
                    {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                  </Text>
                </TouchableOpacity>
              )}
              style={styles.resultsList}
            />
          )}

          {!searching && !error && results.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {searchText ? "Tap Search to find locations" : "Enter a city or place name"}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-start",
    paddingTop: SCREEN_HEIGHT * 0.12,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    backgroundColor: "#1a1a2e",
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 12,
    maxHeight: SCREEN_HEIGHT * 0.55,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: "#ff6b35",
    fontSize: 16,
  },
  searchRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    backgroundColor: "#16213e",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#fff",
  },
  searchButton: {
    backgroundColor: "#ff6b35",
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  error: {
    color: "#e74c3c",
    marginBottom: 12,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 30,
  },
  loadingText: {
    color: "#888",
    marginTop: 12,
    fontSize: 14,
  },
  emptyState: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 30,
  },
  emptyText: {
    color: "#666",
    fontSize: 14,
  },
  resultsList: {
    maxHeight: SCREEN_HEIGHT * 0.35,
  },
  resultItem: {
    backgroundColor: "#16213e",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  resultText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  resultCoords: {
    color: "#666",
    fontSize: 12,
    marginTop: 4,
  },
});
