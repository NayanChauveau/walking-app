import { AppleMaps, GoogleMaps } from "expo-maps";
import { Platform, Text } from "react-native";

import type { Coordinates } from "@/src/modules/walk-route";

type MapProps = {
  userCoordinates: Coordinates | null;
  routeGeometry?: Coordinates[];
  cameraOverride?: {
    coordinates: Coordinates;
    zoom: number;
  } | null;
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
  cameraOverride = null,
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

  const polylines =
    routeGeometry.length > 0
      ? [
          {
            id: "generated-route",
            coordinates: routeGeometry,
            color: "#2F80ED",
            width: 10,
          },
        ]
      : [];

  if (Platform.OS === "ios") {
    return (
      <AppleMaps.View
        style={mapStyle}
        cameraPosition={cameraPosition}
        markers={markers}
        polylines={polylines}
        properties={{ isMyLocationEnabled: true }}
        uiSettings={{ myLocationButtonEnabled: true }}
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
      />
    );
  }

  return <Text>Maps are only available on Android and iOS</Text>;
}
