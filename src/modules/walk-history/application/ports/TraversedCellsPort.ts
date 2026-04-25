import type { Coordinates } from "@/src/modules/walk-route";

export interface TraversedCellsPort {
  extractFromPolyline(input: {
    polyline: Coordinates[];
    resolution?: number;
  }): string[];
}
