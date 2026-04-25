import type { Ellipse } from "../../domain/entities/Ellipse";
import { calculateTargetWalkingDistanceMeters } from "../../domain/services/WalkingDistanceCalculator";
import type { Coordinates } from "../../domain/value-objects/Coordinates";
import type { EllipseGenerationPort } from "../ports/EllipseGenerationPort";

type Input = {
  start: Coordinates;
  targetDurationMinutes: number;
};

export class GenerateEllipseForWalkUseCase {
  constructor(private readonly ellipseGeneration: EllipseGenerationPort) {}

  execute(input: Input): Ellipse {
    const targetDistanceMeters = calculateTargetWalkingDistanceMeters({
      targetDurationMinutes: input.targetDurationMinutes,
    });

    return this.ellipseGeneration.generate({
      start: input.start,
      targetDistanceMeters,
    });
  }
}
