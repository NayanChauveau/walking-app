import { Coordinates } from "../value-objects/Coordinates";

export type Ellipse = {
  start: Coordinates;
  center: Coordinates;
  semiMajorMeters: number;
  semiMinorMeters: number;
  rotationRadians: number;
};
