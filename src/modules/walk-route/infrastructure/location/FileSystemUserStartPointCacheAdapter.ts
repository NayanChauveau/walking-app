import * as FileSystem from "expo-file-system/legacy";

import type { UserStartPointCachePort } from "../../application/ports/UserStartPointCachePort";
import type { Coordinates } from "../../domain/value-objects/Coordinates";

const LOCATION_DIR = `${FileSystem.documentDirectory}location`;
const LOCATION_FILE_PATH = `${LOCATION_DIR}/last-known-user-start-point.json`;

async function ensureLocationFile(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(LOCATION_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(LOCATION_DIR, { intermediates: true });
  }

  const fileInfo = await FileSystem.getInfoAsync(LOCATION_FILE_PATH);
  if (!fileInfo.exists) {
    await FileSystem.writeAsStringAsync(LOCATION_FILE_PATH, "null");
  }
}

export class FileSystemUserStartPointCacheAdapter
  implements UserStartPointCachePort
{
  async getLastKnownUserStartPoint(): Promise<Coordinates | null> {
    await ensureLocationFile();
    const content = await FileSystem.readAsStringAsync(LOCATION_FILE_PATH);
    const parsed = JSON.parse(content) as Coordinates | null;

    if (!parsed) {
      return null;
    }

    return {
      latitude: parsed.latitude,
      longitude: parsed.longitude,
    };
  }

  async saveLastKnownUserStartPoint(startPoint: Coordinates): Promise<void> {
    await ensureLocationFile();
    await FileSystem.writeAsStringAsync(
      LOCATION_FILE_PATH,
      JSON.stringify(startPoint),
    );
  }
}

