import type { Coordinates } from "../../domain/value-objects/Coordinates";

export interface PoiScoringPort {
  scoreRouteContext(input: {
    polyline: Coordinates[];
  }): {
    poiPleasureScore: number;
    parkProximityScore: number;
    waterProximityScore: number;
  };
}
