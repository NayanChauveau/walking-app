import { geoToH3Cell } from "@/src/modules/shared/infrastructure/h3/h3ReactNativeClient";

import type { H3ScoringPort } from "../../application/ports/H3ScoringPort";
import type { Coordinates } from "../../domain/value-objects/Coordinates";

const DEFAULT_H3_RESOLUTION = 11;

export class H3WaypointCandidateScoringAdapter implements H3ScoringPort {
  scoreWaypointCandidate(input: {
    waypoints: Coordinates[];
    seenCells: Set<string>;
    resolution?: number;
  }): {
    score: number;
    uniqueCellsCount: number;
    novelCellsCount: number;
  } {
    const resolution = input.resolution ?? DEFAULT_H3_RESOLUTION;
    const uniqueCells = new Set<string>();

    for (const waypoint of input.waypoints) {
      uniqueCells.add(geoToH3Cell(waypoint.latitude, waypoint.longitude, resolution));
    }

    let novelCellsCount = 0;
    for (const cell of uniqueCells) {
      if (!input.seenCells.has(cell)) {
        novelCellsCount += 1;
      }
    }

    const uniqueCellsCount = uniqueCells.size;
    const noveltyRatio =
      uniqueCellsCount === 0 ? 0 : novelCellsCount / uniqueCellsCount;

    return {
      score: noveltyRatio + novelCellsCount * 0.001,
      uniqueCellsCount,
      novelCellsCount,
    };
  }
}

