import type { Coordinates } from "../value-objects/Coordinates";
import type { WalkCandidate } from "./WalkCandidate";

export type WalkRouteScoring = {
  totalScore: number;
  noveltyScore: number;
  loopQualityScore: number;
  targetDistanceScore: number;
  targetDurationScore: number;
  poiPleasureScore: number;
  parkProximityScore: number;
  waterProximityScore: number;
  backtrackRatio: number;
  revisitRatio: number;
  repeatedEdgeRatio: number;
  isRejected: boolean;
  rejectionReason: string | null;
};

export type WalkRouteAlternative = {
  geometry: Coordinates[];
  distanceMeters: number;
  durationSeconds: number;
  scoring: WalkRouteScoring;
};

export type WalkRoute = {
  candidate: WalkCandidate;
  geometry: Coordinates[];
  distanceMeters: number;
  durationSeconds: number;
  scoring?: WalkRouteScoring;
  alternatives?: {
    novelty?: WalkRouteAlternative;
    poi?: WalkRouteAlternative;
  };
};
