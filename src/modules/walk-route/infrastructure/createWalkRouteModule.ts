import { GenerateEllipseForWalkUseCase } from "../application/use-cases/GenerateEllipseForWalkUseCase";
import { GenerateWalkCandidateUseCase } from "../application/use-cases/GenerateWalkCandidateUseCase";
import { GenerateWalkRouteUseCase } from "../application/use-cases/GenerateWalkRouteUseCase";
import { DomainEllipseGenerationAdapter } from "./generation/DomainEllipseGenerationAdapter";
import { DomainWaypointGenerationAdapter } from "./generation/DomainWaypointGenerationAdapter";
import { MathRandomAdapter } from "./random/MathRandomAdapter";
import { OpenRouteServiceAdapter } from "./routing/OpenRouteServiceAdapter";

type Input = {
  openRouteServiceApiKey: string;
};

export function createWalkRouteModule({ openRouteServiceApiKey }: Input) {
  const random = new MathRandomAdapter();
  const routing = new OpenRouteServiceAdapter(openRouteServiceApiKey);
  const ellipseGeneration = new DomainEllipseGenerationAdapter(random);
  const waypointGeneration = new DomainWaypointGenerationAdapter();

  const generateWalkRouteUseCase = new GenerateWalkRouteUseCase(
    routing,
    ellipseGeneration,
    waypointGeneration,
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
