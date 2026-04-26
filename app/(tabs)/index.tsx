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

import Map from "@/components/map";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHomeScreenController } from "./use-home-screen-controller";

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const {
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
    trackedDistanceKm,
    estimatedCalories,
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
  } = useHomeScreenController();

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
          disabled={!selectedRoute}
        />

        {error ? <Text style={{ color: "#ff4d4f" }}>{error}</Text> : null}
        {successMessage ? (
          <Text style={{ color: "#3fb950" }}>{successMessage}</Text>
        ) : null}
        {isGpsTracking ? (
          <Text style={{ color: theme.text }}>
            Suivi GPS actif - progression sur la polyline choisie:{" "}
            {Math.round(trackingStats.progressPercent)}%
          </Text>
        ) : null}
        {isGpsTracking ? (
          <Text style={{ color: theme.text }}>
            Distance: {trackedDistanceKm.toFixed(2)} km · Temps:{" "}
            {Math.round(trackedDurationSeconds / 60)} min · Vitesse:{" "}
            {trackingStats.currentSpeedKmh.toFixed(1)} km/h
          </Text>
        ) : null}
        {isGpsTracking && !isCameraFollowingGps ? (
          <Text style={{ color: theme.text }}>
            Recentrage auto dans 4 secondes...
          </Text>
        ) : null}

        {selectedRoute ? (
          <>
            <Text style={{ color: theme.text }}>
              Distance : {(selectedRoute.distanceMeters / 1000).toFixed(1)} km · Durée :{" "}
              {Math.round(selectedRoute.durationSeconds / 60)} min
            </Text>
            {selectedRoute.scoring ? (
              <Text style={{ color: theme.text }}>
                Score global : {selectedRoute.scoring.totalScore.toFixed(3)} · Loop:{" "}
                {selectedRoute.scoring.loopQualityScore.toFixed(3)} · Novelty:{" "}
                {selectedRoute.scoring.noveltyScore.toFixed(3)} · POI:{" "}
                {selectedRoute.scoring.poiPleasureScore.toFixed(3)}
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
              routeGeometry={selectedRoute?.geometry ?? []}
              secondaryRouteGeometry={secondaryRouteGeometry}
              traversedUntilIndex={selectedRoute ? trackingStats.traversedRouteIndex : 0}
              onRoutePress={handleRoutePress}
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
              Vitesse moyenne: {trackingStats.averageSpeedKmh.toFixed(1)} km/h
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
