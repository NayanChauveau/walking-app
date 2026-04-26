import { useEffect, useState } from "react";
import { ActivityIndicator, Button, ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Map from "@/components/map";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

import {
  createWalkRouteModule,
  type Coordinates,
  type WalkRoute,
} from "@/src/modules/walk-route";
import type { RecentWalkCellsPort } from "@/src/modules/walk-route/application/ports/RecentWalkCellsPort";
import {
  createWalkHistoryModule,
  type WalkInsights,
} from "@/src/modules/walk-history";

const {
  completeWalkUseCase,
  getRecentWalkCellsUseCase,
  getWalkInsightsUseCase,
} = createWalkHistoryModule();

const recentWalkCellsPort: RecentWalkCellsPort = {
  async listRecentTraversedCells(limit: number) {
    return getRecentWalkCellsUseCase.execute({ limit });
  },
};

const {
  generateWalkRouteUseCase,
  getLastKnownUserStartPointUseCase,
  getUserStartPointUseCase,
  saveLastKnownUserStartPointUseCase,
} = createWalkRouteModule({
  openRouteServiceApiKey: process.env.EXPO_PUBLIC_OPENROUTESERVICE_API_KEY!,
  recentWalkCells: recentWalkCellsPort,
});

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  const [userCoordinates, setUserCoordinates] = useState<Coordinates | null>(
    null,
  );

  const [route, setRoute] = useState<WalkRoute | null>(null);
  const [insights, setInsights] = useState<WalkInsights>({
    totalWalks: 0,
    totalDistanceKm: 0,
    totalDurationMinutes: 0,
    averageDistanceKm: 0,
    averageDurationMinutes: 0,
    averageSpeedKmh: 0,
    lastWalkAtIso: null,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingWalk, setIsSavingWalk] = useState(false);
  const [isResolvingStartPoint, setIsResolvingStartPoint] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function hasPositionChanged(
    previous: Coordinates | null,
    current: Coordinates,
  ): boolean {
    if (!previous) {
      return true;
    }

    const earthRadiusMeters = 6_371_000;
    const latitudeDiffRadians =
      ((current.latitude - previous.latitude) * Math.PI) / 180;
    const longitudeDiffRadians =
      ((current.longitude - previous.longitude) * Math.PI) / 180;
    const previousLatitudeRadians = (previous.latitude * Math.PI) / 180;
    const currentLatitudeRadians = (current.latitude * Math.PI) / 180;

    const haversine =
      Math.sin(latitudeDiffRadians / 2) ** 2 +
      Math.cos(previousLatitudeRadians) *
        Math.cos(currentLatitudeRadians) *
        Math.sin(longitudeDiffRadians / 2) ** 2;

    const distanceMeters =
      2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

    return distanceMeters >= 15;
  }

  async function resolveUserStartPoint() {
    setIsResolvingStartPoint(true);

    try {
      const startPoint = await getUserStartPointUseCase.execute();
      setUserCoordinates((previousStartPoint) =>
        hasPositionChanged(previousStartPoint, startPoint)
          ? startPoint
          : previousStartPoint,
      );
      setError(null);

      await saveLastKnownUserStartPointUseCase.execute({ startPoint });
      return startPoint;
    } catch (locationError) {
      console.error(locationError);
      setError("Position utilisateur indisponible.");
      return null;
    } finally {
      setIsResolvingStartPoint(false);
    }
  }

  useEffect(() => {
    async function loadLastKnownUserLocation() {
      try {
        const lastKnownStartPoint =
          await getLastKnownUserStartPointUseCase.execute();

        if (lastKnownStartPoint) {
          setUserCoordinates(lastKnownStartPoint);
        }
      } catch (lastKnownLocationError) {
        console.error(lastKnownLocationError);
      }
    }

    async function loadUserLocation() {
      await resolveUserStartPoint();
    }

    loadLastKnownUserLocation();
    loadUserLocation();
  }, []);

  useEffect(() => {
    async function loadHistoryInsights() {
      try {
        const loadedInsights = await getWalkInsightsUseCase.execute();
        setInsights(loadedInsights);
      } catch (storageError) {
        console.error(storageError);
      }
    }

    loadHistoryInsights();
  }, []);

  async function handleGenerateRoute() {
    if (!userCoordinates) {
      setError("Position en cours de detection. Reessayez dans un instant.");
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);
      setSuccessMessage(null);

      const generatedRoute = await generateWalkRouteUseCase.execute({
        start: userCoordinates,
        targetDurationMinutes: 60,
      });

      setRoute(generatedRoute);
    } catch (generationError) {
      console.error(generationError);
      setError("Impossible de générer un parcours pour cette tentative.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleConfirmWalkCompletion() {
    if (!route) {
      return;
    }

    try {
      setIsSavingWalk(true);
      setError(null);
      setSuccessMessage(null);

      await completeWalkUseCase.execute({ route });
      const refreshedInsights = await getWalkInsightsUseCase.execute();
      setInsights(refreshedInsights);
      setSuccessMessage("Parcours enregistre. Bravo !");
      setRoute(null);
    } catch (storageError) {
      console.error(storageError);
      setError("Impossible d'enregistrer ce parcours.");
    } finally {
      setIsSavingWalk(false);
    }
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.background, paddingHorizontal: 16 }}
    >
      <ScrollView
        contentContainerStyle={{ paddingVertical: 16, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        <Button
          title={
            isGenerating
              ? "Generation..."
              : !userCoordinates
                ? "Localisation..."
                : "Generer un parcours"
          }
          onPress={handleGenerateRoute}
          disabled={isGenerating || !userCoordinates}
        />

        {error ? <Text style={{ color: "#ff4d4f" }}>{error}</Text> : null}
        {successMessage ? (
          <Text style={{ color: "#3fb950" }}>{successMessage}</Text>
        ) : null}

        <Text style={{ color: theme.text }}>
          Parcours termines: {insights.totalWalks} · Distance totale:{" "}
          {insights.totalDistanceKm.toFixed(1)} km
        </Text>
        <Text style={{ color: theme.text }}>
          Duree totale: {Math.round(insights.totalDurationMinutes)} min · Vitesse
          moyenne: {insights.averageSpeedKmh.toFixed(1)} km/h
        </Text>
        {insights.totalWalks > 0 ? (
          <Text style={{ color: theme.text }}>
            Moyenne par parcours: {insights.averageDistanceKm.toFixed(1)} km /{" "}
            {Math.round(insights.averageDurationMinutes)} min
          </Text>
        ) : null}

        {route ? (
          <Text style={{ color: theme.text }}>
            Distance : {(route.distanceMeters / 1000).toFixed(1)} km · Durée :{" "}
            {Math.round(route.durationSeconds / 60)} min
          </Text>
        ) : null}

        {!userCoordinates ? (
          <SafeAreaView
            style={{
              height: 500,
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            {error ? (
              <>
                <Text style={{ color: theme.text }}>
                  Impossible de recuperer votre position.
                </Text>
                <Button
                  title="Reessayer la localisation"
                  onPress={resolveUserStartPoint}
                />
              </>
            ) : (
              <>
                <ActivityIndicator size="large" color={theme.tint} />
                <Text style={{ color: theme.text }}>
                  Recherche de votre position en cours...
                </Text>
              </>
            )}
          </SafeAreaView>
        ) : (
          <>
            {isResolvingStartPoint ? (
              <Text style={{ color: theme.text }}>
                Mise a jour de votre position...
              </Text>
            ) : null}
          <Map
            userCoordinates={userCoordinates}
            routeGeometry={route?.geometry ?? []}
          />
          </>
        )}

        <Button
          title={isSavingWalk ? "Enregistrement..." : "Terminer le parcours"}
          onPress={handleConfirmWalkCompletion}
          disabled={!route || isSavingWalk}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
