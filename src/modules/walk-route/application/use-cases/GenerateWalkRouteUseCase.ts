import { WalkCandidate } from "../../domain/entities/WalkCandidate";
import type { WalkRoute } from "../../domain/entities/WalkRoute";
import type { EllipseGenerator } from "../../domain/services/EllipseGenerator";
import type { WaypointGenerator } from "../../domain/services/WaypointGenerator";
import type { Coordinates } from "../../domain/value-objects/Coordinates";
import type { RandomPort } from "../ports/RandomPort";
import type { RoutingPort } from "../ports/RoutingPort";

type Input = {
  start: Coordinates;
  targetDurationMinutes: number;
};

export class GenerateWalkRouteUseCase {
  constructor(
    private readonly random: RandomPort,
    private readonly routing: RoutingPort,
    private readonly ellipseGenerator: EllipseGenerator,
    private readonly waypointGenerator: WaypointGenerator,
  ) {}

  async execute(input: Input): Promise<WalkRoute> {
    const walkingSpeedMetersPerMinute = 80;

    const targetDistanceMeters =
      input.targetDurationMinutes * walkingSpeedMetersPerMinute;

    const ellipse = this.ellipseGenerator.generate({
      start: input.start,
      targetDistanceMeters,
      random: this.random,
    });

    const waypoints = this.waypointGenerator.generateOnEllipse({
      ellipse,
    });

    const candidate = WalkCandidate.create({
      ellipse,
      waypoints,
    });

    return this.routing.getWalkingRoute({
      candidate,
      waypoints,
    });
  }
}
