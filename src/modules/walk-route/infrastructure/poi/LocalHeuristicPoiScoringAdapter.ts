import type { PoiScoringPort } from "../../application/ports/PoiScoringPort";
import type { Coordinates } from "../../domain/value-objects/Coordinates";

// Local MVP placeholder until real offline POI datasets are integrated.
export class LocalHeuristicPoiScoringAdapter implements PoiScoringPort {
  scoreRouteContext(input: {
    polyline: Coordinates[];
  }): {
    poiPleasureScore: number;
    parkProximityScore: number;
    waterProximityScore: number;
  } {
    if (input.polyline.length < 2) {
      return {
        poiPleasureScore: 0.5,
        parkProximityScore: 0.5,
        waterProximityScore: 0.5,
      };
    }

    const latitudes = input.polyline.map((point) => point.latitude);
    const longitudes = input.polyline.map((point) => point.longitude);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);
    const latSpread = maxLat - minLat;
    const lngSpread = maxLng - minLng;

    const boundsCenter: Coordinates = {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
    };
    const boundingDiagonalMeters = this.getDistanceMeters(
      { latitude: minLat, longitude: minLng },
      { latitude: maxLat, longitude: maxLng },
    );
    const routeLengthMeters = this.getPolylineLengthMeters(input.polyline);
    const compactnessRatio =
      boundingDiagonalMeters > 0 ? routeLengthMeters / boundingDiagonalMeters : 1;

    const spreadScore = this.normalize((latSpread + lngSpread) * 55, 0.25, 0.95);
    const compactnessScore = this.normalize(compactnessRatio / 9, 0.2, 0.95);
    const edgeBias = this.computeEdgeBias(input.polyline, boundsCenter);
    const edgeBiasScore = this.normalize(edgeBias, 0.15, 0.9);

    const parkProximityScore = this.clamp01(
      spreadScore * 0.45 + compactnessScore * 0.35 + edgeBiasScore * 0.2,
    );
    const waterProximityScore = this.clamp01(
      spreadScore * 0.3 + compactnessScore * 0.25 + edgeBiasScore * 0.45,
    );
    const poiPleasureScore = this.clamp01(
      parkProximityScore * 0.6 + waterProximityScore * 0.4,
    );

    return {
      poiPleasureScore,
      parkProximityScore,
      waterProximityScore,
    };
  }

  private computeEdgeBias(polyline: Coordinates[], center: Coordinates): number {
    if (polyline.length === 0) {
      return 0;
    }

    let totalDistance = 0;
    for (const point of polyline) {
      totalDistance += this.getDistanceMeters(point, center);
    }

    const averageDistance = totalDistance / polyline.length;
    return this.normalize(averageDistance / 1000, 0, 1);
  }

  private getPolylineLengthMeters(polyline: Coordinates[]): number {
    if (polyline.length < 2) {
      return 0;
    }

    let total = 0;
    for (let index = 1; index < polyline.length; index += 1) {
      total += this.getDistanceMeters(polyline[index - 1], polyline[index]);
    }
    return total;
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

  private normalize(value: number, min: number, max: number): number {
    if (max <= min) {
      return 0;
    }
    return this.clamp01((value - min) / (max - min));
  }

  private clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}
