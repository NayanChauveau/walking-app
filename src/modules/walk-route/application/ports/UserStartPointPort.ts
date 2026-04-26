import type { Coordinates } from "../../domain/value-objects/Coordinates";

export type UserStartPointPort = {
  getUserStartPoint(): Promise<Coordinates>;
};

