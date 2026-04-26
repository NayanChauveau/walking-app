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
    console.log("[walk-route] novelty baseline", {
      recentWalksCount: recentWalkCells.length,
      seenCellsCount: seenCells.size,
    });

    let bestRoute: WalkRoute | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    let testedCandidates = 0;
    let rejectedCandidates = 0;
    let bestRejectedRoute: WalkRoute | null = null;
    let bestRejectedScore = Number.NEGATIVE_INFINITY;

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

    console.log("[walk-route] generated waypoint candidates", {
      generatedCandidates: generatedCandidates.length,
      shortlistedCandidates: routingCandidates.length,
      shortlistTopScore: Number((routingCandidates[0]?.preScore ?? 0).toFixed(4)),
    });

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
          testedCandidates += 1;

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
          console.log("[walk-route] candidate evaluated", {
            ellipseIndex: routingCandidate.ellipseIndex,
            phaseOffset: routingCandidate.phaseOffset,
            preScore: Number(routingCandidate.preScore.toFixed(4)),
            distanceKm: Number((route.distanceMeters / 1000).toFixed(2)),
            durationMin: Math.round(route.durationSeconds / 60),
            traversedCells: traversedCells.length,
            noveltyScore: Number(scoreDetails.noveltyScore.toFixed(4)),
            loopQualityScore: Number(scoreDetails.loopQualityScore.toFixed(4)),
            backtrackRatio: Number(scoreDetails.backtrackRatio.toFixed(4)),
            revisitRatio: Number(scoreDetails.revisitRatio.toFixed(4)),
            repeatedEdgeRatio: Number(scoreDetails.repeatedEdgeRatio.toFixed(4)),
            totalScore: Number(scoreDetails.totalScore.toFixed(4)),
            isRejected: scoreDetails.isRejected,
            rejectionReason: scoreDetails.rejectionReason,
          });

          if (scoreDetails.isRejected) {
            rejectedCandidates += 1;
            if (scoreDetails.totalScore > bestRejectedScore) {
              bestRejectedScore = scoreDetails.totalScore;
              bestRejectedRoute = route;
            }
            continue;
          }

          if (scoreDetails.totalScore > bestScore) {
            bestScore = scoreDetails.totalScore;
            bestRoute = route;
            console.log("[walk-route] candidate is new best", {
              ellipseIndex: routingCandidate.ellipseIndex,
              phaseOffset: routingCandidate.phaseOffset,
              bestScore: Number(bestScore.toFixed(4)),
            });
          }
        } catch (routingError) {
          console.warn(
            "[walk-route] Candidate routing failed, trying next one",
            {
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

    if (!bestRoute) {
      if (bestRejectedRoute) {
        console.warn(
          "[walk-route] all candidates rejected by loop-quality filter, using best rejected route",
          { rejectedCandidates, testedCandidates },
        );
        bestRoute = bestRejectedRoute;
        bestScore = bestRejectedScore;
      } else {
        throw new Error("No walk route candidate could be generated");
      }
    }

    const selectedRoute: WalkRoute = bestRoute;

    console.log("[walk-route] selected route", {
      testedCandidates,
      rejectedCandidates,
      selectedDistanceKm: Number((selectedRoute.distanceMeters / 1000).toFixed(2)),
      selectedDurationMin: Math.round(selectedRoute.durationSeconds / 60),
      finalRouteScore: Number(bestScore.toFixed(4)),
    });

    return selectedRoute;
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
}
