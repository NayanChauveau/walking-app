import type { UserHealthProfile } from "../../domain/entities/UserHealthProfile";

export type UserHealthProfileRepositoryPort = {
  get(): Promise<UserHealthProfile>;
  save(profile: UserHealthProfile): Promise<void>;
};
