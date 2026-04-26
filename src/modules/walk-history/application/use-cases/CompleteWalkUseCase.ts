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
    const averageSpeedKmh =
      input.route.durationSeconds > 0
        ? (input.route.distanceMeters / 1000) / (input.route.durationSeconds / 3600)
        : 0;

    const completedWalk: CompletedWalk = {
      id: `${nowIso}-${Math.random().toString(36).slice(2, 8)}`,
      completedAtIso: nowIso,
      distanceMeters: input.route.distanceMeters,
      // TODO: persist user-tracked duration (stopwatch/background tracking),
      // and keep this API duration only as a fallback estimate.
      durationSeconds: input.route.durationSeconds,
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
