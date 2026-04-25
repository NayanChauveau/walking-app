import { WalkCandidate } from "../../domain/entities/WalkCandidate";
import { calculateTargetWalkingDistanceMeters } from "../../domain/services/WalkingDistanceCalculator";
import type { Ellipse } from "../../domain/entities/Ellipse";
import type { Waypoint } from "../../domain/entities/Waypoint";
import type { WalkRoute } from "../../domain/entities/WalkRoute";
import type { Coordinates } from "../../domain/value-objects/Coordinates";
import type { EllipseGenerationPort } from "../ports/EllipseGenerationPort";
import type { PolylineCellsPort } from "../ports/PolylineCellsPort";
import type { RecentWalkCellsPort } from "../ports/RecentWalkCellsPort";
import type { RoutingPort } from "../ports/RoutingPort";
import type { WaypointGenerationPort } from "../ports/WaypointGenerationPort";

type Input = {
  start: Coordinates;
  targetDurationMinutes: number;
};

export class GenerateWalkRouteUseCase {
  private static readonly MAX_CONCURRENT_ROUTING_REQUESTS = 3;

  constructor(
    private readonly routing: RoutingPort,
    private readonly ellipseGeneration: EllipseGenerationPort,
    private readonly waypointGeneration: WaypointGenerationPort,
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

    const waypointPhaseOffsets = [0, 0.125, 0.25];
    const routingCandidates: Array<{
      ellipseIndex: number;
      phaseOffset: number;
      candidate: WalkCandidate;
      waypoints: Waypoint[];
    }> = [];

    for (let ellipseIndex = 0; ellipseIndex < 4; ellipseIndex += 1) {
      const ellipse = this.ellipseGeneration.generate({
        start: input.start,
        targetDistanceMeters,
      });

      const baseWaypoints = this.waypointGeneration.generateOnEllipse({
        ellipse,
      });

      for (const phaseOffset of waypointPhaseOffsets) {
        const variedWaypoints = this.buildWaypointVariant({
          waypoints: baseWaypoints,
          ellipse,
          phaseOffset,
        });

        const candidate = WalkCandidate.create({
          ellipse,
          waypoints: variedWaypoints,
        });
        routingCandidates.push({
          ellipseIndex,
          phaseOffset,
          candidate,
          waypoints: variedWaypoints,
        });
      }
    }

    let nextCandidateIndex = 0;
    const workerCount = Math.min(
      GenerateWalkRouteUseCase.MAX_CONCURRENT_ROUTING_REQUESTS,
      routingCandidates.length,
    );

    const worker = async () => {
      while (true) {
        const candidateIndex = nextCandidateIndex;
        nextCandidateIndex += 1;

        const routingCandidate = routingCandidates[candidateIndex];
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
          const noveltyScore = this.calculateNoveltyScore({
            traversedCells,
            seenCells,
          });
          console.log("[walk-route] candidate evaluated", {
            ellipseIndex: routingCandidate.ellipseIndex,
            phaseOffset: routingCandidate.phaseOffset,
            distanceKm: Number((route.distanceMeters / 1000).toFixed(2)),
            durationMin: Math.round(route.durationSeconds / 60),
            traversedCells: traversedCells.length,
            noveltyScore: Number(noveltyScore.toFixed(4)),
          });

          if (noveltyScore > bestScore) {
            bestScore = noveltyScore;
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
              routingError,
            },
          );
        }
      }
    };

    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    if (!bestRoute) {
      throw new Error("No walk route candidate could be generated");
    }

    const selectedRoute: WalkRoute = bestRoute;

    console.log("[walk-route] selected route", {
      testedCandidates,
      selectedDistanceKm: Number((selectedRoute.distanceMeters / 1000).toFixed(2)),
      selectedDurationMin: Math.round(selectedRoute.durationSeconds / 60),
      finalNoveltyScore: Number(bestScore.toFixed(4)),
    });

    return selectedRoute;
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

  private buildWaypointVariant(input: {
    waypoints: Waypoint[];
    ellipse: Ellipse;
    phaseOffset: number;
  }): Waypoint[] {
    return input.waypoints.map((waypoint) => {
      if (waypoint.role === "start") {
        return waypoint;
      }

      const shiftedPosition =
        (waypoint.positionOnEllipse + input.phaseOffset) % 1;

      return {
        ...waypoint,
        positionOnEllipse: shiftedPosition,
        coordinates: this.getPointOnEllipse(input.ellipse, shiftedPosition),
      };
    });
  }

  private getPointOnEllipse(ellipse: Ellipse, position: number): Coordinates {
    const angle = position * Math.PI * 2;

    const x = ellipse.semiMajorMeters * Math.cos(angle);
    const y = ellipse.semiMinorMeters * Math.sin(angle);

    const rotatedX =
      x * Math.cos(ellipse.rotationRadians) -
      y * Math.sin(ellipse.rotationRadians);

    const rotatedY =
      x * Math.sin(ellipse.rotationRadians) +
      y * Math.cos(ellipse.rotationRadians);

    return this.offsetCoordinates(ellipse.center, rotatedX, rotatedY);
  }

  private offsetCoordinates(
    origin: Coordinates,
    eastMeters: number,
    northMeters: number,
  ): Coordinates {
    const earthRadiusMeters = 6_371_000;
    const deltaLatitude = northMeters / earthRadiusMeters;
    const deltaLongitude =
      eastMeters /
      (earthRadiusMeters * Math.cos((origin.latitude * Math.PI) / 180));

    return {
      latitude: origin.latitude + (deltaLatitude * 180) / Math.PI,
      longitude: origin.longitude + (deltaLongitude * 180) / Math.PI,
    };
  }
}
