import type { WalkRoute } from "../../domain/entities/WalkRoute";
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

export class GenerateWalkRouteUseCase {
  private static readonly MAX_CONCURRENT_ROUTING_REQUESTS = 3;
  private static readonly SHORTLIST_TARGET = 5;
  private static readonly SHORTLIST_MIN = 3;
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
      let bestRejectedRoute: WalkRoute | null = null;
      let bestRejectedScore = Number.NEGATIVE_INFINITY;
      let bestRouteScoreDetails: RouteScoreDetails | null = null;
      let bestRejectedScoreDetails: RouteScoreDetails | null = null;

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

      const bestLoopQualityScore =
        (bestRouteScoreDetails as RouteScoreDetails | null)?.loopQualityScore ?? 0;

      if (bestRoute && bestRouteScoreDetails) {
        if (bestScore > fallbackBestRouteScore) {
          fallbackBestRoute = bestRoute;
          fallbackBestRouteScore = bestScore;
          fallbackBestRouteDetails = bestRouteScoreDetails;
        }

        if (bestLoopQualityScore >= GenerateWalkRouteUseCase.MIN_LOOP_QUALITY_SCORE) {
          const selectedRoute = this.buildSelectedRoute(
            bestRoute,
            bestRouteScoreDetails,
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
      return this.buildSelectedRoute(fallbackBestRoute, fallbackBestRouteDetails);
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
    const topCandidates = candidates.slice(0, shortlistSize);

    if (topCandidates.length < GenerateWalkRouteUseCase.SHORTLIST_MIN) {
      throw new Error("Not enough candidates after local pre-scoring");
    }

    return topCandidates;
  }

  private buildSelectedRoute(
    route: WalkRoute,
    scoreDetails: RouteScoreDetails | null,
  ): WalkRoute {
    return {
      ...route,
      scoring: scoreDetails
        ? {
            totalScore: scoreDetails.totalScore,
            noveltyScore: scoreDetails.noveltyScore,
            loopQualityScore: scoreDetails.loopQualityScore,
            targetDistanceScore: scoreDetails.targetDistanceScore,
            targetDurationScore: scoreDetails.targetDurationScore,
            backtrackRatio: scoreDetails.backtrackRatio,
            revisitRatio: scoreDetails.revisitRatio,
            repeatedEdgeRatio: scoreDetails.repeatedEdgeRatio,
            isRejected: scoreDetails.isRejected,
            rejectionReason: scoreDetails.rejectionReason,
          }
        : undefined,
    };
  }
}
