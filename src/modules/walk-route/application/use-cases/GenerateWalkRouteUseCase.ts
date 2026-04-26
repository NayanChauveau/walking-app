import type {
  WalkRoute,
  WalkRouteAlternative,
  WalkRouteScoring,
} from "../../domain/entities/WalkRoute";
import type { Coordinates } from "../../domain/value-objects/Coordinates";
import { calculateTargetWalkingDistanceMeters } from "../../domain/services/WalkingDistanceCalculator";
import type { PolylineCellsPort } from "../ports/PolylineCellsPort";
import type { RecentWalkCellsPort } from "../ports/RecentWalkCellsPort";
import type { RoutingPort } from "../ports/RoutingPort";
import {
  GenerateWaypointCandidatesUseCase,
} from "./GenerateWaypointCandidatesUseCase";
import {
  PreScoreWaypointCandidatesUseCase,
  type PreScoredWaypointCandidate,
} from "./PreScoreWaypointCandidatesUseCase";
import {
  ScoreGeneratedRoutesUseCase,
  type RouteScoreDetails,
} from "./ScoreGeneratedRoutesUseCase";

type Input = {
  start: Coordinates;
  targetDurationMinutes: number;
};

type ScoredAcceptedCandidate = {
  route: WalkRoute;
  scoreDetails: RouteScoreDetails;
  traversedCellSet: Set<string>;
  geometrySignature: string;
};

export class GenerateWalkRouteUseCase {
  private static readonly MAX_CONCURRENT_ROUTING_REQUESTS = 3;
  private static readonly SHORTLIST_TARGET = 8;
  private static readonly SHORTLIST_MIN = 3;
  private static readonly MAX_CANDIDATES_PER_ELLIPSE = 2;
  private static readonly MAX_NOVELTY_POI_OVERLAP_RATIO = 0.7;
  private static readonly MIN_LOOP_QUALITY_SCORE = 0.85;
  private static readonly MAX_GENERATION_ATTEMPTS = 3;

  constructor(
    private readonly routing: RoutingPort,
    private readonly generateWaypointCandidates: GenerateWaypointCandidatesUseCase,
    private readonly preScoreWaypointCandidates: PreScoreWaypointCandidatesUseCase,
    private readonly scoreGeneratedRoutes: ScoreGeneratedRoutesUseCase,
    private readonly recentWalkCells: RecentWalkCellsPort,
    private readonly polylineCells: PolylineCellsPort,
  ) {}

