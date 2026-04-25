import type { WalkRoute } from "@/src/modules/walk-route";

import type { CompletedWalk } from "../../domain/entities/CompletedWalk";
import type { TraversedCellsPort } from "../ports/TraversedCellsPort";
import type { WalkHistoryRepository } from "../ports/WalkHistoryRepository";

export class CompleteWalkUseCase {
  constructor(
    private readonly walkHistoryRepository: WalkHistoryRepository,
    private readonly traversedCells: TraversedCellsPort,
  ) {}

  async execute(input: { route: WalkRoute }): Promise<CompletedWalk> {
    const nowIso = new Date().toISOString();
    const firstPoint = input.route.geometry[0] ?? input.route.candidate.ellipse.start;
    const lastPoint =
      input.route.geometry[input.route.geometry.length - 1] ?? firstPoint;
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
      polyline: input.route.geometry,
      traversedH3Cells: this.traversedCells.extractFromPolyline({
        polyline: input.route.geometry,
      }),
      start: firstPoint,
      end: lastPoint,
    };

    await this.walkHistoryRepository.save(completedWalk);

    return completedWalk;
  }
}
