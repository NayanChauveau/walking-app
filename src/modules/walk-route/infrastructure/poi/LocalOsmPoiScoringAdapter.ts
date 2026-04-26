import * as FileSystem from "expo-file-system/legacy";

import type { EnsureLocalPoiCoveragePort } from "../../application/ports/EnsureLocalPoiCoveragePort";
import type { PoiScoringPort } from "../../application/ports/PoiScoringPort";
import type { Coordinates } from "../../domain/value-objects/Coordinates";

const PROXIMITY_RADIUS_METERS = 600;
const MAX_ROUTE_SAMPLES = 48;
const MAPBOX_TILESET_ID = "mapbox.mapbox-streets-v8";
const MAPBOX_TILEQUERY_LIMIT = 50;
const POI_CACHE_DIR = `${FileSystem.documentDirectory}poi`;
const POI_CACHE_FILE_PATH = `${POI_CACHE_DIR}/local-mapbox-poi-cache.json`;

type PoiPoint = {
  id: string;
  kind: "park" | "water";
  coordinates: Coordinates;
};

type CachePayload = {
  center: Coordinates;
  radiusMeters: number;
  updatedAtIso: string;
  points: PoiPoint[];
};

type MapboxTilequeryResponse = {
  features?: MapboxTilequeryFeature[];
};

type MapboxTilequeryFeature = {
  id?: string | number;
  properties?: Record<string, unknown>;
  geometry?: {
    type?: string;
    coordinates?: [number, number];
  };
};

