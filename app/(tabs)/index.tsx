import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Button, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";

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
  mapboxAccessToken: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN!,
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
  const [isGpsTracking, setIsGpsTracking] = useState(false);
  const [isCameraFollowingGps, setIsCameraFollowingGps] = useState(false);
  const [isMapInteracting, setIsMapInteracting] = useState(false);
  const [gpsProgressPercent, setGpsProgressPercent] = useState(0);
  const [gpsTrackedCoordinates, setGpsTrackedCoordinates] =
    useState<Coordinates | null>(null);
  const [gpsSubscription, setGpsSubscription] =
    useState<Location.LocationSubscription | null>(null);
  const [isResolvingStartPoint, setIsResolvingStartPoint] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mapFollowResumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

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

  const resolveUserStartPoint = useCallback(async () => {
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
  }, []);

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
  }, [resolveUserStartPoint]);

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

  function getDistanceMeters(left: Coordinates, right: Coordinates): number {
    const earthRadiusMeters = 6_371_000;
    const latitudeDiffRadians = ((right.latitude - left.latitude) * Math.PI) / 180;
    const longitudeDiffRadians = ((right.longitude - left.longitude) * Math.PI) / 180;
    const leftLatitudeRadians = (left.latitude * Math.PI) / 180;
    const rightLatitudeRadians = (right.latitude * Math.PI) / 180;

    const haversine =
      Math.sin(latitudeDiffRadians / 2) ** 2 +
      Math.cos(leftLatitudeRadians) *
        Math.cos(rightLatitudeRadians) *
        Math.sin(longitudeDiffRadians / 2) ** 2;

    return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  }

  function computeProgressPercent(
    geometry: Coordinates[],
    current: Coordinates,
  ): number {
    if (geometry.length <= 1) {
      return 0;
    }

    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < geometry.length; index += 1) {
      const distance = getDistanceMeters(geometry[index], current);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    }

    const progress = (nearestIndex / (geometry.length - 1)) * 100;
    return Math.max(0, Math.min(100, progress));
  }

  async function handleStartGpsTracking() {
    if (!route || isGpsTracking) {
      return;
    }

    try {
      const permissionResult = await Location.requestForegroundPermissionsAsync();
      if (permissionResult.status !== "granted") {
        setError("Permission GPS requise pour demarrer le parcours.");
        return;
      }

      setError(null);
      setSuccessMessage(null);
      setGpsProgressPercent(0);
      setIsGpsTracking(true);
      setIsCameraFollowingGps(true);

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 3,
        },
        (position) => {
          const nextCoordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setGpsTrackedCoordinates(nextCoordinates);
          setGpsProgressPercent(computeProgressPercent(route.geometry, nextCoordinates));
        },
      );

      setGpsSubscription(subscription);
    } catch (trackingError) {
      console.error(trackingError);
      setIsGpsTracking(false);
      setError("Impossible de demarrer le suivi GPS.");
    }
  }

  function handleStopGpsTracking() {
    gpsSubscription?.remove();
    setGpsSubscription(null);
    setIsGpsTracking(false);
    setIsCameraFollowingGps(false);
    if (mapFollowResumeTimeoutRef.current) {
      clearTimeout(mapFollowResumeTimeoutRef.current);
      mapFollowResumeTimeoutRef.current = null;
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
      setGpsTrackedCoordinates(null);
      setGpsProgressPercent(0);
      handleStopGpsTracking();
    } catch (storageError) {
      console.error(storageError);
      setError("Impossible d'enregistrer ce parcours.");
    } finally {
      setIsSavingWalk(false);
    }
  }

  useEffect(() => {
    return () => {
      gpsSubscription?.remove();
      if (mapFollowResumeTimeoutRef.current) {
        clearTimeout(mapFollowResumeTimeoutRef.current);
      }
    };
  }, [gpsSubscription]);

  function handleMapTouchStart() {
    setIsMapInteracting(true);

    if (!isGpsTracking) {
      return;
    }

    setIsCameraFollowingGps(false);
    if (mapFollowResumeTimeoutRef.current) {
      clearTimeout(mapFollowResumeTimeoutRef.current);
    }
    mapFollowResumeTimeoutRef.current = setTimeout(() => {
      setIsCameraFollowingGps(true);
      mapFollowResumeTimeoutRef.current = null;
    }, 4000);
  }

  function handleMapTouchEnd() {
    setIsMapInteracting(false);
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.background, paddingHorizontal: 16 }}
    >
      <ScrollView
        contentContainerStyle={{ paddingVertical: 16, gap: 12 }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isMapInteracting}
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
          disabled={isGenerating || !userCoordinates || isGpsTracking}
        />
        <Button
          title={isGpsTracking ? "Arreter le suivi GPS" : "Demarrer le parcours GPS"}
          onPress={isGpsTracking ? handleStopGpsTracking : handleStartGpsTracking}
          disabled={!route}
        />

        {error ? <Text style={{ color: "#ff4d4f" }}>{error}</Text> : null}
        {successMessage ? (
          <Text style={{ color: "#3fb950" }}>{successMessage}</Text>
        ) : null}
        {isGpsTracking ? (
          <Text style={{ color: theme.text }}>
            Suivi GPS actif - progression sur la polyline choisie:{" "}
            {Math.round(gpsProgressPercent)}%
          </Text>
        ) : null}
        {isGpsTracking && !isCameraFollowingGps ? (
          <Text style={{ color: theme.text }}>
            Recentrage auto dans 4 secondes...
          </Text>
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
          <>
            <Text style={{ color: theme.text }}>
              Distance : {(route.distanceMeters / 1000).toFixed(1)} km · Durée :{" "}
              {Math.round(route.durationSeconds / 60)} min
            </Text>
            {route.scoring ? (
              <Text style={{ color: theme.text }}>
                Score global : {route.scoring.totalScore.toFixed(3)} · Loop:{" "}
                {route.scoring.loopQualityScore.toFixed(3)} · Novelty:{" "}
                {route.scoring.noveltyScore.toFixed(3)}
              </Text>
            ) : null}
          </>
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
          <View
            onTouchStart={handleMapTouchStart}
            onTouchEnd={handleMapTouchEnd}
            onTouchCancel={handleMapTouchEnd}
          >
            <Map
              userCoordinates={userCoordinates}
              routeGeometry={route?.geometry ?? []}
              cameraOverride={
                isGpsTracking && isCameraFollowingGps && gpsTrackedCoordinates
                  ? {
                      coordinates: gpsTrackedCoordinates,
                      zoom: 17,
                    }
                  : null
              }
            />
          </View>
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
