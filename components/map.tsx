import { AppleMaps, GoogleMaps } from "expo-maps";
import { Platform, Text } from "react-native";

import type { Coordinates } from "@/src/modules/walk-route";

type MapProps = {
  userCoordinates: Coordinates | null;
  routeGeometry?: Coordinates[];
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

export default function Map({ userCoordinates, routeGeometry = [] }: MapProps) {
  const mapStyle = {
    height: 500,
    width: "100%",
  } as const;

  if (!userCoordinates && routeGeometry.length === 0) {
    return <Text>Position utilisateur en attente...</Text>;
  }

  const cameraPosition =
    routeGeometry.length > 0
      ? getCameraPositionForGeometry(routeGeometry)
      : {
          coordinates: userCoordinates!,
          zoom: 15,
        };

  const markers = userCoordinates
    ? [
        {
          id: "user-location",
          coordinates: userCoordinates,
          title: "Vous êtes ici",
        },
      ]
    : [];

  const polylines =
    routeGeometry.length > 0
      ? [
          {
            id: "generated-route",
            coordinates: routeGeometry,
            color: "#FF0000",
            width: 8,
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
      />
    );
  }

  return <Text>Maps are only available on Android and iOS</Text>;
}
