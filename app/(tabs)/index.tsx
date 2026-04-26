import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Button,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";

import Map from "@/components/map";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
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
} from "@/src/modules/walk-history";

const {
  clearWalkHistoryUseCase,
  completeWalkUseCase,
  getRecentWalkCellsUseCase,
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

const DEFAULT_USER_WEIGHT_KG = 70;
const WALKING_MET = 3.5;

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  const [userCoordinates, setUserCoordinates] = useState<Coordinates | null>(
    null,
  );

  const [route, setRoute] = useState<WalkRoute | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [, setIsSavingWalk] = useState(false);
  const [isGpsTracking, setIsGpsTracking] = useState(false);
  const [isCameraFollowingGps, setIsCameraFollowingGps] = useState(false);
  const [isMapInteracting, setIsMapInteracting] = useState(false);
  const [isStopTrackingModalVisible, setIsStopTrackingModalVisible] = useState(false);
  const [trackingStartTimestampMs, setTrackingStartTimestampMs] = useState<number | null>(
    null,
  );
  const [trackedDistanceMeters, setTrackedDistanceMeters] = useState(0);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0);
  const [averageTrackedSpeedKmh, setAverageTrackedSpeedKmh] = useState(0);
  const [gpsProgressPercent, setGpsProgressPercent] = useState(0);
  const [traversedRouteIndex, setTraversedRouteIndex] = useState(0);
  const [gpsTrackedPath, setGpsTrackedPath] = useState<Coordinates[]>([]);
  const [manualCameraPosition, setManualCameraPosition] = useState<{
    coordinates: Coordinates;
    zoom: number;
  } | null>(null);
  const [gpsTrackedCoordinates, setGpsTrackedCoordinates] =
    useState<Coordinates | null>(null);
  const [gpsSubscription, setGpsSubscription] =
    useState<Location.LocationSubscription | null>(null);
  const [isResolvingStartPoint, setIsResolvingStartPoint] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastTrackedSampleRef = useRef<{
    coordinates: Coordinates;
    timestampMs: number;
  } | null>(null);
  const trackingSpeedSamplesRef = useRef<number[]>([]);
  const mapFollowResumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastManualCameraUpdateMsRef = useRef(0);

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

  function findNearestGeometryIndex(
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

    return nearestIndex;
  }

  function computeProgressPercent(geometry: Coordinates[], nearestIndex: number): number {
    if (geometry.length <= 1) {
      return 0;
    }

    const progress = (nearestIndex / (geometry.length - 1)) * 100;
    return Math.max(0, Math.min(100, progress));
  }

  function getTrackedDurationSeconds(): number {
    if (!trackingStartTimestampMs) {
      return 0;
    }
    return Math.max(0, Math.round((Date.now() - trackingStartTimestampMs) / 1000));
  }

  function estimateCaloriesBurned(durationSeconds: number): number {
    const durationHours = durationSeconds / 3600;
    return WALKING_MET * DEFAULT_USER_WEIGHT_KG * durationHours;
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
      setTraversedRouteIndex(0);
      setGpsTrackedPath([]);
      setTrackedDistanceMeters(0);
      setCurrentSpeedKmh(0);
      setAverageTrackedSpeedKmh(0);
      setTrackingStartTimestampMs(Date.now());
      lastTrackedSampleRef.current = null;
      trackingSpeedSamplesRef.current = [];
      setManualCameraPosition(null);
      setIsGpsTracking(true);
      setIsCameraFollowingGps(true);

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 3,
        },
        (position) => {
          const sampleTimestampMs =
            typeof position.timestamp === "number" ? position.timestamp : Date.now();
          const nextCoordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setGpsTrackedCoordinates(nextCoordinates);
          setGpsTrackedPath((previousPath) => [...previousPath, nextCoordinates]);

          const previousSample = lastTrackedSampleRef.current;
          if (previousSample) {
            const segmentDistanceMeters = getDistanceMeters(
              previousSample.coordinates,
              nextCoordinates,
            );
            const elapsedSeconds = Math.max(
              0.001,
              (sampleTimestampMs - previousSample.timestampMs) / 1000,
            );
            const instantSpeedKmh = (segmentDistanceMeters / elapsedSeconds) * 3.6;
            const boundedInstantSpeedKmh = Math.min(25, Math.max(0, instantSpeedKmh));

            setTrackedDistanceMeters((previousDistance) => {
              const nextDistance = previousDistance + segmentDistanceMeters;
              return nextDistance;
            });
            setCurrentSpeedKmh(boundedInstantSpeedKmh);
            trackingSpeedSamplesRef.current.push(boundedInstantSpeedKmh);
            const samples = trackingSpeedSamplesRef.current;
            const averageSpeed =
              samples.reduce((sum, value) => sum + value, 0) / samples.length;
            setAverageTrackedSpeedKmh(averageSpeed);
          }

          lastTrackedSampleRef.current = {
            coordinates: nextCoordinates,
            timestampMs: sampleTimestampMs,
          };
          const nearestRouteIndex = findNearestGeometryIndex(
            route.geometry,
            nextCoordinates,
          );
          setTraversedRouteIndex(nearestRouteIndex);
          setGpsProgressPercent(
            computeProgressPercent(route.geometry, nearestRouteIndex),
          );
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

  function resetTrackingState() {
    setGpsTrackedCoordinates(null);
    setGpsTrackedPath([]);
    setGpsProgressPercent(0);
    setTraversedRouteIndex(0);
    setTrackedDistanceMeters(0);
    setCurrentSpeedKmh(0);
    setAverageTrackedSpeedKmh(0);
    setTrackingStartTimestampMs(null);
    lastTrackedSampleRef.current = null;
    trackingSpeedSamplesRef.current = [];
    setManualCameraPosition(null);
  }

  function handleRequestStopGpsTracking() {
    if (!isGpsTracking) {
      return;
    }

    handleStopGpsTracking();
    setIsStopTrackingModalVisible(true);
  }

  async function handleAcceptStopTracking() {
    if (!route) {
      setIsStopTrackingModalVisible(false);
      return;
    }

    const trackedDurationSeconds = getTrackedDurationSeconds();

    try {
      setIsSavingWalk(true);
      setError(null);
      setSuccessMessage(null);

      await completeWalkUseCase.execute({
        route,
        actualPath: gpsTrackedPath.length > 1 ? gpsTrackedPath : undefined,
        actualDurationSeconds: trackedDurationSeconds,
        actualDistanceMeters: trackedDistanceMeters,
        averageSpeedKmh: averageTrackedSpeedKmh,
      });
      setSuccessMessage("Parcours enregistre. Bravo !");
      setRoute(null);
      resetTrackingState();
    } catch (storageError) {
      console.error(storageError);
      setError("Impossible d'enregistrer ce parcours.");
    } finally {
      setIsSavingWalk(false);
      setIsStopTrackingModalVisible(false);
    }
  }

  function handleDiscardTrackedWalk() {
    setRoute(null);
    resetTrackingState();
    setSuccessMessage("Parcours supprime.");
    setError(null);
    setIsStopTrackingModalVisible(false);
  }

  async function handleClearHistoryForDebug() {
    try {
      setError(null);
      setSuccessMessage(null);
      await clearWalkHistoryUseCase.execute();
      setSuccessMessage("Historique vide (debug).");
    } catch (clearError) {
      console.error(clearError);
      setError("Impossible de vider l'historique.");
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
    setManualCameraPosition((previous) => {
      if (previous) {
        return previous;
      }

      if (gpsTrackedCoordinates) {
        return {
          coordinates: gpsTrackedCoordinates,
          zoom: 17,
        };
      }

      return previous;
    });
    if (mapFollowResumeTimeoutRef.current) {
      clearTimeout(mapFollowResumeTimeoutRef.current);
      mapFollowResumeTimeoutRef.current = null;
    }
  }

  function handleMapTouchEnd() {
    setIsMapInteracting(false);
  }

  function handleMapCameraMove(camera: {
    coordinates: Coordinates;
    zoom: number;
  }) {
    if (!isGpsTracking) {
      return;
    }

    if (!isCameraFollowingGps) {
      const now = Date.now();
      if (now - lastManualCameraUpdateMsRef.current < 120) {
        return;
      }
      lastManualCameraUpdateMsRef.current = now;
      setManualCameraPosition(camera);
      if (mapFollowResumeTimeoutRef.current) {
        clearTimeout(mapFollowResumeTimeoutRef.current);
      }
      mapFollowResumeTimeoutRef.current = setTimeout(() => {
        setIsCameraFollowingGps(true);
        setManualCameraPosition(null);
        mapFollowResumeTimeoutRef.current = null;
      }, 4000);
    }
  }

  const trackedDurationSeconds = getTrackedDurationSeconds();
  const trackedDistanceKm = trackedDistanceMeters / 1000;
  const estimatedCalories = estimateCaloriesBurned(trackedDurationSeconds);

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
          onPress={isGpsTracking ? handleRequestStopGpsTracking : handleStartGpsTracking}
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
        {isGpsTracking ? (
          <Text style={{ color: theme.text }}>
            Distance: {trackedDistanceKm.toFixed(2)} km · Temps:{" "}
            {Math.round(trackedDurationSeconds / 60)} min · Vitesse:{" "}
            {currentSpeedKmh.toFixed(1)} km/h
          </Text>
        ) : null}
        {isGpsTracking && !isCameraFollowingGps ? (
          <Text style={{ color: theme.text }}>
            Recentrage auto dans 4 secondes...
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
              traversedUntilIndex={route ? traversedRouteIndex : 0}
              cameraOverride={
                isGpsTracking && isCameraFollowingGps && gpsTrackedCoordinates
                  ? {
                      coordinates: gpsTrackedCoordinates,
                      zoom: 17,
                    }
                  : isGpsTracking && !isCameraFollowingGps && manualCameraPosition
                    ? manualCameraPosition
                  : null
              }
              onCameraMove={handleMapCameraMove}
            />
          </View>
          </>
        )}

        {__DEV__ ? (
          <Button
            title="DEBUG: Vider tout l'historique"
            onPress={handleClearHistoryForDebug}
          />
        ) : null}
      </ScrollView>
      <Modal
        visible={isStopTrackingModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setIsStopTrackingModalVisible(false)}
      >
        <ThemedView style={styles.modalBackdrop}>
          <ThemedView style={styles.modalCard}>
            <ThemedText type="title">Arreter ce parcours ?</ThemedText>
            <ThemedText>Distance: {trackedDistanceKm.toFixed(2)} km</ThemedText>
            <ThemedText>
              Temps total: {Math.round(trackedDurationSeconds / 60)} min
            </ThemedText>
            <ThemedText>
              Vitesse moyenne: {averageTrackedSpeedKmh.toFixed(1)} km/h
            </ThemedText>
            <ThemedText>
              Calories estimees: {Math.round(estimatedCalories)} kcal
            </ThemedText>
            <View style={styles.modalButtonsRow}>
              <Pressable onPress={handleAcceptStopTracking} style={styles.acceptButton}>
                <Text style={styles.buttonText}>Accepter</Text>
              </Pressable>
              <Pressable onPress={handleDiscardTrackedWalk} style={styles.deleteButton}>
                <Text style={styles.buttonText}>Supprimer</Text>
              </Pressable>
            </View>
          </ThemedView>
        </ThemedView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalCard: {
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  modalButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: "#3fb950",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  deleteButton: {
    flex: 1,
    backgroundColor: "#ff4d4f",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
