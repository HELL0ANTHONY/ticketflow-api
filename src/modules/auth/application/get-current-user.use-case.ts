import type { UserAuthLookup } from "#/modules/users/application/ports/user-auth-lookup.js";
import type { PublicUser } from "#/modules/users/domain/user.js";

import { toPublicUser } from "#/modules/users/domain/user.js";
import { UnauthorizedError } from "#/shared/errors/application-error.js";

export class GetCurrentUserUseCase {
  constructor(private readonly userAuthLookup: UserAuthLookup) {}

  async execute(userId: string): Promise<PublicUser> {
    const user = await this.userAuthLookup.findUserById(userId);

    if (user === undefined) {
      throw new UnauthorizedError("Authenticated user no longer exists");
    }

    return toPublicUser(user);
  }
}
