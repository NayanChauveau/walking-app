import {
  ActivityIndicator,
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
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isMapInteracting}
      >
        <View style={styles.heroCard}>
          <ThemedText style={styles.heroBadge}>URBAN WALK</ThemedText>
          <ThemedText type="title" style={styles.heroTitle}>
            Walk Smarter
          </ThemedText>
          <ThemedText style={{ color: theme.icon }}>
            Modern route generation with live GPS tracking and POI intelligence.
          </ThemedText>
          <View style={styles.actionsRow}>
            <Pressable
              style={[
                styles.primaryAction,
                (isGenerating || !userCoordinates || isGpsTracking) && styles.actionDisabled,
              ]}
              onPress={handleGenerateRoute}
              disabled={isGenerating || !userCoordinates || isGpsTracking}
            >
              <Text style={styles.primaryActionText}>
                {isGenerating
                  ? "Generation..."
                  : !userCoordinates
                    ? "Localisation..."
                    : "Generer un parcours"}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.secondaryAction,
                (!selectedRoute || false) && styles.actionDisabled,
              ]}
              onPress={isGpsTracking ? handleRequestStopGpsTracking : handleStartGpsTracking}
              disabled={!selectedRoute}
            >
              <Text style={styles.secondaryActionText}>
                {isGpsTracking ? "Stop GPS" : "Start GPS"}
              </Text>
            </Pressable>
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {successMessage ? (
          <Text style={styles.successText}>{successMessage}</Text>
        ) : null}
        {isGpsTracking ? (
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <ThemedText style={styles.metricLabel}>Progress</ThemedText>
              <ThemedText style={styles.metricValue}>
                {Math.round(trackingStats.progressPercent)}%
              </ThemedText>
            </View>
            <View style={styles.metricCard}>
              <ThemedText style={styles.metricLabel}>Distance</ThemedText>
              <ThemedText style={styles.metricValue}>{trackedDistanceKm.toFixed(2)} km</ThemedText>
            </View>
            <View style={styles.metricCard}>
              <ThemedText style={styles.metricLabel}>Speed</ThemedText>
              <ThemedText style={styles.metricValue}>
                {trackingStats.currentSpeedKmh.toFixed(1)} km/h
              </ThemedText>
            </View>
          </View>
        ) : null}
        {isGpsTracking && !isCameraFollowingGps ? (
          <Text style={{ color: theme.icon }}>Recentrage auto dans 4 secondes...</Text>
        ) : null}

        {selectedRoute ? (
          <View style={styles.routeCard}>
            <Text style={{ color: theme.text, fontWeight: "700", fontSize: 16 }}>
              Distance : {(selectedRoute.distanceMeters / 1000).toFixed(1)} km · Durée :{" "}
              {Math.round(selectedRoute.durationSeconds / 60)} min
            </Text>
            {selectedRoute.scoring ? (
              <Text style={{ color: theme.icon }}>
                Score global : {selectedRoute.scoring.totalScore.toFixed(3)} · Loop:{" "}
                {selectedRoute.scoring.loopQualityScore.toFixed(3)} · Novelty:{" "}
                {selectedRoute.scoring.noveltyScore.toFixed(3)} · POI:{" "}
                {selectedRoute.scoring.poiPleasureScore.toFixed(3)}
              </Text>
            ) : null}
          </View>
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
                <Pressable style={styles.retryButton} onPress={resolveUserStartPoint}>
                  <Text style={styles.retryButtonText}>Reessayer la localisation</Text>
                </Pressable>
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
            {isResolvingStartPoint ? <Text style={{ color: theme.icon }}>Mise a jour de votre position...</Text> : null}
          <View
            style={styles.mapCard}
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
          <Pressable style={styles.debugButton} onPress={handleClearHistoryForDebug}>
            <Text style={styles.debugButtonText}>DEBUG: Vider tout l historique</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <Modal
        visible={isStopTrackingModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsStopTrackingModalVisible(false)}
      >
        <ThemedView style={styles.modalBackdrop}>
          <ThemedView style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <ThemedText type="title" style={styles.modalTitle}>
                Arreter ce parcours ?
              </ThemedText>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setIsStopTrackingModalVisible(false)}
              >
                <Text style={styles.modalCloseButtonText}>Fermer</Text>
              </Pressable>
            </View>
            <View style={styles.modalStatGrid}>
              <View style={styles.modalStatCard}>
                <ThemedText style={styles.modalStatLabel}>Distance</ThemedText>
                <ThemedText style={styles.modalStatValue}>
                  {trackedDistanceKm.toFixed(2)} km
                </ThemedText>
              </View>
              <View style={styles.modalStatCard}>
                <ThemedText style={styles.modalStatLabel}>Temps</ThemedText>
                <ThemedText style={styles.modalStatValue}>
                  {Math.round(trackedDurationSeconds / 60)} min
                </ThemedText>
              </View>
              <View style={styles.modalStatCard}>
                <ThemedText style={styles.modalStatLabel}>Vitesse moy</ThemedText>
                <ThemedText style={styles.modalStatValue}>
                  {trackingStats.averageSpeedKmh.toFixed(1)} km/h
                </ThemedText>
              </View>
              <View style={styles.modalStatCard}>
                <ThemedText style={styles.modalStatLabel}>Calories</ThemedText>
                <ThemedText style={styles.modalStatValue}>
                  {Math.round(estimatedCalories)} kcal
                </ThemedText>
              </View>
            </View>
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
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 12,
  },
  heroCard: {
    borderRadius: 20,
    padding: 16,
    gap: 10,
    backgroundColor: "#121A36",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  heroBadge: {
    fontSize: 12,
    letterSpacing: 1.2,
    fontWeight: "700",
    color: "#8EA2FF",
  },
  heroTitle: {
    color: "#FFFFFF",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  primaryAction: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#5B6CFF",
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryActionText: {
    color: "#fff",
    fontWeight: "700",
  },
  secondaryAction: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#5B6CFF",
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  secondaryActionText: {
    color: "#8EA2FF",
    fontWeight: "700",
  },
  actionDisabled: {
    opacity: 0.5,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
  },
  metricCard: {
    flex: 1,
    borderRadius: 14,
    padding: 10,
    backgroundColor: "rgba(91,108,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(91,108,255,0.22)",
  },
  metricLabel: {
    fontSize: 12,
    color: "#8EA2FF",
  },
  metricValue: {
    fontSize: 15,
    fontWeight: "700",
  },
  routeCard: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: "rgba(138,143,152,0.12)",
    borderWidth: 1,
    borderColor: "rgba(138,143,152,0.25)",
    gap: 6,
  },
  mapCard: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(138,143,152,0.25)",
  },
  retryButton: {
    borderRadius: 10,
    backgroundColor: "#5B6CFF",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  successText: {
    color: "#3fb950",
    fontWeight: "600",
  },
  errorText: {
    color: "#ff4d4f",
    fontWeight: "600",
  },
  debugButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ff4d4f",
    paddingVertical: 10,
    alignItems: "center",
  },
  debugButtonText: {
    color: "#ff4d4f",
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 26,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(138,143,152,0.25)",
    backgroundColor: "rgba(18,26,54,0.96)",
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 28,
    lineHeight: 30,
    flex: 1,
  },
  modalCloseButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalCloseButtonText: {
    color: "#c7d2ff",
    fontWeight: "700",
    fontSize: 12,
  },
  modalStatGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  modalStatCard: {
    width: "48.5%",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  modalStatLabel: {
    color: "#8ea2ff",
    fontSize: 12,
  },
  modalStatValue: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
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
