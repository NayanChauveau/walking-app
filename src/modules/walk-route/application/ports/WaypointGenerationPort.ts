import type { Ellipse } from "../../domain/entities/Ellipse";
import type { Waypoint } from "../../domain/entities/Waypoint";

export interface WaypointGenerationPort {
  generateOnEllipse(input: {
    ellipse: Ellipse;
  }): Waypoint[];
}
