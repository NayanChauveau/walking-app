import { GetLastKnownUserStartPointUseCase } from "../application/use-cases/GetLastKnownUserStartPointUseCase";
import { GenerateWaypointCandidatesUseCase } from "../application/use-cases/GenerateWaypointCandidatesUseCase";
import { PreScoreWaypointCandidatesUseCase } from "../application/use-cases/PreScoreWaypointCandidatesUseCase";
import { GenerateEllipseForWalkUseCase } from "../application/use-cases/GenerateEllipseForWalkUseCase";
import { GenerateWalkCandidateUseCase } from "../application/use-cases/GenerateWalkCandidateUseCase";
import { GetUserStartPointUseCase } from "../application/use-cases/GetUserStartPointUseCase";
import { SaveLastKnownUserStartPointUseCase } from "../application/use-cases/SaveLastKnownUserStartPointUseCase";
import type { RecentWalkCellsPort } from "../application/ports/RecentWalkCellsPort";
import { GenerateWalkRouteUseCase } from "../application/use-cases/GenerateWalkRouteUseCase";
import { DomainEllipseGenerationAdapter } from "./generation/DomainEllipseGenerationAdapter";
import { DomainWaypointGenerationAdapter } from "./generation/DomainWaypointGenerationAdapter";
import { H3PolylineCellsAdapter } from "./h3/H3PolylineCellsAdapter";
import { H3WaypointCandidateScoringAdapter } from "./h3/H3WaypointCandidateScoringAdapter";
import { ExpoUserStartPointAdapter } from "./location/ExpoUserStartPointAdapter";
import { FileSystemUserStartPointCacheAdapter } from "./location/FileSystemUserStartPointCacheAdapter";
import { MathRandomAdapter } from "./random/MathRandomAdapter";
import { MapboxDirectionsAdapter } from "./routing/MapboxDirectionsAdapter";

type Input = {
  mapboxAccessToken: string;
  recentWalkCells: RecentWalkCellsPort;
};

export function createWalkRouteModule({
  mapboxAccessToken,
  recentWalkCells,
}: Input) {
  const random = new MathRandomAdapter();
  const routing = new MapboxDirectionsAdapter(mapboxAccessToken);
  const ellipseGeneration = new DomainEllipseGenerationAdapter(random);
  const waypointGeneration = new DomainWaypointGenerationAdapter();
  const polylineCells = new H3PolylineCellsAdapter();
  const h3Scoring = new H3WaypointCandidateScoringAdapter();
  const userStartPoint = new ExpoUserStartPointAdapter();
  const userStartPointCache = new FileSystemUserStartPointCacheAdapter();

  const generateWalkRouteUseCase = new GenerateWalkRouteUseCase(
    routing,
    new GenerateWaypointCandidatesUseCase(ellipseGeneration, waypointGeneration),
    new PreScoreWaypointCandidatesUseCase(h3Scoring),
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
