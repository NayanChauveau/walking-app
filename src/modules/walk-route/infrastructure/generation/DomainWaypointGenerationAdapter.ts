import type { WaypointGenerationPort } from "../../application/ports/WaypointGenerationPort";
import type { Ellipse } from "../../domain/entities/Ellipse";
import { WaypointGenerator } from "../../domain/services/WaypointGenerator";

export class DomainWaypointGenerationAdapter implements WaypointGenerationPort {
  constructor(private readonly waypointGenerator = new WaypointGenerator()) {}

  generateOnEllipse(input: { ellipse: Ellipse }) {
    return this.waypointGenerator.generateOnEllipse(input);
  }
}
