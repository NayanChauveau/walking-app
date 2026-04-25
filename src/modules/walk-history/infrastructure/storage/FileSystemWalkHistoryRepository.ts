import * as FileSystem from "expo-file-system/legacy";

import type { WalkHistoryRepository } from "../../application/ports/WalkHistoryRepository";
import type { CompletedWalk } from "../../domain/entities/CompletedWalk";

const HISTORY_DIR = `${FileSystem.documentDirectory}walk-history`;
const HISTORY_FILE_PATH = `${HISTORY_DIR}/completed-walks.json`;

async function ensureHistoryFile(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(HISTORY_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(HISTORY_DIR, { intermediates: true });
  }

  const fileInfo = await FileSystem.getInfoAsync(HISTORY_FILE_PATH);
  if (!fileInfo.exists) {
    await FileSystem.writeAsStringAsync(HISTORY_FILE_PATH, "[]");
  }
}

export class FileSystemWalkHistoryRepository implements WalkHistoryRepository {
  async save(completedWalk: CompletedWalk): Promise<void> {
    const existingWalks = await this.list();
    const nextWalks = [completedWalk, ...existingWalks];

    await FileSystem.writeAsStringAsync(
      HISTORY_FILE_PATH,
      JSON.stringify(nextWalks, null, 2),
    );
  }

  async list(): Promise<CompletedWalk[]> {
    await ensureHistoryFile();

    const content = await FileSystem.readAsStringAsync(HISTORY_FILE_PATH);
    const parsed = JSON.parse(content) as Array<
      Omit<CompletedWalk, "traversedH3Cells"> & {
        traversedH3Cells?: string[];
      }
    >;

    const normalized = parsed.map((walk) => ({
      ...walk,
      traversedH3Cells: walk.traversedH3Cells ?? [],
    }));

    return normalized.sort((a, b) => b.completedAtIso.localeCompare(a.completedAtIso));
  }
}
