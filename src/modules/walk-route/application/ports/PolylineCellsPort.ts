import type { Coordinates } from "../../domain/value-objects/Coordinates";

export interface PolylineCellsPort {
  extractFromPolyline(input: {
    polyline: Coordinates[];
    resolution?: number;
  }): string[];
}
