import type { Coordinates } from "../../domain/value-objects/Coordinates";

export interface EnsureLocalPoiCoveragePort {
  ensureCoverage(input: {
    center: Coordinates;
    radiusMeters: number;
  }): Promise<void>;
}
