import type { Coordinates } from "@/src/modules/walk-route";

export type CompletedWalk = {
  id: string;
  completedAtIso: string;
  distanceMeters: number;
  durationSeconds: number;
  averageSpeedKmh: number;
  polyline: Coordinates[];
  start: Coordinates;
  end: Coordinates;
};
