import type { WalkCandidate } from "../../domain/entities/WalkCandidate";
import { EllipseGenerator } from "../../domain/services/EllipseGenerator";
import { WaypointGenerator } from "../../domain/services/WaypointGenerator";
import type { Coordinates } from "../../domain/value-objects/Coordinates";
import type { RandomPort } from "../ports/RandomPort";

type Input = {
  start: Coordinates;
  targetDurationMinutes: number;
};

export class GenerateWalkCandidateUseCase {
  constructor(
    private readonly random: RandomPort,
    private readonly ellipseGenerator = new EllipseGenerator(),
    private readonly waypointGenerator = new WaypointGenerator(),
  ) {}

  execute(input: Input): WalkCandidate {
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

    return {
      ellipse,
      waypoints,
    };
  }
}
