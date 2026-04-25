import { CompleteWalkUseCase } from "../application/use-cases/CompleteWalkUseCase";
import { GetWalkInsightsUseCase } from "../application/use-cases/GetWalkInsightsUseCase";
import { FileSystemWalkHistoryRepository } from "./storage/FileSystemWalkHistoryRepository";

export function createWalkHistoryModule() {
  const walkHistoryRepository = new FileSystemWalkHistoryRepository();

  const completeWalkUseCase = new CompleteWalkUseCase(walkHistoryRepository);
  const getWalkInsightsUseCase = new GetWalkInsightsUseCase(walkHistoryRepository);

  return {
    completeWalkUseCase,
    getWalkInsightsUseCase,
  };
}
