import type { EllipseGenerationPort } from "../../application/ports/EllipseGenerationPort";
import type { Coordinates } from "../../domain/value-objects/Coordinates";
import type { RandomPort } from "../../domain/ports/RandomPort";
import { EllipseGenerator } from "../../domain/services/EllipseGenerator";

export class DomainEllipseGenerationAdapter implements EllipseGenerationPort {
  constructor(
    private readonly random: RandomPort,
    private readonly ellipseGenerator = new EllipseGenerator(),
  ) {}

  generate(input: { start: Coordinates; targetDistanceMeters: number }) {
    return this.ellipseGenerator.generate({
      start: input.start,
      targetDistanceMeters: input.targetDistanceMeters,
      random: this.random,
    });
  }
}
