import type { Ellipse } from "./Ellipse";
import type { Waypoint } from "./Waypoint";

export type WalkCandidate = {
  ellipse: Ellipse;
  waypoints: Waypoint[];
};
