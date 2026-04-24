import type { Coordinates } from "../value-objects/Coordinates";
import type { WalkCandidate } from "./WalkCandidate";

export type WalkRoute = {
  candidate: WalkCandidate;
  geometry: Coordinates[];
  distanceMeters: number;
  durationSeconds: number;
};
