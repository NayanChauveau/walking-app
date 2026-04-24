import type { Coordinates } from "../value-objects/Coordinates";

export type WaypointRole = "start" | "quarter" | "half" | "three-quarters";

export type Waypoint = {
  coordinates: Coordinates;
  order: number;
  role: WaypointRole;
  positionOnEllipse: number; // 0, 0.25, 0.5, 0.75
};
