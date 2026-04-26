import type { UserHealthProfileRepositoryPort } from "../ports/UserHealthProfileRepositoryPort";
import type { UserHealthProfile } from "../../domain/entities/UserHealthProfile";

export class GetUserHealthProfileUseCase {
  constructor(private readonly repository: UserHealthProfileRepositoryPort) {}

  async execute(): Promise<UserHealthProfile> {
    return this.repository.get();
  }
}
