import type { WalkRoute } from "../../domain/entities/WalkRoute";
import type { PoiScoringPort } from "../ports/PoiScoringPort";

type CriterionKey =
  | "novelty"
  | "loopQuality"
  | "targetDistance"
  | "targetDuration"
  | "poiPleasure";

type CriterionWeight = {
  key: CriterionKey;
  weight: number;
};

export type RouteScoreDetails = {
  totalScore: number;
  noveltyScore: number;
  loopQualityScore: number;
  targetDistanceScore: number;
  targetDurationScore: number;
  poiPleasureScore: number;
  parkProximityScore: number;
  waterProximityScore: number;
  isRejected: boolean;
  rejectionReason: string | null;
  backtrackRatio: number;
  revisitRatio: number;
  repeatedEdgeRatio: number;
};

type Input = {
  route: WalkRoute;
  traversedCells: string[];
  traversedCellPath: string[];
  seenCells: Set<string>;
  targetDistanceMeters: number;
  targetDurationMinutes: number;
};

export class ScoreGeneratedRoutesUseCase {
  private static readonly MAX_ALLOWED_BACKTRACK_RATIO = 0.16;
  private static readonly MAX_ALLOWED_REVISIT_RATIO = 0.58;
  private static readonly MAX_ALLOWED_REPEATED_EDGE_RATIO = 0.34;

  constructor(
    private readonly poiScoring: PoiScoringPort,
    private readonly criterionWeights: CriterionWeight[] = [
      { key: "loopQuality", weight: 0.4 },
      { key: "novelty", weight: 0.3 },
      { key: "targetDistance", weight: 0.1 },
      { key: "targetDuration", weight: 0.05 },
      { key: "poiPleasure", weight: 0.15 },
    ],
  ) {}

  execute(input: Input): RouteScoreDetails {
    const noveltyScore = this.calculateNoveltyScore({
      traversedCells: input.traversedCells,
      seenCells: input.seenCells,
    });
    const backtrackRatio = this.calculateBacktrackRatio(input.traversedCellPath);
    const revisitRatio = this.calculateRevisitRatio(input.traversedCellPath);
    const repeatedEdgeRatio = this.calculateRepeatedEdgeRatio(
      input.traversedCellPath,
    );
    const loopQualityScore = this.calculateLoopQualityScore({
      backtrackRatio,
      revisitRatio,
      repeatedEdgeRatio,
    });
    const targetDistanceScore = this.calculateTargetDistanceScore({
      actualDistanceMeters: input.route.distanceMeters,
      targetDistanceMeters: input.targetDistanceMeters,
    });
    const targetDurationScore = this.calculateTargetDurationScore({
      actualDurationSeconds: input.route.durationSeconds,
      targetDurationMinutes: input.targetDurationMinutes,
    });
    const poiScores = this.poiScoring.scoreRouteContext({
      polyline: input.route.geometry,
    });

    const isRejected =
      backtrackRatio > ScoreGeneratedRoutesUseCase.MAX_ALLOWED_BACKTRACK_RATIO ||
      revisitRatio > ScoreGeneratedRoutesUseCase.MAX_ALLOWED_REVISIT_RATIO ||
      repeatedEdgeRatio >
        ScoreGeneratedRoutesUseCase.MAX_ALLOWED_REPEATED_EDGE_RATIO;
    const rejectionReason =
      backtrackRatio > ScoreGeneratedRoutesUseCase.MAX_ALLOWED_BACKTRACK_RATIO
        ? "excessive backtracking"
        : revisitRatio > ScoreGeneratedRoutesUseCase.MAX_ALLOWED_REVISIT_RATIO
          ? "excessive revisits"
          : repeatedEdgeRatio >
              ScoreGeneratedRoutesUseCase.MAX_ALLOWED_REPEATED_EDGE_RATIO
            ? "excessive repeated segments"
          : null;

    const criterionScores: Record<CriterionKey, number> = {
      novelty: noveltyScore,
      loopQuality: loopQualityScore,
      targetDistance: targetDistanceScore,
      targetDuration: targetDurationScore,
      poiPleasure: poiScores.poiPleasureScore,
    };
    const totalScore = this.criterionWeights.reduce(
      (sum, criterion) => sum + criterionScores[criterion.key] * criterion.weight,
      0,
    );

    return {
      totalScore,
      noveltyScore,
      loopQualityScore,
      targetDistanceScore,
      targetDurationScore,
      poiPleasureScore: poiScores.poiPleasureScore,
      parkProximityScore: poiScores.parkProximityScore,
      waterProximityScore: poiScores.waterProximityScore,
      isRejected,
      rejectionReason,
      backtrackRatio,
      revisitRatio,
      repeatedEdgeRatio,
    };
  }

