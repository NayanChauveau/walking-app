import type { Coordinates } from "../../domain/value-objects/Coordinates";
import type { UserStartPointCachePort } from "../ports/UserStartPointCachePort";

type Input = {
  startPoint: Coordinates;
};

export class SaveLastKnownUserStartPointUseCase {
  constructor(private readonly userStartPointCache: UserStartPointCachePort) {}

  async execute(input: Input): Promise<void> {
    await this.userStartPointCache.saveLastKnownUserStartPoint(input.startPoint);
  }
}