  async execute(input: Input): Promise<WalkRoute> {
    const targetDistanceMeters = calculateTargetWalkingDistanceMeters({
      targetDurationMinutes: input.targetDurationMinutes,
    });
    const recentWalkCells = await this.recentWalkCells.listRecentTraversedCells(100);
    const seenCells = new Set(recentWalkCells.flat());

    let fallbackBestRoute: WalkRoute | null = null;
    let fallbackBestRouteScore = Number.NEGATIVE_INFINITY;
    let fallbackBestRouteDetails: RouteScoreDetails | null = null;
    let fallbackBestNoveltyRoute: WalkRoute | null = null;
    let fallbackBestNoveltyDetails: RouteScoreDetails | null = null;
    let fallbackBestPoiRoute: WalkRoute | null = null;
    let fallbackBestPoiDetails: RouteScoreDetails | null = null;
    let fallbackBestRejectedRoute: WalkRoute | null = null;
    let fallbackBestRejectedScore = Number.NEGATIVE_INFINITY;
    let fallbackBestRejectedDetails: RouteScoreDetails | null = null;

    for (
      let attempt = 1;
      attempt <= GenerateWalkRouteUseCase.MAX_GENERATION_ATTEMPTS;
      attempt += 1
    ) {
      let bestRoute: WalkRoute | null = null;
      let bestScore = Number.NEGATIVE_INFINITY;
      let bestNoveltyRoute: WalkRoute | null = null;
      let bestNoveltyScore = Number.NEGATIVE_INFINITY;
      let bestNoveltyDetails: RouteScoreDetails | null = null;
      let bestPoiRoute: WalkRoute | null = null;
      let bestPoiScore = Number.NEGATIVE_INFINITY;
      let bestPoiDetails: RouteScoreDetails | null = null;
      let bestRejectedRoute: WalkRoute | null = null;
      let bestRejectedScore = Number.NEGATIVE_INFINITY;
      let bestRouteScoreDetails: RouteScoreDetails | null = null;
      let bestRejectedScoreDetails: RouteScoreDetails | null = null;
      const acceptedCandidates: ScoredAcceptedCandidate[] = [];

      const generatedCandidates = this.generateWaypointCandidates.execute({
        start: input.start,
        targetDurationMinutes: input.targetDurationMinutes,
        minCandidates: 20,
        maxCandidates: 50,
      });
      const preScoredCandidates = this.preScoreWaypointCandidates.execute({
        candidates: generatedCandidates,
        seenCells,
      });
      const routingCandidates = this.selectTopCandidates(preScoredCandidates);


      let nextCandidateIndex = 0;
      const workerCount = Math.min(
        GenerateWalkRouteUseCase.MAX_CONCURRENT_ROUTING_REQUESTS,
        routingCandidates.length,
      );

      const worker = async () => {
        while (true) {
          const candidateIndex = nextCandidateIndex;
          nextCandidateIndex += 1;

          const routingCandidate: PreScoredWaypointCandidate | undefined =
            routingCandidates[candidateIndex];
          if (!routingCandidate) {
            return;
          }

          try {
            const route = await this.routing.getWalkingRoute({
              candidate: routingCandidate.candidate,
              waypoints: routingCandidate.waypoints,
            });

            const traversedCells = this.polylineCells.extractFromPolyline({
              polyline: route.geometry,
            });
            const traversedCellPath = this.polylineCells.extractPathFromPolyline({
              polyline: route.geometry,
            });
            const scoreDetails: RouteScoreDetails = this.scoreGeneratedRoutes.execute({
              route,
              traversedCells,
              traversedCellPath,
              seenCells,
              targetDistanceMeters,
              targetDurationMinutes: input.targetDurationMinutes,
            });

            if (scoreDetails.isRejected) {
              if (scoreDetails.totalScore > bestRejectedScore) {
                bestRejectedScore = scoreDetails.totalScore;
                bestRejectedRoute = route;
                bestRejectedScoreDetails = scoreDetails;
              }
              continue;
            }

            acceptedCandidates.push({
              route,
              scoreDetails,
              traversedCellSet: new Set(traversedCells),
              geometrySignature: this.buildGeometrySignature(route.geometry),
            });

            if (scoreDetails.noveltyScore > bestNoveltyScore) {
              bestNoveltyScore = scoreDetails.noveltyScore;
              bestNoveltyRoute = route;
              bestNoveltyDetails = scoreDetails;
            }

            if (
              scoreDetails.loopQualityScore >=
                GenerateWalkRouteUseCase.MIN_LOOP_QUALITY_SCORE &&
              scoreDetails.poiPleasureScore > bestPoiScore
            ) {
              bestPoiScore = scoreDetails.poiPleasureScore;
              bestPoiRoute = route;
              bestPoiDetails = scoreDetails;
            }

            if (scoreDetails.totalScore > bestScore) {
              bestScore = scoreDetails.totalScore;
              bestRoute = route;
              bestRouteScoreDetails = scoreDetails;
            }
          } catch (routingError) {
            console.warn(
              "[walk-route] Candidate routing failed, trying next one",
              {
                attempt,
                ellipseIndex: routingCandidate.ellipseIndex,
                phaseOffset: routingCandidate.phaseOffset,
                preScore: Number(routingCandidate.preScore.toFixed(4)),
                routingError,
              },
            );
          }
        }
      };

      await Promise.all(Array.from({ length: workerCount }, () => worker()));

      const diversePoiCandidate = this.selectDiversePoiCandidate(
        acceptedCandidates,
        bestNoveltyRoute,
      );
      if (diversePoiCandidate) {
        bestPoiRoute = diversePoiCandidate.route;
        bestPoiDetails = diversePoiCandidate.scoreDetails;
      }

      const bestLoopQualityScore =
        (bestRouteScoreDetails as RouteScoreDetails | null)?.loopQualityScore ?? 0;

      if (bestRoute && bestRouteScoreDetails) {
        if (bestScore > fallbackBestRouteScore) {
          fallbackBestRoute = bestRoute;
          fallbackBestRouteScore = bestScore;
          fallbackBestRouteDetails = bestRouteScoreDetails;
        }

        if (bestNoveltyRoute && bestNoveltyDetails) {
          fallbackBestNoveltyRoute = bestNoveltyRoute;
          fallbackBestNoveltyDetails = bestNoveltyDetails;
        }

        if (bestPoiRoute && bestPoiDetails) {
          fallbackBestPoiRoute = bestPoiRoute;
          fallbackBestPoiDetails = bestPoiDetails;
        }

        if (bestLoopQualityScore >= GenerateWalkRouteUseCase.MIN_LOOP_QUALITY_SCORE) {
          const selectedRoute = this.buildSelectedRoute(
            bestRoute,
            bestRouteScoreDetails,
            bestNoveltyRoute,
            bestNoveltyDetails,
            bestPoiRoute,
            bestPoiDetails,
          );
          return selectedRoute;
        }
      }

      if (bestRejectedRoute && bestRejectedScore > fallbackBestRejectedScore) {
        fallbackBestRejectedRoute = bestRejectedRoute;
        fallbackBestRejectedScore = bestRejectedScore;
        fallbackBestRejectedDetails = bestRejectedScoreDetails;
      }

      console.warn(
        "[walk-route] best loop quality below threshold, regenerating candidates",
        {
          attempt,
          maxAttempts: GenerateWalkRouteUseCase.MAX_GENERATION_ATTEMPTS,
          requiredLoopQuality: GenerateWalkRouteUseCase.MIN_LOOP_QUALITY_SCORE,
          bestLoopQualityScore: Number(bestLoopQualityScore.toFixed(4)),
        },
      );
    }

    const fallbackLoopQualityScore =
      (fallbackBestRouteDetails as RouteScoreDetails | null)?.loopQualityScore ?? 0;

    if (fallbackBestRoute) {
      console.warn(
        "[walk-route] loop quality threshold not reached after max attempts, using best available route",
        {
          requiredLoopQuality: GenerateWalkRouteUseCase.MIN_LOOP_QUALITY_SCORE,
          maxAttempts: GenerateWalkRouteUseCase.MAX_GENERATION_ATTEMPTS,
          selectedLoopQualityScore: Number(fallbackLoopQualityScore.toFixed(4)),
        },
      );
      return this.buildSelectedRoute(
        fallbackBestRoute,
        fallbackBestRouteDetails,
        fallbackBestNoveltyRoute,
        fallbackBestNoveltyDetails,
        fallbackBestPoiRoute,
        fallbackBestPoiDetails,
      );
    }

    if (fallbackBestRejectedRoute) {
      console.warn(
        "[walk-route] all candidates rejected across attempts, using best rejected route",
        {
          maxAttempts: GenerateWalkRouteUseCase.MAX_GENERATION_ATTEMPTS,
        },
      );
      return this.buildSelectedRoute(
        fallbackBestRejectedRoute,
        fallbackBestRejectedDetails,
        fallbackBestNoveltyRoute,
        fallbackBestNoveltyDetails,
        fallbackBestPoiRoute,
        fallbackBestPoiDetails,
      );
    }

    throw new Error("No walk route candidate could be generated");
  }

