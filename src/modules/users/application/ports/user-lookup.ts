import type { UserSummary } from "#/modules/users/domain/user.js";

export type UserLookup = {
  findUserSummaryById(id: string): Promise<UserSummary | undefined>;
};
