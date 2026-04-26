import type { Ellipse } from "../entities/Ellipse";
import type { Waypoint } from "../entities/Waypoint";
import type { Coordinates } from "../value-objects/Coordinates";

type GenerateInput = {
  ellipse: Ellipse;
};

export class WaypointGenerator {
  private static readonly TOTAL_WAYPOINTS = 7; // start + 6 waypoints

  generateOnEllipse({ ellipse }: GenerateInput): Waypoint[] {
    return Array.from(
      { length: WaypointGenerator.TOTAL_WAYPOINTS },
      (_, index): Waypoint => {
        if (index === 0) {
          return {
            coordinates: ellipse.start,
            order: 0,
            role: "start",
            positionOnEllipse: 0,
          };
        }

        const positionOnEllipse = index / WaypointGenerator.TOTAL_WAYPOINTS;
        return {
          coordinates: this.getPointOnEllipse(ellipse, positionOnEllipse),
          order: index,
          role: "generated",
          positionOnEllipse,
        };
      },
    );
  }

  private getPointOnEllipse(ellipse: Ellipse, position: number): Coordinates {
    const angle = position * Math.PI * 2;

    const x = ellipse.semiMajorMeters * Math.cos(angle);
    const y = ellipse.semiMinorMeters * Math.sin(angle);

    const rotatedX =
      x * Math.cos(ellipse.rotationRadians) -
      y * Math.sin(ellipse.rotationRadians);

    const rotatedY =
      x * Math.sin(ellipse.rotationRadians) +
      y * Math.cos(ellipse.rotationRadians);

    return this.offsetCoordinates(ellipse.center, rotatedX, rotatedY);
  }

  private offsetCoordinates(
    origin: Coordinates,
    eastMeters: number,
    northMeters: number,
  ): Coordinates {
    const earthRadiusMeters = 6_371_000;

    const deltaLatitude = northMeters / earthRadiusMeters;

    const deltaLongitude =
      eastMeters /
      (earthRadiusMeters * Math.cos((origin.latitude * Math.PI) / 180));

    return {
      latitude: origin.latitude + (deltaLatitude * 180) / Math.PI,
      longitude: origin.longitude + (deltaLongitude * 180) / Math.PI,
    };
  }
}
