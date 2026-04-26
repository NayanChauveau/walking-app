import type { WalkHistoryRepository } from "../ports/WalkHistoryRepository";

export class ClearWalkHistoryUseCase {
  constructor(private readonly walkHistoryRepository: WalkHistoryRepository) {}

  async execute(): Promise<void> {
    await this.walkHistoryRepository.clear();
  }
}
