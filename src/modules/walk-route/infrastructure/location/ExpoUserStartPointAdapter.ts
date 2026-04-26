import * as Location from "expo-location";

import type { UserStartPointPort } from "../../application/ports/UserStartPointPort";
import type { Coordinates } from "../../domain/value-objects/Coordinates";

export class ExpoUserStartPointAdapter implements UserStartPointPort {
  async getUserStartPoint(): Promise<Coordinates> {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      throw new Error("Location permission denied");
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  }
}