  private calculateNoveltyScore(input: {
    traversedCells: string[];
    seenCells: Set<string>;
  }): number {
    if (input.traversedCells.length === 0) {
      return 0;
    }

    let novelCount = 0;
    for (const cell of input.traversedCells) {
      if (!input.seenCells.has(cell)) {
        novelCount += 1;
      }
    }

    const novelRatio = novelCount / input.traversedCells.length;
    return novelRatio + novelCount * 0.001;
  }

  private calculateBacktrackRatio(cellPath: string[]): number {
    if (cellPath.length < 3) {
      return 0;
    }

    let backtrackCount = 0;
    for (let index = 2; index < cellPath.length; index += 1) {
      if (cellPath[index] === cellPath[index - 2]) {
        backtrackCount += 1;
      }
    }

    return backtrackCount / (cellPath.length - 2);
  }

  private calculateRevisitRatio(cellPath: string[]): number {
    if (cellPath.length === 0) {
      return 0;
    }

    let revisitCount = 0;
    const seen = new Set<string>();
    for (const cell of cellPath) {
      if (seen.has(cell)) {
        revisitCount += 1;
      } else {
        seen.add(cell);
      }
    }

    return revisitCount / cellPath.length;
  }

  private calculateLoopQualityScore(input: {
    backtrackRatio: number;
    revisitRatio: number;
    repeatedEdgeRatio: number;
  }): number {
    const penalty =
      input.backtrackRatio * 0.85 +
      input.revisitRatio * 0.5 +
      input.repeatedEdgeRatio * 0.95;
    return Math.max(0, 1 - penalty);
  }

  private calculateRepeatedEdgeRatio(cellPath: string[]): number {
    if (cellPath.length < 2) {
      return 0;
    }

    const edgeCounts = new Map<string, number>();
    let edgesCount = 0;

    for (let index = 1; index < cellPath.length; index += 1) {
      const previous = cellPath[index - 1];
      const current = cellPath[index];
      const key = previous < current ? `${previous}|${current}` : `${current}|${previous}`;

      edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
      edgesCount += 1;
    }

    let repeatedEdges = 0;
    for (const count of edgeCounts.values()) {
      if (count > 1) {
        repeatedEdges += count - 1;
      }
    }

    return repeatedEdges / edgesCount;
  }

  private calculateTargetDistanceScore(input: {
    actualDistanceMeters: number;
    targetDistanceMeters: number;
  }): number {
    if (input.targetDistanceMeters <= 0) {
      return 0;
    }

    const distanceError = Math.abs(
      input.actualDistanceMeters - input.targetDistanceMeters,
    );
    return Math.max(0, 1 - distanceError / input.targetDistanceMeters);
  }

  private calculateTargetDurationScore(input: {
    actualDurationSeconds: number;
    targetDurationMinutes: number;
  }): number {
    const targetDurationSeconds = input.targetDurationMinutes * 60;
    if (targetDurationSeconds <= 0) {
      return 0;
    }

    const durationError = Math.abs(input.actualDurationSeconds - targetDurationSeconds);
    return Math.max(0, 1 - durationError / targetDurationSeconds);
  }
}

