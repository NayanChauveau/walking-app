import type { Ellipse } from "../../domain/entities/Ellipse";
import { EllipseGenerator } from "../../domain/services/EllipseGenerator";
import type { Coordinates } from "../../domain/value-objects/Coordinates";
import type { RandomPort } from "../ports/RandomPort";

type Input = {
  start: Coordinates;
  targetDurationMinutes: number;
};

export class GenerateEllipseForWalkUseCase {
  constructor(
    private readonly random: RandomPort,
    private readonly ellipseGenerator = new EllipseGenerator(),
  ) {}

  execute(input: Input): Ellipse {
    const walkingSpeedMetersPerMinute = 80;

    const targetDistanceMeters =
      input.targetDurationMinutes * walkingSpeedMetersPerMinute;

    return this.ellipseGenerator.generate({
      start: input.start,
      targetDistanceMeters,
      random: this.random,
    });
  }
}
