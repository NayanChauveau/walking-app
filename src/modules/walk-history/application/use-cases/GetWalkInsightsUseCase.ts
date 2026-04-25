import type { WalkInsights } from "../../domain/entities/WalkInsights";
import { calculateWalkInsights } from "../../domain/services/WalkInsightsCalculator";
import type { WalkHistoryRepository } from "../ports/WalkHistoryRepository";

export class GetWalkInsightsUseCase {
  constructor(private readonly walkHistoryRepository: WalkHistoryRepository) {}

  async execute(): Promise<WalkInsights> {
    const completedWalks = await this.walkHistoryRepository.list();

    return calculateWalkInsights(completedWalks);
  }
}