  private selectTopCandidates(
    candidates: PreScoredWaypointCandidate[],
  ): PreScoredWaypointCandidate[] {
    const shortlistSize = Math.min(
      GenerateWalkRouteUseCase.SHORTLIST_TARGET,
      candidates.length,
    );
    const diversifiedCandidates: PreScoredWaypointCandidate[] = [];
    const selectedByEllipse = new Map<number, number>();

    // First pass: guarantee broad ellipse coverage (max 1 per ellipse).
    for (const candidate of candidates) {
      if (diversifiedCandidates.length >= shortlistSize) {
        break;
      }
      if (selectedByEllipse.has(candidate.ellipseIndex)) {
        continue;
      }
      diversifiedCandidates.push(candidate);
      selectedByEllipse.set(candidate.ellipseIndex, 1);
    }

    // Second pass: fill remaining slots while capping per-ellipse concentration.
    for (const candidate of candidates) {
      if (diversifiedCandidates.length >= shortlistSize) {
        break;
      }

      if (diversifiedCandidates.includes(candidate)) {
        continue;
      }

      const alreadySelectedForEllipse =
        selectedByEllipse.get(candidate.ellipseIndex) ?? 0;
      if (
        alreadySelectedForEllipse >=
        GenerateWalkRouteUseCase.MAX_CANDIDATES_PER_ELLIPSE
      ) {
        continue;
      }

      diversifiedCandidates.push(candidate);
      selectedByEllipse.set(candidate.ellipseIndex, alreadySelectedForEllipse + 1);
    }

    if (diversifiedCandidates.length < GenerateWalkRouteUseCase.SHORTLIST_MIN) {
      throw new Error("Not enough candidates after local pre-scoring");
    }

    return diversifiedCandidates;
  }

