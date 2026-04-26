import { AppleMaps, GoogleMaps } from "expo-maps";
import { Platform, Text } from "react-native";

import type { Coordinates } from "@/src/modules/walk-route";

type MapProps = {
  userCoordinates: Coordinates | null;
  routeGeometry?: Coordinates[];
  secondaryRouteGeometry?: Coordinates[];
  traversedUntilIndex?: number;
  cameraOverride?: {
    coordinates: Coordinates;
    zoom: number;
  } | null;
  onCameraMove?: (camera: { coordinates: Coordinates; zoom: number }) => void;
  onRoutePress?: (routeId: "primary" | "secondary") => void;
};

function getCameraPositionForGeometry(geometry: Coordinates[]) {
  const latitudes = geometry.map((p) => p.latitude);
  const longitudes = geometry.map((p) => p.longitude);

  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLng + maxLng) / 2;

  const latDelta = maxLat - minLat;
  const lngDelta = maxLng - minLng;
  const maxDelta = Math.max(latDelta, lngDelta) * 1.25;

  const zoom = Math.max(
    11,
    Math.min(17, Math.floor(Math.log2(360 / maxDelta))),
  );

  return {
    coordinates: { latitude, longitude },
    zoom,
  };
}

export default function Map({
  userCoordinates,
  routeGeometry = [],
  secondaryRouteGeometry = [],
  traversedUntilIndex = 0,
  cameraOverride = null,
  onCameraMove,
  onRoutePress,
}: MapProps) {
  const mapStyle = {
    height: 500,
    width: "100%",
  } as const;

  if (!userCoordinates && routeGeometry.length === 0) {
    return <Text>Position utilisateur en attente...</Text>;
  }

  const cameraPosition =
    cameraOverride ??
    (routeGeometry.length > 0
      ? getCameraPositionForGeometry(routeGeometry)
      : {
          coordinates: userCoordinates!,
          zoom: 15,
        });

  const startCoordinates = routeGeometry.length > 0 ? routeGeometry[0] : null;
  const endCoordinates =
    routeGeometry.length > 1 ? routeGeometry[routeGeometry.length - 1] : null;

  const markers = [
    ...(startCoordinates
      ? [
          {
            id: "route-start",
            coordinates: startCoordinates,
            title: "Depart",
            tintColor: "#E53935",
          },
        ]
      : []),
    ...(endCoordinates
      ? [
          {
            id: "route-end",
            coordinates: endCoordinates,
            title: "Arrivee",
            tintColor: "#E53935",
          },
        ]
      : []),
  ];

  const safeTraversedIndex = Math.max(
    0,
    Math.min(traversedUntilIndex, Math.max(routeGeometry.length - 1, 0)),
  );
  const traversedCoordinates =
    routeGeometry.length > 1
      ? routeGeometry.slice(0, safeTraversedIndex + 1)
      : [];
  const remainingCoordinates =
    routeGeometry.length > 1
      ? routeGeometry.slice(Math.max(safeTraversedIndex, 0))
      : routeGeometry;

  const polylines = [
    ...(secondaryRouteGeometry.length > 1
      ? [
          {
            id: "secondary-route",
            coordinates: secondaryRouteGeometry,
            color: "#8A8F98",
            width: 8,
          },
        ]
      : []),
    ...(traversedCoordinates.length > 1
      ? [
          {
            id: "traversed-route",
            coordinates: traversedCoordinates,
            color: "#8A8F98",
            width: 10,
          },
        ]
      : []),
    ...(remainingCoordinates.length > 1
      ? [
          {
            id: "remaining-route",
            coordinates: remainingCoordinates,
            color: "#2F80ED",
            width: 10,
          },
        ]
      : []),
  ];

  if (Platform.OS === "ios") {
    return (
      <AppleMaps.View
        style={mapStyle}
        cameraPosition={cameraPosition}
        markers={markers}
        polylines={polylines}
        properties={{ isMyLocationEnabled: true }}
        uiSettings={{ myLocationButtonEnabled: true }}
        onCameraMove={
          onCameraMove
            ? (event) => {
                if (
                  event.coordinates.latitude === undefined ||
                  event.coordinates.longitude === undefined
                ) {
                  return;
                }
                onCameraMove({
                  coordinates: {
                    latitude: event.coordinates.latitude,
                    longitude: event.coordinates.longitude,
                  },
                  zoom: event.zoom,
                });
              }
            : undefined
        }
        onPolylineClick={
          onRoutePress
            ? (event) => {
                if (event.id === "secondary-route") {
                  onRoutePress("secondary");
                  return;
                }
                if (event.id === "traversed-route" || event.id === "remaining-route") {
                  onRoutePress("primary");
                }
              }
            : undefined
        }
      />
    );
  }

  if (Platform.OS === "android") {
    return (
      <GoogleMaps.View
        style={mapStyle}
        cameraPosition={cameraPosition}
        markers={markers}
        polylines={polylines}
        properties={{ isMyLocationEnabled: true }}
        uiSettings={{ myLocationButtonEnabled: true }}
        onCameraMove={
          onCameraMove
            ? (event) => {
                if (
                  event.coordinates.latitude === undefined ||
                  event.coordinates.longitude === undefined
                ) {
                  return;
                }
                onCameraMove({
                  coordinates: {
                    latitude: event.coordinates.latitude,
                    longitude: event.coordinates.longitude,
                  },
                  zoom: event.zoom,
                });
              }
            : undefined
        }
        onPolylineClick={
          onRoutePress
            ? (event) => {
                if (event.id === "secondary-route") {
                  onRoutePress("secondary");
                  return;
                }
                if (event.id === "traversed-route" || event.id === "remaining-route") {
                  onRoutePress("primary");
                }
              }
            : undefined
        }
      />
    );
  }

  return <Text>Maps are only available on Android and iOS</Text>;
}
