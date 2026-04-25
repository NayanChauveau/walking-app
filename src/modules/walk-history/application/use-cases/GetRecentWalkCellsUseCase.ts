import type { WalkHistoryRepository } from "../ports/WalkHistoryRepository";

type Input = {
  limit: number;
};

export class GetRecentWalkCellsUseCase {
  constructor(private readonly walkHistoryRepository: WalkHistoryRepository) {}

  async execute(input: Input): Promise<string[][]> {
    const completedWalks = await this.walkHistoryRepository.list();

    return completedWalks
      .slice(0, input.limit)
      .map((walk) => walk.traversedH3Cells ?? []);
  }
}
