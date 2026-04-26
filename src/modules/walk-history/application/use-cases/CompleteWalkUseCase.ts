import type { WalkRoute } from "@/src/modules/walk-route";

import type { CompletedWalk } from "../../domain/entities/CompletedWalk";
import type { TraversedCellsPort } from "../ports/TraversedCellsPort";
import type { WalkHistoryRepository } from "../ports/WalkHistoryRepository";

export class CompleteWalkUseCase {
  constructor(
    private readonly walkHistoryRepository: WalkHistoryRepository,
    private readonly traversedCells: TraversedCellsPort,
  ) {}

  async execute(input: {
    route: WalkRoute;
    actualPath?: WalkRoute["geometry"];
    actualDurationSeconds?: number;
    actualDistanceMeters?: number;
    averageSpeedKmh?: number;
  }): Promise<CompletedWalk> {
    const persistedPolyline =
      input.actualPath && input.actualPath.length > 1
        ? input.actualPath
        : input.route.geometry;
    const nowIso = new Date().toISOString();
    const firstPoint = persistedPolyline[0] ?? input.route.candidate.ellipse.start;
    const lastPoint = persistedPolyline[persistedPolyline.length - 1] ?? firstPoint;
    // TODO: replace API-estimated duration with real elapsed duration
    // collected from the user session when they tap "Terminer le parcours".
    const durationSeconds = input.actualDurationSeconds ?? input.route.durationSeconds;
    const distanceMeters = input.actualDistanceMeters ?? input.route.distanceMeters;
    const averageSpeedKmh =
      input.averageSpeedKmh ??
      (durationSeconds > 0 ? (distanceMeters / 1000) / (durationSeconds / 3600) : 0);

    const completedWalk: CompletedWalk = {
      id: `${nowIso}-${Math.random().toString(36).slice(2, 8)}`,
      completedAtIso: nowIso,
      distanceMeters,
      // TODO: persist user-tracked duration (stopwatch/background tracking),
      // and keep this API duration only as a fallback estimate.
      durationSeconds,
      averageSpeedKmh,
      polyline: persistedPolyline,
      traversedH3Cells: this.traversedCells.extractFromPolyline({
        polyline: persistedPolyline,
      }),
      start: firstPoint,
      end: lastPoint,
    };

    await this.walkHistoryRepository.save(completedWalk);

    return completedWalk;
  }
}
