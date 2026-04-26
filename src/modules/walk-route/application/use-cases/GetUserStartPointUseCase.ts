import type { Coordinates } from "../../domain/value-objects/Coordinates";
import type { UserStartPointPort } from "../ports/UserStartPointPort";

export class GetUserStartPointUseCase {
  constructor(private readonly userStartPoint: UserStartPointPort) {}

  async execute(): Promise<Coordinates> {
    return this.userStartPoint.getUserStartPoint();
  }
}

