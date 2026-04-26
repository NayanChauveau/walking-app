import type { Coordinates } from "../../domain/value-objects/Coordinates";
import type { EnsureLocalPoiCoveragePort } from "../ports/EnsureLocalPoiCoveragePort";

type Input = {
  center: Coordinates;
  radiusMeters: number;
};

export class EnsureLocalPoiCoverageUseCase {
  constructor(private readonly poiCoverage: EnsureLocalPoiCoveragePort) {}

  async execute(input: Input): Promise<void> {
    await this.poiCoverage.ensureCoverage(input);
  }
}
