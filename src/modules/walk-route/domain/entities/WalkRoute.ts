import type { Coordinates } from "../value-objects/Coordinates";
import type { WalkCandidate } from "./WalkCandidate";

export type WalkRoute = {
  candidate: WalkCandidate;
  geometry: Coordinates[];
  distanceMeters: number;
  durationSeconds: number;
  scoring?: {
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
};
