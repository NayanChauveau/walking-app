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
  constructor(private readonly accessToken: string) {}

  async getWalkingRoute(input: {
    candidate: WalkCandidate;
    waypoints: Waypoint[];
  }): Promise<WalkRoute> {
    const loopCoordinates = [
      ...input.waypoints.map((waypoint) => waypoint.coordinates),
      input.waypoints[0].coordinates,
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
    console.log("[mapbox-directions] response", {
      hasRoutes: Boolean(data.routes?.length),
      routesCount: data.routes?.length ?? 0,
      firstRouteDistanceMeters: data.routes?.[0]?.distance ?? null,
      firstRouteDurationSeconds: data.routes?.[0]?.duration ?? null,
      message: data.message ?? null,
    });
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
}

