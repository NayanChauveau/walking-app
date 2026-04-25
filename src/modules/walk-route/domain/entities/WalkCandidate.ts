import type { Ellipse } from "./Ellipse";
import type { Waypoint } from "./Waypoint";

export class WalkCandidate {
  private constructor(
    public readonly ellipse: Ellipse,
    public readonly waypoints: Waypoint[],
  ) {}

  static create(input: { ellipse: Ellipse; waypoints: Waypoint[] }) {
    if (input.waypoints.length < 2) {
      throw new Error("A walk candidate must have at least 2 waypoints");
    }

    return new WalkCandidate(input.ellipse, input.waypoints);
  }
}
