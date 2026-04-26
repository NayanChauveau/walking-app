import { useFocusEffect } from "@react-navigation/native";
import { AppleMaps, GoogleMaps } from "expo-maps";
import { useCallback, useState } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { CompletedWalk } from "@/src/modules/walk-history";
import { createAppModules } from "@/src/composition/createAppModules";

const { walkHistory } = createAppModules();
const { getCompletedWalksUseCase } = walkHistory;

function getCameraPositionForGeometry(geometry: CompletedWalk["polyline"]) {
  if (geometry.length === 0) {
    return null;
  }

  const latitudes = geometry.map((point) => point.latitude);
  const longitudes = geometry.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLng + maxLng) / 2;
  const latDelta = maxLat - minLat;
  const lngDelta = maxLng - minLng;
  const maxDelta = Math.max(latDelta, lngDelta) || 0.005;
  const zoom = Math.max(11, Math.min(17, Math.floor(Math.log2(360 / maxDelta))));

  return {
    coordinates: { latitude, longitude },
    zoom,
  };
}

function WalkHistoryMiniMap({ walk }: { walk: CompletedWalk }) {
  const cameraPosition = getCameraPositionForGeometry(walk.polyline);
  const markers =
    walk.polyline.length > 0
      ? [
          {
            id: `${walk.id}-start`,
            coordinates: walk.polyline[0],
            title: "Depart",
            tintColor: "#E53935",
          },
          {
            id: `${walk.id}-end`,
            coordinates: walk.polyline[walk.polyline.length - 1],
            title: "Arrivee",
            tintColor: "#E53935",
          },
        ]
      : [];
  const polylines =
    walk.polyline.length > 1
      ? [
          {
            id: `${walk.id}-polyline`,
            coordinates: walk.polyline,
            color: "#2F80ED",
            width: 6,
          },
        ]
      : [];

  if (!cameraPosition) {
    return <ThemedView style={styles.mapFallback} />;
  }

  if (Platform.OS === "ios") {
    return (
      <AppleMaps.View
        style={styles.miniMap}
        cameraPosition={cameraPosition}
        markers={markers}
        polylines={polylines}
      />
    );
  }

  if (Platform.OS === "android") {
    return (
      <GoogleMaps.View
        style={styles.miniMap}
        cameraPosition={cameraPosition}
        markers={markers}
        polylines={polylines}
      />
    );
  }

  return <ThemedView style={styles.mapFallback} />;
}

export default function ExploreScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const [walks, setWalks] = useState<CompletedWalk[]>([]);

  const loadWalks = useCallback(async () => {
    const completedWalks = await getCompletedWalksUseCase.execute();
    setWalks(completedWalks);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadWalks();
    }, [loadWalks]),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <ThemedText style={styles.headerEyebrow}>EXPLORE</ThemedText>
          <ThemedText type="title">Walking History</ThemedText>
          <ThemedText style={{ color: theme.icon }}>
            Replay your latest sessions with route, distance and speed insights.
          </ThemedText>
        </View>
        {walks.length === 0 ? (
          <ThemedView style={styles.emptyCard}>
            <ThemedText>Aucun parcours enregistre pour le moment.</ThemedText>
          </ThemedView>
        ) : (
          walks.map((walk) => (
            <ThemedView key={walk.id} style={styles.walkCard}>
              <WalkHistoryMiniMap walk={walk} />
              <View style={styles.metricsColumn}>
                <ThemedText type="defaultSemiBold">
                  {new Date(walk.completedAtIso).toLocaleString()}
                </ThemedText>
                <ThemedText>
                  Distance: {(walk.distanceMeters / 1000).toFixed(2)} km
                </ThemedText>
                <ThemedText>
                  Duree: {Math.round(walk.durationSeconds / 60)} min
                </ThemedText>
                <ThemedText>Vitesse: {walk.averageSpeedKmh.toFixed(1)} km/h</ThemedText>
              </View>
            </ThemedView>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
    paddingBottom: 120,
  },
  headerCard: {
    borderRadius: 20,
    padding: 16,
    gap: 8,
    backgroundColor: "#121A36",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  headerEyebrow: {
    fontSize: 12,
    letterSpacing: 1.2,
    color: "#8EA2FF",
    fontWeight: "700",
  },
  emptyCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(138,143,152,0.2)",
  },
  walkCard: {
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(138,143,152,0.2)",
  },
  miniMap: {
    width: 120,
    height: 90,
    borderRadius: 8,
  },
  mapFallback: {
    width: 120,
    height: 90,
    borderRadius: 8,
  },
  metricsColumn: {
    flex: 1,
    gap: 4,
  },
});
