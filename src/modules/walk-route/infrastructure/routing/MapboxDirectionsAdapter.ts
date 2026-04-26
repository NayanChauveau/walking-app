import { lineString, point } from "@turf/helpers";
import { nearestPointOnLine as nearestPointOnLineTurf } from "@turf/nearest-point-on-line";

import type { RoutingPort } from "../../application/ports/RoutingPort";
import type { WalkCandidate } from "../../domain/entities/WalkCandidate";
import type { WalkRoute } from "../../domain/entities/WalkRoute";
import type { Waypoint } from "../../domain/entities/Waypoint";
import type { Coordinates } from "../../domain/value-objects/Coordinates";

type MapboxDirectionsResponse = {
  routes?: {
    distance: number;
    duration: number;
    geometry: {
      coordinates: [number, number][];
    };
  }[];
  message?: string;
};

export class MapboxDirectionsAdapter implements RoutingPort {
  private static readonly ELLIPSE_SNAP_SAMPLE_COUNT = 96;
  private static readonly MAX_SNAP_DISTANCE_METERS = 80;

  constructor(private readonly accessToken: string) {}

  async getWalkingRoute(input: {
    candidate: WalkCandidate;
    waypoints: Waypoint[];
  }): Promise<WalkRoute> {
    const snappedWaypoints = this.snapWaypointsLocally({
      candidate: input.candidate,
      waypoints: input.waypoints,
    });

    console.log("[mapbox-directions] waypoint snap", {
      before: input.waypoints.map((waypoint) => waypoint.coordinates),
      after: snappedWaypoints.map((waypoint) => waypoint.coordinates),
    });

    const loopCoordinates = [
      ...snappedWaypoints.map((waypoint) => waypoint.coordinates),
      snappedWaypoints[0].coordinates,
    ];
    const coordinatesPath = loopCoordinates
      .map((point) => `${point.longitude},${point.latitude}`)
      .join(";");

    const requestUrl = new URL(
      `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinatesPath}`,
    );
    requestUrl.searchParams.set("alternatives", "false");
    requestUrl.searchParams.set("continue_straight", "true");
    requestUrl.searchParams.set("geometries", "geojson");
    requestUrl.searchParams.set("overview", "full");
    requestUrl.searchParams.set("steps", "false");
    requestUrl.searchParams.set("access_token", this.accessToken);

    const response = await fetch(requestUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Mapbox Directions error ${response.status}: ${errorBody}`);
    }

    const data = (await response.json()) as MapboxDirectionsResponse;
    const route = data.routes?.[0];

    if (!route) {
      throw new Error(`Mapbox Directions returned no route: ${data.message ?? "unknown error"}`);
    }

    const geometry: Coordinates[] = route.geometry.coordinates.map(
      ([longitude, latitude]) => ({
        latitude,
        longitude,
      }),
    );

    return {
      candidate: input.candidate,
      geometry,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
    };
  }

  private snapWaypointsLocally(input: {
    candidate: WalkCandidate;
    waypoints: Waypoint[];
  }): Waypoint[] {
    const ellipsePolyline = this.createEllipsePolyline(input.candidate);
    const ellipseLine = lineString(
      ellipsePolyline.map((coordinates) => [coordinates.longitude, coordinates.latitude]),
    );

    return input.waypoints.map((waypoint) => {
      const nearestPoint = nearestPointOnLineTurf(
        ellipseLine,
        point([waypoint.coordinates.longitude, waypoint.coordinates.latitude]),
        { units: "meters" },
      );
      const [snappedLongitude, snappedLatitude] = nearestPoint.geometry.coordinates;
      const snappedCoordinates: Coordinates = {
        latitude: snappedLatitude,
        longitude: snappedLongitude,
      };
      const snapDistanceMeters = this.getDistanceMeters(
        waypoint.coordinates,
        snappedCoordinates,
      );

      if (snapDistanceMeters > MapboxDirectionsAdapter.MAX_SNAP_DISTANCE_METERS) {
        return waypoint;
      }

      return {
        ...waypoint,
        coordinates: snappedCoordinates,
      };
    });
  }

  private createEllipsePolyline(candidate: WalkCandidate): Coordinates[] {
    const points: Coordinates[] = [];
    const sampleCount = MapboxDirectionsAdapter.ELLIPSE_SNAP_SAMPLE_COUNT;

    for (let index = 0; index <= sampleCount; index += 1) {
      const t = index / sampleCount;
      const angle = t * Math.PI * 2;
      const x = candidate.ellipse.semiMajorMeters * Math.cos(angle);
      const y = candidate.ellipse.semiMinorMeters * Math.sin(angle);

      const rotatedX =
        x * Math.cos(candidate.ellipse.rotationRadians) -
        y * Math.sin(candidate.ellipse.rotationRadians);
      const rotatedY =
        x * Math.sin(candidate.ellipse.rotationRadians) +
        y * Math.cos(candidate.ellipse.rotationRadians);

      const deltaLatitude = rotatedY / 111_320;
      const deltaLongitude =
        rotatedX /
        (111_320 * Math.max(0.00001, Math.cos((candidate.ellipse.center.latitude * Math.PI) / 180)));

      points.push({
        latitude: candidate.ellipse.center.latitude + deltaLatitude,
        longitude: candidate.ellipse.center.longitude + deltaLongitude,
      });
    }

    return points;
  }

  private getDistanceMeters(left: Coordinates, right: Coordinates): number {
    const earthRadiusMeters = 6_371_000;
    const latitudeDiffRadians = ((right.latitude - left.latitude) * Math.PI) / 180;
    const longitudeDiffRadians = ((right.longitude - left.longitude) * Math.PI) / 180;
    const leftLatitudeRadians = (left.latitude * Math.PI) / 180;
    const rightLatitudeRadians = (right.latitude * Math.PI) / 180;

    const haversine =
      Math.sin(latitudeDiffRadians / 2) ** 2 +
      Math.cos(leftLatitudeRadians) *
        Math.cos(rightLatitudeRadians) *
        Math.sin(longitudeDiffRadians / 2) ** 2;

    return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  }
}

