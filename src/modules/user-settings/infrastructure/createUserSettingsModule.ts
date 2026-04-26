import { GetUserHealthProfileUseCase } from "../application/use-cases/GetUserHealthProfileUseCase";
import { SaveUserHealthProfileUseCase } from "../application/use-cases/SaveUserHealthProfileUseCase";
import { FileSystemUserHealthProfileRepository } from "./storage/FileSystemUserHealthProfileRepository";

export function createUserSettingsModule() {
  const repository = new FileSystemUserHealthProfileRepository();

  return {
    getUserHealthProfileUseCase: new GetUserHealthProfileUseCase(repository),
    saveUserHealthProfileUseCase: new SaveUserHealthProfileUseCase(repository),
  };
}
