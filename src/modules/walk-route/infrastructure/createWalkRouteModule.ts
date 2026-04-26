import { GetLastKnownUserStartPointUseCase } from "../application/use-cases/GetLastKnownUserStartPointUseCase";
import { GenerateEllipseForWalkUseCase } from "../application/use-cases/GenerateEllipseForWalkUseCase";
import { GenerateWalkCandidateUseCase } from "../application/use-cases/GenerateWalkCandidateUseCase";
import { GetUserStartPointUseCase } from "../application/use-cases/GetUserStartPointUseCase";
import { SaveLastKnownUserStartPointUseCase } from "../application/use-cases/SaveLastKnownUserStartPointUseCase";
import type { RecentWalkCellsPort } from "../application/ports/RecentWalkCellsPort";
import { GenerateWalkRouteUseCase } from "../application/use-cases/GenerateWalkRouteUseCase";
import { DomainEllipseGenerationAdapter } from "./generation/DomainEllipseGenerationAdapter";
import { DomainWaypointGenerationAdapter } from "./generation/DomainWaypointGenerationAdapter";
import { H3PolylineCellsAdapter } from "./h3/H3PolylineCellsAdapter";
import { ExpoUserStartPointAdapter } from "./location/ExpoUserStartPointAdapter";
import { FileSystemUserStartPointCacheAdapter } from "./location/FileSystemUserStartPointCacheAdapter";
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
  const userStartPoint = new ExpoUserStartPointAdapter();
  const userStartPointCache = new FileSystemUserStartPointCacheAdapter();

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
  const getUserStartPointUseCase = new GetUserStartPointUseCase(userStartPoint);
  const getLastKnownUserStartPointUseCase = new GetLastKnownUserStartPointUseCase(
    userStartPointCache,
  );
  const saveLastKnownUserStartPointUseCase =
    new SaveLastKnownUserStartPointUseCase(userStartPointCache);

  return {
    generateEllipseForWalkUseCase,
    generateWalkCandidateUseCase,
    generateWalkRouteUseCase,
    getLastKnownUserStartPointUseCase,
    getUserStartPointUseCase,
    saveLastKnownUserStartPointUseCase,
  };
}
