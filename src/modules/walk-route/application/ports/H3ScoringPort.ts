import type { Coordinates } from "../../domain/value-objects/Coordinates";

export interface H3ScoringPort {
  scoreWaypointCandidate(input: {
    waypoints: Coordinates[];
    seenCells: Set<string>;
    resolution?: number;
  }): {
    score: number;
    uniqueCellsCount: number;
    novelCellsCount: number;
  };
}

