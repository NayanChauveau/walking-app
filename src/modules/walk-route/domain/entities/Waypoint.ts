import type { Coordinates } from "../value-objects/Coordinates";

export type WaypointRole = "start" | "generated";

export type Waypoint = {
  coordinates: Coordinates;
  order: number;
  role: WaypointRole;
  positionOnEllipse: number; // normalized in [0, 1)
};
