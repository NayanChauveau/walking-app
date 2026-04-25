import type { Ellipse } from "../../domain/entities/Ellipse";
import type { Coordinates } from "../../domain/value-objects/Coordinates";

export interface EllipseGenerationPort {
  generate(input: {
    start: Coordinates;
    targetDistanceMeters: number;
  }): Ellipse;
}
