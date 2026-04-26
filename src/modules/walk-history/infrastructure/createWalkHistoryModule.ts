import { CompleteWalkUseCase } from "../application/use-cases/CompleteWalkUseCase";
import { ClearWalkHistoryUseCase } from "../application/use-cases/ClearWalkHistoryUseCase";
import { GetCompletedWalksUseCase } from "../application/use-cases/GetCompletedWalksUseCase";
import { GetRecentWalkCellsUseCase } from "../application/use-cases/GetRecentWalkCellsUseCase";
import { GetWalkInsightsUseCase } from "../application/use-cases/GetWalkInsightsUseCase";
import { H3ReactNativeTraversedCellsAdapter } from "./h3/H3ReactNativeTraversedCellsAdapter";
import { FileSystemWalkHistoryRepository } from "./storage/FileSystemWalkHistoryRepository";

export function createWalkHistoryModule() {
  const walkHistoryRepository = new FileSystemWalkHistoryRepository();
  const traversedCells = new H3ReactNativeTraversedCellsAdapter();

  const completeWalkUseCase = new CompleteWalkUseCase(
    walkHistoryRepository,
    traversedCells,
  );
  const clearWalkHistoryUseCase = new ClearWalkHistoryUseCase(walkHistoryRepository);
  const getCompletedWalksUseCase = new GetCompletedWalksUseCase(walkHistoryRepository);
  const getRecentWalkCellsUseCase = new GetRecentWalkCellsUseCase(
    walkHistoryRepository,
  );
  const getWalkInsightsUseCase = new GetWalkInsightsUseCase(walkHistoryRepository);

  return {
    completeWalkUseCase,
    clearWalkHistoryUseCase,
    getCompletedWalksUseCase,
    getRecentWalkCellsUseCase,
    getWalkInsightsUseCase,
  };
}
