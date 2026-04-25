import type { CompletedWalk } from "../../domain/entities/CompletedWalk";

export interface WalkHistoryRepository {
  save(completedWalk: CompletedWalk): Promise<void>;
  list(): Promise<CompletedWalk[]>;
}
