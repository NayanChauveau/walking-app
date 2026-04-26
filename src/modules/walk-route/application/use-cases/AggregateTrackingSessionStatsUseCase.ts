import type { Coordinates } from "../../domain/value-objects/Coordinates";

export type TrackingSample = {
  coordinates: Coordinates;
  timestampMs: number;
};

export type TrackingSessionStats = {
  trackedDistanceMeters: number;
  currentSpeedKmh: number;
  averageSpeedKmh: number;
  traversedRouteIndex: number;
  progressPercent: number;
  lastSample: TrackingSample | null;
  speedSamplesKmh: number[];
};

type Input = {
  routeGeometry: Coordinates[];
  currentSample: TrackingSample;
  previousStats: TrackingSessionStats;
};

const MAX_REALISTIC_WALKING_SPEED_KMH = 25;

export class AggregateTrackingSessionStatsUseCase {
  execute(input: Input): TrackingSessionStats {
    const nearestRouteIndex = this.findNearestGeometryIndex(
      input.routeGeometry,
      input.currentSample.coordinates,
    );
    const progressPercent = this.computeProgressPercent(
      input.routeGeometry,
      nearestRouteIndex,
    );

    if (!input.previousStats.lastSample) {
      return {
        ...input.previousStats,
        traversedRouteIndex: nearestRouteIndex,
        progressPercent,
        lastSample: input.currentSample,
      };
    }

    const segmentDistanceMeters = this.getDistanceMeters(
      input.previousStats.lastSample.coordinates,
      input.currentSample.coordinates,
    );
    const elapsedSeconds = Math.max(
      0.001,
      (input.currentSample.timestampMs - input.previousStats.lastSample.timestampMs) / 1000,
    );
    const instantSpeedKmh = (segmentDistanceMeters / elapsedSeconds) * 3.6;
    const boundedInstantSpeedKmh = Math.min(
      MAX_REALISTIC_WALKING_SPEED_KMH,
      Math.max(0, instantSpeedKmh),
    );
    const speedSamplesKmh = [
      ...input.previousStats.speedSamplesKmh,
      boundedInstantSpeedKmh,
    ];
    const averageSpeedKmh =
      speedSamplesKmh.reduce((sum, speed) => sum + speed, 0) / speedSamplesKmh.length;

    return {
      trackedDistanceMeters:
        input.previousStats.trackedDistanceMeters + segmentDistanceMeters,
      currentSpeedKmh: boundedInstantSpeedKmh,
      averageSpeedKmh,
      traversedRouteIndex: nearestRouteIndex,
      progressPercent,
      lastSample: input.currentSample,
      speedSamplesKmh,
    };
  }

  createInitialStats(): TrackingSessionStats {
    return {
      trackedDistanceMeters: 0,
      currentSpeedKmh: 0,
      averageSpeedKmh: 0,
      traversedRouteIndex: 0,
      progressPercent: 0,
      lastSample: null,
      speedSamplesKmh: [],
    };
  }

  private findNearestGeometryIndex(
    geometry: Coordinates[],
    current: Coordinates,
  ): number {
    if (geometry.length <= 1) {
      return 0;
    }

    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < geometry.length; index += 1) {
      const distance = this.getDistanceMeters(geometry[index], current);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    }

    return nearestIndex;
  }

  private computeProgressPercent(geometry: Coordinates[], nearestIndex: number): number {
    if (geometry.length <= 1) {
      return 0;
    }

    const progress = (nearestIndex / (geometry.length - 1)) * 100;
    return Math.max(0, Math.min(100, progress));
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
