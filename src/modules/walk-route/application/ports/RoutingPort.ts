import type { WalkCandidate } from "../../domain/entities/WalkCandidate";
import type { WalkRoute } from "../../domain/entities/WalkRoute";
import type { Waypoint } from "../../domain/entities/Waypoint";

export interface RoutingPort {
  getWalkingRoute(input: {
    candidate: WalkCandidate;
    waypoints: Waypoint[];
  }): Promise<WalkRoute>;
}
