import { WalkCandidate } from "../../domain/entities/WalkCandidate";
import { calculateTargetWalkingDistanceMeters } from "../../domain/services/WalkingDistanceCalculator";
import type { WalkRoute } from "../../domain/entities/WalkRoute";
import type { Coordinates } from "../../domain/value-objects/Coordinates";
import type { EllipseGenerationPort } from "../ports/EllipseGenerationPort";
import type { RoutingPort } from "../ports/RoutingPort";
import type { WaypointGenerationPort } from "../ports/WaypointGenerationPort";

type Input = {
  start: Coordinates;
  targetDurationMinutes: number;
};

export class GenerateWalkRouteUseCase {
  constructor(
    private readonly routing: RoutingPort,
    private readonly ellipseGeneration: EllipseGenerationPort,
    private readonly waypointGeneration: WaypointGenerationPort,
  ) {}

  async execute(input: Input): Promise<WalkRoute> {
    const targetDistanceMeters = calculateTargetWalkingDistanceMeters({
      targetDurationMinutes: input.targetDurationMinutes,
    });

    const ellipse = this.ellipseGeneration.generate({
      start: input.start,
      targetDistanceMeters,
    });

    const waypoints = this.waypointGeneration.generateOnEllipse({
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