  private buildSelectedRoute(
    route: WalkRoute,
    scoreDetails: RouteScoreDetails | null,
    noveltyRoute?: WalkRoute | null,
    noveltyDetails?: RouteScoreDetails | null,
    poiRoute?: WalkRoute | null,
    poiDetails?: RouteScoreDetails | null,
  ): WalkRoute {
    const noveltyAlternative = this.buildAlternativeRoute(
      noveltyRoute,
      noveltyDetails,
    );
    const poiAlternative = this.buildAlternativeRoute(poiRoute, poiDetails);

    return {
      ...route,
      scoring: this.mapRouteScore(scoreDetails),
      alternatives:
        noveltyAlternative || poiAlternative
          ? {
              novelty: noveltyAlternative,
              poi: poiAlternative,
            }
          : undefined,
    };
  }

  private buildAlternativeRoute(
    route: WalkRoute | null | undefined,
    scoreDetails: RouteScoreDetails | null | undefined,
  ): WalkRouteAlternative | undefined {
    const scoring = this.mapRouteScore(scoreDetails ?? null);
    if (!route || !scoring) {
      return undefined;
    }

    return {
      geometry: route.geometry,
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      scoring,
    };
  }

  private mapRouteScore(
    scoreDetails: RouteScoreDetails | null,
  ): WalkRouteScoring | undefined {
    if (!scoreDetails) {
      return undefined;
    }

    return {
      totalScore: scoreDetails.totalScore,
      noveltyScore: scoreDetails.noveltyScore,
      loopQualityScore: scoreDetails.loopQualityScore,
      targetDistanceScore: scoreDetails.targetDistanceScore,
      targetDurationScore: scoreDetails.targetDurationScore,
      poiPleasureScore: scoreDetails.poiPleasureScore,
      parkProximityScore: scoreDetails.parkProximityScore,
      waterProximityScore: scoreDetails.waterProximityScore,
      backtrackRatio: scoreDetails.backtrackRatio,
      revisitRatio: scoreDetails.revisitRatio,
      repeatedEdgeRatio: scoreDetails.repeatedEdgeRatio,
      isRejected: scoreDetails.isRejected,
      rejectionReason: scoreDetails.rejectionReason,
    };
  }

  private selectDiversePoiCandidate(
    acceptedCandidates: ScoredAcceptedCandidate[],
    noveltyRoute: WalkRoute | null,
  ): ScoredAcceptedCandidate | null {
    if (!noveltyRoute || acceptedCandidates.length === 0) {
      return null;
    }

    const noveltySignature = this.buildGeometrySignature(noveltyRoute.geometry);
    const noveltyCellSet = new Set(
      this.polylineCells.extractFromPolyline({ polyline: noveltyRoute.geometry }),
    );

    const poiSortedCandidates = [...acceptedCandidates].sort(
      (left, right) =>
        right.scoreDetails.poiPleasureScore - left.scoreDetails.poiPleasureScore,
    );

    for (const candidate of poiSortedCandidates) {
      if (
        candidate.scoreDetails.loopQualityScore <
        GenerateWalkRouteUseCase.MIN_LOOP_QUALITY_SCORE
      ) {
        continue;
      }

      if (candidate.geometrySignature === noveltySignature) {
        continue;
      }

      const overlapRatio = this.calculateCellOverlapRatio(
        noveltyCellSet,
        candidate.traversedCellSet,
      );
      if (overlapRatio <= GenerateWalkRouteUseCase.MAX_NOVELTY_POI_OVERLAP_RATIO) {
        return candidate;
      }
    }

    return null;
  }

  private calculateCellOverlapRatio(
    left: Set<string>,
    right: Set<string>,
  ): number {
    if (left.size === 0 || right.size === 0) {
      return 0;
    }

    let shared = 0;
    for (const cell of left) {
      if (right.has(cell)) {
        shared += 1;
      }
    }

    return shared / Math.min(left.size, right.size);
  }

  private buildGeometrySignature(geometry: Coordinates[]): string {
    return geometry
      .map(
        (point) => `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`,
      )
      .join("|");
  }
}
