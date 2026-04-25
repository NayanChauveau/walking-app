import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { Button, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Map from "@/components/map";

import {
  createWalkRouteModule,
  type Coordinates,
  type WalkRoute,
} from "@/src/modules/walk-route";

export default function HomeScreen() {
  const [userCoordinates, setUserCoordinates] = useState<Coordinates | null>(
    null,
  );

  const [route, setRoute] = useState<WalkRoute | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // init module une seule fois
  const { generateWalkRouteUseCase } = createWalkRouteModule({
    openRouteServiceApiKey: process.env.EXPO_PUBLIC_OPENROUTESERVICE_API_KEY!,
  });

  useEffect(() => {
    async function loadUserLocation() {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setError("Permission de localisation refusée.");
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setUserCoordinates({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    }

    loadUserLocation();
  }, []);

  async function handleGenerateRoute() {
    if (!userCoordinates) {
      setError("Position utilisateur indisponible.");
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);

      const generatedRoute = await generateWalkRouteUseCase.execute({
        start: userCoordinates,
        targetDurationMinutes: 60,
      });

      setRoute(generatedRoute);
    } catch (error) {
      console.error(error);
      setError("Impossible de générer un parcours pour cette tentative.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
      <Button
        title={isGenerating ? "Génération..." : "Générer un parcours"}
        onPress={handleGenerateRoute}
        disabled={isGenerating || !userCoordinates}
      />

      {error ? <Text>{error}</Text> : null}

      {route ? (
        <Text>
          Distance : {(route.distanceMeters / 1000).toFixed(1)} km · Durée :{" "}
          {Math.round(route.durationSeconds / 60)} min
        </Text>
      ) : null}

      <Map
        userCoordinates={userCoordinates}
        routeGeometry={route?.geometry ?? []}
      />
    </SafeAreaView>
  );
}
