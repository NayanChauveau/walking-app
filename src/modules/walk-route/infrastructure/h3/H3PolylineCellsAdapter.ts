import { geoToH3Cell } from "@/src/modules/shared/infrastructure/h3/h3ReactNativeClient";

import type { PolylineCellsPort } from "../../application/ports/PolylineCellsPort";
import type { Coordinates } from "../../domain/value-objects/Coordinates";

const DEFAULT_H3_RESOLUTION = 11;

export class H3PolylineCellsAdapter implements PolylineCellsPort {
  extractFromPolyline(input: {
    polyline: Coordinates[];
    resolution?: number;
  }): string[] {
    const resolution = input.resolution ?? DEFAULT_H3_RESOLUTION;
    const uniqueCells = new Set<string>();

    for (const point of input.polyline) {
      uniqueCells.add(geoToH3Cell(point.latitude, point.longitude, resolution));
    }

    return Array.from(uniqueCells);
  }

  extractPathFromPolyline(input: {
    polyline: Coordinates[];
    resolution?: number;
  }): string[] {
    const resolution = input.resolution ?? DEFAULT_H3_RESOLUTION;
    const path: string[] = [];

    for (const point of input.polyline) {
      const cell = geoToH3Cell(point.latitude, point.longitude, resolution);
      const previousCell = path[path.length - 1];

      // Collapse consecutive duplicate cells to keep only transitions.
      if (cell !== previousCell) {
        path.push(cell);
      }
    }

    return path;
  }
}
