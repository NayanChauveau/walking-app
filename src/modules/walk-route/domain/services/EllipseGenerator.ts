import type { RandomPort } from "../../application/ports/RandomPort";
import type { Ellipse } from "../entities/Ellipse";
import type { Coordinates } from "../value-objects/Coordinates";

type GenerateEllipseInput = {
  start: Coordinates;
  targetDistanceMeters: number;
  random: RandomPort;
};

export class EllipseGenerator {
  generate({
    start,
    targetDistanceMeters,
    random,
  }: GenerateEllipseInput): Ellipse {
    const semiMajorMeters = targetDistanceMeters / 4;
    const semiMinorMeters = semiMajorMeters * (0.45 + random.next() * 0.35);

    const rotationRadians = random.next() * Math.PI * 2;

    const center = this.computeCenterFromStart({
      start,
      semiMajorMeters,
      rotationRadians,
    });

    return {
      start,
      center,
      semiMajorMeters,
      semiMinorMeters,
      rotationRadians,
    };
  }

  private computeCenterFromStart({
    start,
    semiMajorMeters,
    rotationRadians,
  }: {
    start: Coordinates;
    semiMajorMeters: number;
    rotationRadians: number;
  }): Coordinates {
    const earthRadiusMeters = 6_371_000;

    const distance = semiMajorMeters;
    const bearing = rotationRadians;

    const deltaLatitude = (distance * Math.cos(bearing)) / earthRadiusMeters;

    const deltaLongitude =
      (distance * Math.sin(bearing)) /
      (earthRadiusMeters * Math.cos((start.latitude * Math.PI) / 180));

    return {
      latitude: start.latitude + (deltaLatitude * 180) / Math.PI,
      longitude: start.longitude + (deltaLongitude * 180) / Math.PI,
    };
  }
}
