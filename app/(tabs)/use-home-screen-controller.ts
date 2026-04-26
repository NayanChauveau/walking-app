import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";

import {
  createWalkRouteModule,
  type Coordinates,
  type RouteSelectionMode,
  type WalkRoute,
} from "@/src/modules/walk-route";
import type { TrackingSessionStats } from "@/src/modules/walk-route/application/use-cases/AggregateTrackingSessionStatsUseCase";
import type { RecentWalkCellsPort } from "@/src/modules/walk-route/application/ports/RecentWalkCellsPort";
import { createWalkHistoryModule } from "@/src/modules/walk-history";

const DEFAULT_USER_WEIGHT_KG = 70;
const WALKING_MET = 3.5;
const LOCAL_POI_DOWNLOAD_RADIUS_METERS = 2500;

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
  aggregateTrackingSessionStatsUseCase,
  ensureLocalPoiCoverageUseCase,
  generateWalkRouteUseCase,
  getLastKnownUserStartPointUseCase,
  getUserStartPointUseCase,
  resolveRouteSelectionUseCase,
  saveLastKnownUserStartPointUseCase,
} = createWalkRouteModule({
  mapboxAccessToken: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN!,
  recentWalkCells: recentWalkCellsPort,
});

function hasPositionChanged(previous: Coordinates | null, current: Coordinates): boolean {
  if (!previous) {
    return true;
  }

  const earthRadiusMeters = 6_371_000;
  const latitudeDiffRadians = ((current.latitude - previous.latitude) * Math.PI) / 180;
  const longitudeDiffRadians = ((current.longitude - previous.longitude) * Math.PI) / 180;
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

function estimateCaloriesBurned(durationSeconds: number): number {
  const durationHours = durationSeconds / 3600;
  return WALKING_MET * DEFAULT_USER_WEIGHT_KG * durationHours;
}

export function useHomeScreenController() {
  const [userCoordinates, setUserCoordinates] = useState<Coordinates | null>(null);
  const [route, setRoute] = useState<WalkRoute | null>(null);
  const [selectedRouteMode, setSelectedRouteMode] =
    useState<RouteSelectionMode>("novelty");
  const [isGenerating, setIsGenerating] = useState(false);
  const [, setIsSavingWalk] = useState(false);
  const [isGpsTracking, setIsGpsTracking] = useState(false);
  const [isCameraFollowingGps, setIsCameraFollowingGps] = useState(false);
  const [isMapInteracting, setIsMapInteracting] = useState(false);
  const [isStopTrackingModalVisible, setIsStopTrackingModalVisible] = useState(false);
  const [trackingStartTimestampMs, setTrackingStartTimestampMs] = useState<number | null>(
    null,
  );
  const [trackingStats, setTrackingStats] = useState<TrackingSessionStats>(
    aggregateTrackingSessionStatsUseCase.createInitialStats(),
  );
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
  const mapFollowResumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastManualCameraUpdateMsRef = useRef(0);

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
      await ensureLocalPoiCoverageUseCase.execute({
        center: startPoint,
        radiusMeters: LOCAL_POI_DOWNLOAD_RADIUS_METERS,
      });
      return startPoint;
    } catch (locationError) {
      console.error(locationError);
      if (locationError instanceof Error && locationError.message.includes("POI")) {
        setError(
          "Position trouvee, mais impossible de charger les donnees POI locales. Verifie la connexion.",
        );
      } else {
        setError("Position utilisateur indisponible.");
      }
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

  const selectedRoute = resolveRouteSelectionUseCase.resolveSelectedRoute({
    route,
    mode: selectedRouteMode,
  });
  const secondaryRouteGeometry =
    resolveRouteSelectionUseCase.resolveSecondaryRouteGeometry({
      route,
      mode: selectedRouteMode,
      isGpsTracking,
    });

  function getTrackedDurationSeconds(): number {
    if (!trackingStartTimestampMs) {
      return 0;
    }
    return Math.max(0, Math.round((Date.now() - trackingStartTimestampMs) / 1000));
  }

  async function handleGenerateRoute() {
    if (!userCoordinates) {
      setError("Position en cours de detection. Reessayez dans un instant.");
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);
      setSuccessMessage(null);
      await ensureLocalPoiCoverageUseCase.execute({
        center: userCoordinates,
        radiusMeters: LOCAL_POI_DOWNLOAD_RADIUS_METERS,
      });

      const generatedRoute = await generateWalkRouteUseCase.execute({
        start: userCoordinates,
        targetDurationMinutes: 60,
      });

      setRoute(generatedRoute);
      setSelectedRouteMode("novelty");
    } catch (generationError) {
      console.error(generationError);
      if (generationError instanceof Error && generationError.message.includes("POI")) {
        setError(
          "Impossible de charger les donnees POI locales. Verifie la connexion reseau et reessaie.",
        );
      } else {
        setError("Impossible de générer un parcours pour cette tentative.");
      }
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleStartGpsTracking() {
    if (!selectedRoute || isGpsTracking) {
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
      setGpsTrackedPath([]);
      setTrackingStats(aggregateTrackingSessionStatsUseCase.createInitialStats());
      setTrackingStartTimestampMs(Date.now());
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
          setTrackingStats((previousStats) =>
            aggregateTrackingSessionStatsUseCase.execute({
              routeGeometry: selectedRoute.geometry,
              currentSample: {
                coordinates: nextCoordinates,
                timestampMs: sampleTimestampMs,
              },
              previousStats,
            }),
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
    setTrackingStats(aggregateTrackingSessionStatsUseCase.createInitialStats());
    setTrackingStartTimestampMs(null);
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
    if (!selectedRoute) {
      setIsStopTrackingModalVisible(false);
      return;
    }

    const trackedDurationSeconds = getTrackedDurationSeconds();

    try {
      setIsSavingWalk(true);
      setError(null);
      setSuccessMessage(null);

      await completeWalkUseCase.execute({
        route: selectedRoute,
        actualPath: gpsTrackedPath.length > 1 ? gpsTrackedPath : undefined,
        actualDurationSeconds: trackedDurationSeconds,
        actualDistanceMeters: trackingStats.trackedDistanceMeters,
        averageSpeedKmh: trackingStats.averageSpeedKmh,
      });
      setSuccessMessage("Parcours enregistre. Bravo !");
      setRoute(null);
      setSelectedRouteMode("novelty");
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
    setSelectedRouteMode("novelty");
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

  function handleRoutePress(routeId: "primary" | "secondary") {
    setSelectedRouteMode((previous) =>
      resolveRouteSelectionUseCase.resolveModeFromPressedRoute({
        route,
        currentMode: previous,
        pressedRouteId: routeId,
        isGpsTracking,
      }),
    );
  }

  const trackedDurationSeconds = getTrackedDurationSeconds();

  return {
    userCoordinates,
    selectedRoute,
    secondaryRouteGeometry,
    isGenerating,
    isGpsTracking,
    isCameraFollowingGps,
    isMapInteracting,
    isStopTrackingModalVisible,
    isResolvingStartPoint,
    successMessage,
    error,
    trackingStats,
    trackedDurationSeconds,
    trackedDistanceKm: trackingStats.trackedDistanceMeters / 1000,
    estimatedCalories: estimateCaloriesBurned(trackedDurationSeconds),
    gpsTrackedCoordinates,
    manualCameraPosition,
    handleGenerateRoute,
    handleStartGpsTracking,
    handleRequestStopGpsTracking,
    handleAcceptStopTracking,
    handleDiscardTrackedWalk,
    handleClearHistoryForDebug,
    resolveUserStartPoint,
    setIsStopTrackingModalVisible,
    handleMapTouchStart,
    handleMapTouchEnd,
    handleMapCameraMove,
    handleRoutePress,
  };
}
