import type { UserHealthProfileRepositoryPort } from "../ports/UserHealthProfileRepositoryPort";

type Input = {
  weightKg: number;
  heightCm: number;
};

export class SaveUserHealthProfileUseCase {
  constructor(private readonly repository: UserHealthProfileRepositoryPort) {}

  async execute(input: Input): Promise<void> {
    if (!Number.isFinite(input.weightKg) || input.weightKg < 30 || input.weightKg > 250) {
      throw new Error("Le poids doit etre compris entre 30 et 250 kg.");
    }
    if (!Number.isFinite(input.heightCm) || input.heightCm < 120 || input.heightCm > 230) {
      throw new Error("La taille doit etre comprise entre 120 et 230 cm.");
    }

    await this.repository.save({
      weightKg: Number(input.weightKg.toFixed(1)),
      heightCm: Math.round(input.heightCm),
    });
  }
}
