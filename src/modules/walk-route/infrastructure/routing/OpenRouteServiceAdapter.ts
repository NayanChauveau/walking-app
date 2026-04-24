import type { RoutingPort } from "../../application/ports/RoutingPort";
import type { WalkCandidate } from "../../domain/entities/WalkCandidate";
import type { WalkRoute } from "../../domain/entities/WalkRoute";
import type { Waypoint } from "../../domain/entities/Waypoint";
import type { Coordinates } from "../../domain/value-objects/Coordinates";

type OpenRouteServiceFeatureCollection = {
  features: {
    geometry: {
      coordinates: [number, number][];
    };
    properties: {
      summary: {
        distance: number;
        duration: number;
      };
    };
  }[];
};

export class OpenRouteServiceAdapter implements RoutingPort {
  constructor(private readonly apiKey: string) {}

  async getWalkingRoute({
    candidate,
    waypoints,
  }: {
    candidate: WalkCandidate;
    waypoints: Waypoint[];
  }): Promise<WalkRoute> {
    const coordinates = [
      ...waypoints.map((waypoint) => [
        waypoint.coordinates.longitude,
        waypoint.coordinates.latitude,
      ]),
      [waypoints[0].coordinates.longitude, waypoints[0].coordinates.latitude],
    ];

    const response = await fetch(
      "https://api.openrouteservice.org/v2/directions/foot-walking/geojson",
      {
        method: "POST",
        headers: {
          Authorization: this.apiKey,
          "Content-Type": "application/json",
          Accept: "application/json, application/geo+json",
        },
        body: JSON.stringify({
          coordinates,
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();

      throw new Error(
        `OpenRouteService error ${response.status}: ${errorBody}`,
      );
    }

    const data = (await response.json()) as OpenRouteServiceFeatureCollection;

    const feature = data.features[0];

    if (!feature) {
      throw new Error("OpenRouteService returned no route");
    }

    const geometry: Coordinates[] = feature.geometry.coordinates.map(
      ([longitude, latitude]) => ({
        latitude,
        longitude,
      }),
    );

    return {
      candidate,
      geometry,
      distanceMeters: feature.properties.summary.distance,
      durationSeconds: feature.properties.summary.duration,
    };
  }
}
