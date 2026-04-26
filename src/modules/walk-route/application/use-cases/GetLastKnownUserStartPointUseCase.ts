import type { Coordinates } from "../../domain/value-objects/Coordinates";
import type { UserStartPointCachePort } from "../ports/UserStartPointCachePort";

export class GetLastKnownUserStartPointUseCase {
  constructor(private readonly userStartPointCache: UserStartPointCachePort) {}

  async execute(): Promise<Coordinates | null> {
    return this.userStartPointCache.getLastKnownUserStartPoint();
  }
}

