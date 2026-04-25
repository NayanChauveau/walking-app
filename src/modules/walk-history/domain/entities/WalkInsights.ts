export type WalkInsights = {
  totalWalks: number;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  averageDistanceKm: number;
  averageDurationMinutes: number;
  averageSpeedKmh: number;
  lastWalkAtIso: string | null;
};