export class LocalOsmPoiScoringAdapter
  implements PoiScoringPort, EnsureLocalPoiCoveragePort
{
  private currentPoints: PoiPoint[] = [];
  private currentCoverage: { center: Coordinates; radiusMeters: number } | null = null;
  private currentDataSource: "cache" | "downloaded" | "none" = "none";

  constructor(private readonly mapboxAccessToken: string) {}

  async ensureCoverage(input: {
    center: Coordinates;
    radiusMeters: number;
  }): Promise<void> {
    if (this.isCoverageSufficient(input.center, input.radiusMeters)) {
      this.logCurrentSource();
      return;
    }

    const cached = await this.readCacheIfAny();
    if (
      cached &&
      this.isCoverageSufficient(
        input.center,
        input.radiusMeters,
        cached.center,
        cached.radiusMeters,
      )
    ) {
      this.currentPoints = cached.points;
      this.currentCoverage = {
        center: cached.center,
        radiusMeters: cached.radiusMeters,
      };
      this.currentDataSource = "cache";
      this.logCurrentSource();
      return;
    }

    const fetched = await this.fetchMapboxPoiPoints(input);
    if (fetched.length > 0) {
      this.currentPoints = fetched;
      this.currentCoverage = {
        center: input.center,
        radiusMeters: input.radiusMeters,
      };
      this.currentDataSource = "downloaded";
      await this.writeCache({
        center: input.center,
        radiusMeters: input.radiusMeters,
        updatedAtIso: new Date().toISOString(),
        points: fetched,
      });
      this.logCurrentSource();
    } else if (cached) {
      // Keep stale cached dataset rather than emptying scoring context.
      this.currentPoints = cached.points;
      this.currentCoverage = {
        center: cached.center,
        radiusMeters: cached.radiusMeters,
      };
      this.currentDataSource = "cache";
      this.logCurrentSource();
    } else {
      this.currentPoints = [];
      this.currentCoverage = null;
      this.currentDataSource = "none";
      this.logCurrentSource();
      throw new Error(
        "POI local coverage unavailable: Overpass download failed and no local cache exists.",
      );
    }
  }

  scoreRouteContext(input: {
    polyline: Coordinates[];
  }): {
    poiPleasureScore: number;
    parkProximityScore: number;
    waterProximityScore: number;
  } {
    if (input.polyline.length < 2) {
      throw new Error("POI scoring failed: route geometry is too short.");
    }
    if (this.currentPoints.length === 0) {
      throw new Error("POI scoring failed: no local POI dataset loaded.");
    }

    const routeSamples = this.sampleRoute(input.polyline);
    const parkPoints = this.currentPoints.filter((pointValue) => pointValue.kind === "park");
    const waterPoints = this.currentPoints.filter(
      (pointValue) => pointValue.kind === "water",
    );

    const parkProximityScore = this.scorePointsProximity(routeSamples, parkPoints);
    const waterProximityScore = this.scorePointsProximity(routeSamples, waterPoints, {
      boostClosestApproach: true,
    });
    const poiPleasureScore = this.clamp01(
      parkProximityScore * 0.6 + waterProximityScore * 0.4,
    );

    return {
      poiPleasureScore,
      parkProximityScore,
      waterProximityScore,
    };
  }

  private sampleRoute(polyline: Coordinates[]): Coordinates[] {
    if (polyline.length <= MAX_ROUTE_SAMPLES) {
      return polyline;
    }

    const samples: Coordinates[] = [];
    const step = Math.ceil(polyline.length / MAX_ROUTE_SAMPLES);
    for (let index = 0; index < polyline.length; index += step) {
      samples.push(polyline[index]);
    }

    const lastPoint = polyline[polyline.length - 1];
    const sampledLastPoint = samples[samples.length - 1];
    if (
      !sampledLastPoint ||
      sampledLastPoint.latitude !== lastPoint.latitude ||
      sampledLastPoint.longitude !== lastPoint.longitude
    ) {
      samples.push(lastPoint);
    }

    return samples;
  }

  private async fetchMapboxPoiPoints(input: {
    center: Coordinates;
    radiusMeters: number;
  }): Promise<PoiPoint[]> {
    const queryCenters = [
      input.center,
      this.offsetCoordinates(input.center, input.radiusMeters * 0.5, 0),
      this.offsetCoordinates(input.center, -input.radiusMeters * 0.5, 0),
      this.offsetCoordinates(input.center, 0, input.radiusMeters * 0.5),
      this.offsetCoordinates(input.center, 0, -input.radiusMeters * 0.5),
    ];
    const pointsById = new Map<string, PoiPoint>();

    for (const center of queryCenters) {
      try {
        const response = await fetch(
          `https://api.mapbox.com/v4/${MAPBOX_TILESET_ID}/tilequery/${center.longitude},${center.latitude}.json?radius=${Math.round(input.radiusMeters)}&limit=${MAPBOX_TILEQUERY_LIMIT}&layers=landuse,water,waterway&access_token=${this.mapboxAccessToken}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          },
        );

        if (!response.ok) {
          console.log("[poi-local] mapbox request failed", {
            center,
            status: response.status,
            statusText: response.statusText,
          });
          continue;
        }

        const data = (await response.json()) as MapboxTilequeryResponse;
        const points = (data.features ?? []).flatMap((feature, index) =>
          this.normalizeMapboxFeature(feature, index),
        );
        for (const poiPoint of points) {
          pointsById.set(poiPoint.id, poiPoint);
        }
        console.log("[poi-local] mapbox request success", {
          center,
          featuresCount: data.features?.length ?? 0,
          normalizedPointsCount: points.length,
        });
      } catch (error) {
        console.log("[poi-local] mapbox request error", {
          center,
          error,
        });
      }
    }

    return Array.from(pointsById.values());
  }

  private normalizeMapboxFeature(
    feature: MapboxTilequeryFeature,
    index: number,
  ): PoiPoint[] {
    const kind = this.classifyMapboxKind(feature.properties);
    if (!kind) {
      return [];
    }

    if (feature.geometry?.type !== "Point" || !feature.geometry.coordinates) {
      return [];
    }

    const [longitude, latitude] = feature.geometry.coordinates;
    const pointId = `${kind}:${String(feature.id ?? index + 1)}:${latitude.toFixed(6)}:${longitude.toFixed(6)}`;

    return [
      {
        id: pointId,
        kind,
        coordinates: {
          latitude,
          longitude,
        },
      },
    ];
  }

  private classifyMapboxKind(
    properties?: Record<string, unknown>,
  ): "park" | "water" | null {
    if (!properties) {
      return null;
    }

    const classValue = String(properties.class ?? "").toLowerCase();
    const typeValue = String(properties.type ?? "").toLowerCase();
    const layerValue = String(properties.layer ?? "").toLowerCase();

    if (
      classValue.includes("park") ||
      classValue.includes("garden") ||
      typeValue.includes("park") ||
      typeValue.includes("garden") ||
      layerValue === "landuse"
    ) {
      return "park";
    }

    if (
      classValue.includes("water") ||
      classValue.includes("river") ||
      classValue.includes("stream") ||
      typeValue.includes("water") ||
      typeValue.includes("river") ||
      layerValue === "water" ||
      layerValue === "waterway"
    ) {
      return "water";
    }

    return null;
  }

  private async readCacheIfAny(): Promise<CachePayload | null> {
    try {
      const info = await FileSystem.getInfoAsync(POI_CACHE_FILE_PATH);
      if (!info.exists) {
        return null;
      }

      const content = await FileSystem.readAsStringAsync(POI_CACHE_FILE_PATH);
      const parsed = JSON.parse(content) as CachePayload;
      if (!Array.isArray(parsed.points)) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private async writeCache(payload: CachePayload): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(POI_CACHE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(POI_CACHE_DIR, { intermediates: true });
    }
    await FileSystem.writeAsStringAsync(POI_CACHE_FILE_PATH, JSON.stringify(payload));
  }

  private isCoverageSufficient(
    center: Coordinates,
    requestedRadiusMeters: number,
    coverageCenter?: Coordinates,
    coverageRadiusMeters?: number,
  ): boolean {
    const effectiveCenter = coverageCenter ?? this.currentCoverage?.center;
    const effectiveRadius = coverageRadiusMeters ?? this.currentCoverage?.radiusMeters;
    if (!effectiveCenter || !effectiveRadius) {
      return false;
    }

    const centerDistance = this.getDistanceMeters(center, effectiveCenter);
    const remainingRadius = effectiveRadius - centerDistance;
    return remainingRadius >= requestedRadiusMeters * 0.8;
  }

  private logCurrentSource(): void {
    console.log("[poi-local] dataset in use", {
      source: this.currentDataSource,
      pointsCount: this.currentPoints.length,
      coverageCenter: this.currentCoverage?.center ?? null,
      coverageRadiusMeters: this.currentCoverage?.radiusMeters ?? null,
    });
  }

  private scorePointsProximity(
    routeSamples: Coordinates[],
    points: PoiPoint[],
    options?: {
      boostClosestApproach?: boolean;
    },
  ): number {
    if (points.length === 0) {
      return 0.5;
    }

    let cumulative = 0;
    let globalMinDistance = Number.POSITIVE_INFINITY;
    for (const sample of routeSamples) {
      const minDistance = points.reduce((currentMin, poiPoint) => {
        const distance = this.getDistanceMeters(sample, poiPoint.coordinates);
        return Math.min(currentMin, distance);
      }, Number.POSITIVE_INFINITY);
      globalMinDistance = Math.min(globalMinDistance, minDistance);

      // 1 when inside/very close; 0 when far beyond radius.
      const proximity = this.clamp01(1 - minDistance / PROXIMITY_RADIUS_METERS);
      cumulative += proximity;
    }

    const averageProximity = this.clamp01(cumulative / routeSamples.length);
    if (!options?.boostClosestApproach) {
      return averageProximity;
    }

    const closestApproachScore = this.clamp01(
      1 - globalMinDistance / (PROXIMITY_RADIUS_METERS * 1.25),
    );
    // If the route gets very close to water at any point, keep a non-trivial signal.
    const boosted = Math.max(averageProximity, closestApproachScore * 0.85);
    return this.clamp01(boosted);
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

  private offsetCoordinates(
    origin: Coordinates,
    eastMeters: number,
    northMeters: number,
  ): Coordinates {
    const earthRadiusMeters = 6_371_000;
    const deltaLatitude = northMeters / earthRadiusMeters;
    const deltaLongitude =
      eastMeters /
      (earthRadiusMeters * Math.max(0.00001, Math.cos((origin.latitude * Math.PI) / 180)));

    return {
      latitude: origin.latitude + (deltaLatitude * 180) / Math.PI,
      longitude: origin.longitude + (deltaLongitude * 180) / Math.PI,
    };
  }

  private clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}
