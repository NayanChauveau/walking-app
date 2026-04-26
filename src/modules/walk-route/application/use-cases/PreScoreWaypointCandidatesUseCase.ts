import type { H3ScoringPort } from "../ports/H3ScoringPort";
import type { GeneratedWaypointCandidate } from "./GenerateWaypointCandidatesUseCase";

export type PreScoredWaypointCandidate = GeneratedWaypointCandidate & {
  preScore: number;
  novelCellsCount: number;
  uniqueCellsCount: number;
};

type Input = {
  candidates: GeneratedWaypointCandidate[];
  seenCells: Set<string>;
};

export class PreScoreWaypointCandidatesUseCase {
  constructor(private readonly h3Scoring: H3ScoringPort) {}

  execute(input: Input): PreScoredWaypointCandidate[] {
    return input.candidates
      .map((candidate) => {
        const scored = this.h3Scoring.scoreWaypointCandidate({
          waypoints: candidate.waypoints.map((waypoint) => waypoint.coordinates),
          seenCells: input.seenCells,
        });

        return {
          ...candidate,
          preScore: scored.score,
          novelCellsCount: scored.novelCellsCount,
          uniqueCellsCount: scored.uniqueCellsCount,
        };
      })
      .sort((left, right) => right.preScore - left.preScore);
  }
}

