import * as FileSystem from "expo-file-system/legacy";

import type { UserHealthProfileRepositoryPort } from "../../application/ports/UserHealthProfileRepositoryPort";
import {
  DEFAULT_USER_HEALTH_PROFILE,
  type UserHealthProfile,
} from "../../domain/entities/UserHealthProfile";

const SETTINGS_DIR = `${FileSystem.documentDirectory}settings`;
const USER_HEALTH_PROFILE_FILE_PATH = `${SETTINGS_DIR}/user-health-profile.json`;

async function ensureSettingsFile(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(SETTINGS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(SETTINGS_DIR, { intermediates: true });
  }

  const fileInfo = await FileSystem.getInfoAsync(USER_HEALTH_PROFILE_FILE_PATH);
  if (!fileInfo.exists) {
    await FileSystem.writeAsStringAsync(
      USER_HEALTH_PROFILE_FILE_PATH,
      JSON.stringify(DEFAULT_USER_HEALTH_PROFILE),
    );
  }
}

export class FileSystemUserHealthProfileRepository
  implements UserHealthProfileRepositoryPort
{
  async get(): Promise<UserHealthProfile> {
    await ensureSettingsFile();
    const content = await FileSystem.readAsStringAsync(USER_HEALTH_PROFILE_FILE_PATH);
    const parsed = JSON.parse(content) as Partial<UserHealthProfile> | null;

    const weightKg =
      typeof parsed?.weightKg === "number"
        ? parsed.weightKg
        : DEFAULT_USER_HEALTH_PROFILE.weightKg;
    const heightCm =
      typeof parsed?.heightCm === "number"
        ? parsed.heightCm
        : DEFAULT_USER_HEALTH_PROFILE.heightCm;

    return {
      weightKg,
      heightCm,
    };
  }

  async save(profile: UserHealthProfile): Promise<void> {
    await ensureSettingsFile();
    await FileSystem.writeAsStringAsync(
      USER_HEALTH_PROFILE_FILE_PATH,
      JSON.stringify(profile, null, 2),
    );
  }
}
