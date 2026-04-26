import { createWalkHistoryModule } from "../modules/walk-history";
import {
  createWalkRouteModule,
  type RecentWalkCellsPort,
} from "../modules/walk-route";
import { createUserSettingsModule } from "../modules/user-settings";

type AppModules = {
  walkHistory: ReturnType<typeof createWalkHistoryModule>;
  walkRoute: ReturnType<typeof createWalkRouteModule>;
  userSettings: ReturnType<typeof createUserSettingsModule>;
};

let cachedModules: AppModules | null = null;

export function createAppModules(): AppModules {
  if (cachedModules) {
    return cachedModules;
  }

  const walkHistory = createWalkHistoryModule();
  const recentWalkCellsPort: RecentWalkCellsPort = {
    async listRecentTraversedCells(limit: number) {
      return walkHistory.getRecentWalkCellsUseCase.execute({ limit });
    },
  };

  const walkRoute = createWalkRouteModule({
    mapboxAccessToken: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN!,
    recentWalkCells: recentWalkCellsPort,
  });
  const userSettings = createUserSettingsModule();

  cachedModules = {
    walkHistory,
    walkRoute,
    userSettings,
  };

  return cachedModules;
}
