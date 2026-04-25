import type { CompletedWalk } from "../entities/CompletedWalk";
import type { WalkInsights } from "../entities/WalkInsights";

export function calculateWalkInsights(walks: CompletedWalk[]): WalkInsights {
  if (walks.length === 0) {
    return {
      totalWalks: 0,
      totalDistanceKm: 0,
      totalDurationMinutes: 0,
      averageDistanceKm: 0,
      averageDurationMinutes: 0,
      averageSpeedKmh: 0,
      lastWalkAtIso: null,
    };
  }

  const totals = walks.reduce(
    (acc, walk) => {
      acc.distanceMeters += walk.distanceMeters;
      acc.durationSeconds += walk.durationSeconds;
      return acc;
    },
    { distanceMeters: 0, durationSeconds: 0 },
  );

  const totalDistanceKm = totals.distanceMeters / 1000;
  const totalDurationMinutes = totals.durationSeconds / 60;
  const averageDistanceKm = totalDistanceKm / walks.length;
  const averageDurationMinutes = totalDurationMinutes / walks.length;
  const averageSpeedKmh =
    totals.durationSeconds > 0
      ? totalDistanceKm / (totals.durationSeconds / 3600)
      : 0;

  return {
    totalWalks: walks.length,
    totalDistanceKm,
    totalDurationMinutes,
    averageDistanceKm,
    averageDurationMinutes,
    averageSpeedKmh,
    lastWalkAtIso: walks[0]?.completedAtIso ?? null,
  };
}
