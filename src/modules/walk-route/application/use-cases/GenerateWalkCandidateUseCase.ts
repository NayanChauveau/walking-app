import type { WalkCandidate } from "../../domain/entities/WalkCandidate";
import { calculateTargetWalkingDistanceMeters } from "../../domain/services/WalkingDistanceCalculator";
import type { Coordinates } from "../../domain/value-objects/Coordinates";
import type { EllipseGenerationPort } from "../ports/EllipseGenerationPort";
import type { WaypointGenerationPort } from "../ports/WaypointGenerationPort";

type Input = {
  start: Coordinates;
  targetDurationMinutes: number;
};

export class GenerateWalkCandidateUseCase {
  constructor(
    private readonly ellipseGeneration: EllipseGenerationPort,
    private readonly waypointGeneration: WaypointGenerationPort,
  ) {}

  execute(input: Input): WalkCandidate {
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

    return {
      ellipse,
      waypoints,
    };
  }
}
