import type { Coordinates } from "../../domain/value-objects/Coordinates";

export type UserStartPointCachePort = {
  getLastKnownUserStartPoint(): Promise<Coordinates | null>;
  saveLastKnownUserStartPoint(startPoint: Coordinates): Promise<void>;
};

