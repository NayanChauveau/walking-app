import { GenerateWalkRouteUseCase } from "../application/use-cases/GenerateWalkRouteUseCase";
import { EllipseGenerator } from "../domain/services/EllipseGenerator";
import { WaypointGenerator } from "../domain/services/WaypointGenerator";
import { MathRandomAdapter } from "./random/MathRandomAdapter";
import { OpenRouteServiceAdapter } from "./routing/OpenRouteServiceAdapter";

type Input = {
  openRouteServiceApiKey: string;
};

export function createWalkRouteModule({ openRouteServiceApiKey }: Input) {
  const random = new MathRandomAdapter();
  const routing = new OpenRouteServiceAdapter(openRouteServiceApiKey);

  const ellipseGenerator = new EllipseGenerator();
  const waypointGenerator = new WaypointGenerator();

  const generateWalkRouteUseCase = new GenerateWalkRouteUseCase(
    random,
    routing,
    ellipseGenerator,
    waypointGenerator,
  );

  return {
    generateWalkRouteUseCase,
  };
}
