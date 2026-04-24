import {
    GenerateWalkRouteUseCase,
    MathRandomAdapter,
    OpenRouteServiceAdapter,
} from "@/src/modules/walk-route";
import { Button } from "react-native";

export default function DebugGenerateEllipseButton() {
  async function handlePress() {
    const useCase = new GenerateWalkRouteUseCase(
      new MathRandomAdapter(),
      new OpenRouteServiceAdapter(
        process.env.EXPO_PUBLIC_OPENROUTESERVICE_API_KEY!,
      ),
    );

    const route = await useCase.execute({
      start: {
        latitude: 43.2965,
        longitude: 5.3698,
      },
      targetDurationMinutes: 60,
    });

    console.log("Generated route:", route);
    console.log("Route geometry:", route.geometry);
    console.log("Distance meters:", route.distanceMeters);
    console.log("Duration seconds:", route.durationSeconds);
  }

  return <Button title="Generate ellipse" onPress={handlePress} />;
}
