export interface RecentWalkCellsPort {
  listRecentTraversedCells(limit: number): Promise<string[][]>;
}
