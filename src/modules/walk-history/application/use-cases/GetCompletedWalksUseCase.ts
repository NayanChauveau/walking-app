import type { CompletedWalk } from "../../domain/entities/CompletedWalk";
import type { WalkHistoryRepository } from "../ports/WalkHistoryRepository";

export class GetCompletedWalksUseCase {
  constructor(private readonly walkHistoryRepository: WalkHistoryRepository) {}

  async execute(): Promise<CompletedWalk[]> {
    return this.walkHistoryRepository.list();
  }
}
