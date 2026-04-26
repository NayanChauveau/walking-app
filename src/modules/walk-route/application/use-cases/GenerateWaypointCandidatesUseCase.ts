import { WalkCandidate } from "../../domain/entities/WalkCandidate";
import type { Ellipse } from "../../domain/entities/Ellipse";
import type { Waypoint } from "../../domain/entities/Waypoint";
import { calculateTargetWalkingDistanceMeters } from "../../domain/services/WalkingDistanceCalculator";
import type { Coordinates } from "../../domain/value-objects/Coordinates";
import type { EllipseGenerationPort } from "../ports/EllipseGenerationPort";
import type { WaypointGenerationPort } from "../ports/WaypointGenerationPort";

type Input = {
  start: Coordinates;
  targetDurationMinutes: number;
  minCandidates?: number;
  maxCandidates?: number;
};

export type GeneratedWaypointCandidate = {
  ellipseIndex: number;
  phaseOffset: number;
  candidate: WalkCandidate;
  waypoints: Waypoint[];
};

export class GenerateWaypointCandidatesUseCase {
  private static readonly DEFAULT_MIN_CANDIDATES = 20;
  private static readonly DEFAULT_MAX_CANDIDATES = 50;
  private static readonly WAYPOINT_PHASE_OFFSETS = [
    0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45,
  ];

  constructor(
    private readonly ellipseGeneration: EllipseGenerationPort,
    private readonly waypointGeneration: WaypointGenerationPort,
  ) {}

  execute(input: Input): GeneratedWaypointCandidate[] {
    const minCandidates =
      input.minCandidates ?? GenerateWaypointCandidatesUseCase.DEFAULT_MIN_CANDIDATES;
    const maxCandidates =
      input.maxCandidates ?? GenerateWaypointCandidatesUseCase.DEFAULT_MAX_CANDIDATES;

    if (minCandidates <= 0 || maxCandidates <= 0 || minCandidates > maxCandidates) {
      throw new Error("Invalid waypoint candidates bounds");
    }

    const targetDistanceMeters = calculateTargetWalkingDistanceMeters({
      targetDurationMinutes: input.targetDurationMinutes,
    });

    const candidates: GeneratedWaypointCandidate[] = [];
    const signatures = new Set<string>();
    let ellipseIndex = 0;
    let maxEllipsesToTry = Math.max(minCandidates, 8);

    while (candidates.length < minCandidates && ellipseIndex < maxEllipsesToTry) {
      const ellipse = this.ellipseGeneration.generate({
        start: input.start,
        targetDistanceMeters,
      });
      const baseWaypoints = this.waypointGeneration.generateOnEllipse({ ellipse });

      for (const phaseOffset of GenerateWaypointCandidatesUseCase.WAYPOINT_PHASE_OFFSETS) {
        if (candidates.length >= maxCandidates) {
          break;
        }

        const variedWaypoints = this.buildWaypointVariant({
          waypoints: baseWaypoints,
          ellipse,
          phaseOffset,
        });

        const signature = this.buildCandidateSignature(variedWaypoints);
        if (signatures.has(signature)) {
          continue;
        }

        signatures.add(signature);
        const candidate = WalkCandidate.create({
          ellipse,
          waypoints: variedWaypoints,
        });
        candidates.push({
          ellipseIndex,
          phaseOffset,
          candidate,
          waypoints: variedWaypoints,
        });
      }

      ellipseIndex += 1;
      if (ellipseIndex >= maxEllipsesToTry && candidates.length < minCandidates) {
        maxEllipsesToTry += 4;
      }
    }

    if (candidates.length < minCandidates) {
      throw new Error("Unable to generate enough unique waypoint candidates");
    }

    return candidates.slice(0, maxCandidates);
  }

  private buildCandidateSignature(waypoints: Waypoint[]): string {
    return waypoints
      .map(
        (waypoint) =>
          `${waypoint.role}:${waypoint.coordinates.latitude.toFixed(6)},${waypoint.coordinates.longitude.toFixed(6)}`,
      )
      .join("|");
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

      const shiftedPosition = (waypoint.positionOnEllipse + input.phaseOffset) % 1;

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

