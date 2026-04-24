import type { RandomPort } from "../../application/ports/RandomPort";

export class MathRandomAdapter implements RandomPort {
  next(): number {
    return Math.random();
  }
}
