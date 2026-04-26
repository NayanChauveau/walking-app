import type { Coordinates } from "../../domain/value-objects/Coordinates";
import type { WalkRoute } from "../../domain/entities/WalkRoute";

export type RouteSelectionMode = "novelty" | "poi";
export type PressedRouteId = "primary" | "secondary";

type ResolveSelectedRouteInput = {
  route: WalkRoute | null;
  mode: RouteSelectionMode;
};

type ResolveSecondaryRouteGeometryInput = {
  route: WalkRoute | null;
  mode: RouteSelectionMode;
  isGpsTracking: boolean;
};

type ResolveModeFromPressedRouteInput = {
  route: WalkRoute | null;
  currentMode: RouteSelectionMode;
  pressedRouteId: PressedRouteId;
  isGpsTracking: boolean;
};

export class ResolveRouteSelectionUseCase {
  resolveSelectedRoute(input: ResolveSelectedRouteInput): WalkRoute | null {
    if (!input.route) {
      return null;
    }

    const selectedAlternative =
      input.mode === "poi"
        ? input.route.alternatives?.poi
        : input.route.alternatives?.novelty;

    if (!selectedAlternative) {
      return input.route;
    }

    return {
      ...input.route,
      geometry: selectedAlternative.geometry,
      distanceMeters: selectedAlternative.distanceMeters,
      durationSeconds: selectedAlternative.durationSeconds,
      scoring: selectedAlternative.scoring,
    };
  }

  resolveSecondaryRouteGeometry(
    input: ResolveSecondaryRouteGeometryInput,
  ): Coordinates[] {
    if (input.isGpsTracking || !input.route) {
      return [];
    }

    const noveltyGeometry =
      input.route.alternatives?.novelty?.geometry ?? input.route.geometry;
    const poiGeometry = input.route.alternatives?.poi?.geometry ?? [];

    return input.mode === "novelty" ? poiGeometry : noveltyGeometry;
  }

  resolveModeFromPressedRoute(
    input: ResolveModeFromPressedRouteInput,
  ): RouteSelectionMode {
    if (input.isGpsTracking || !input.route?.alternatives?.poi) {
      return input.currentMode;
    }

    if (input.pressedRouteId === "primary") {
      return input.currentMode;
    }

    return input.currentMode === "novelty" ? "poi" : "novelty";
  }
}
