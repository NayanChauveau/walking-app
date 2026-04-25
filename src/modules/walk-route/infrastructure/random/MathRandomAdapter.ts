import type { RandomPort } from "../../domain/ports/RandomPort";

export class MathRandomAdapter implements RandomPort {
  next(): number {
    return Math.random();
  }
}
