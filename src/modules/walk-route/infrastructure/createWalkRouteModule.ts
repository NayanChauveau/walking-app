import { GenerateEllipseForWalkUseCase } from "../application/use-cases/GenerateEllipseForWalkUseCase";
import { GenerateWalkCandidateUseCase } from "../application/use-cases/GenerateWalkCandidateUseCase";
import type { RecentWalkCellsPort } from "../application/ports/RecentWalkCellsPort";
import { GenerateWalkRouteUseCase } from "../application/use-cases/GenerateWalkRouteUseCase";
import { DomainEllipseGenerationAdapter } from "./generation/DomainEllipseGenerationAdapter";
import { DomainWaypointGenerationAdapter } from "./generation/DomainWaypointGenerationAdapter";
import { H3PolylineCellsAdapter } from "./h3/H3PolylineCellsAdapter";
import { MathRandomAdapter } from "./random/MathRandomAdapter";
import { OpenRouteServiceAdapter } from "./routing/OpenRouteServiceAdapter";

type Input = {
  openRouteServiceApiKey: string;
  recentWalkCells: RecentWalkCellsPort;
};

export function createWalkRouteModule({
  openRouteServiceApiKey,
  recentWalkCells,
}: Input) {
  const random = new MathRandomAdapter();
  const routing = new OpenRouteServiceAdapter(openRouteServiceApiKey);
  const ellipseGeneration = new DomainEllipseGenerationAdapter(random);
  const waypointGeneration = new DomainWaypointGenerationAdapter();
  const polylineCells = new H3PolylineCellsAdapter();

  const generateWalkRouteUseCase = new GenerateWalkRouteUseCase(
    routing,
    ellipseGeneration,
    waypointGeneration,
    recentWalkCells,
    polylineCells,
  );
  const generateWalkCandidateUseCase = new GenerateWalkCandidateUseCase(
    ellipseGeneration,
    waypointGeneration,
  );
  const generateEllipseForWalkUseCase = new GenerateEllipseForWalkUseCase(
    ellipseGeneration,
  );

  return {
    generateEllipseForWalkUseCase,
    generateWalkCandidateUseCase,
    generateWalkRouteUseCase,
  };
}
