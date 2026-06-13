import { faker } from "@faker-js/faker";
import bcrypt from "bcrypt";
import { describe, expect, it } from "vitest";

import type {
  AuthRepository,
  CreateRefreshTokenInput,
} from "#/modules/auth/application/ports/auth-repository.js";
import type { RefreshTokenRecord } from "#/modules/auth/domain/auth.js";
import type { UserAuthLookup } from "#/modules/users/application/ports/user-auth-lookup.js";
import type { UserRepository } from "#/modules/users/application/ports/user-repository.js";
import type {
  ChangeUserRoleInput,
  CreateUserData,
  ListUsersFilters,
  User,
} from "#/modules/users/domain/user.js";

import {
  UnauthorizedError,
  ValidationError,
} from "#/shared/errors/application-error.js";
import { hashRefreshToken } from "#/shared/security/refresh-token.js";

import { GetCurrentUserUseCase } from "./get-current-user.use-case.js";
import { LoginUseCase } from "./login.use-case.js";
import { LogoutAllUseCase } from "./logout-all.use-case.js";
import { LogoutUseCase } from "./logout.use-case.js";
import { RefreshSessionUseCase } from "./refresh-session.use-case.js";
import { RegisterUseCase } from "./register.use-case.js";

class InMemoryAuthRepository implements AuthRepository {
  readonly createdRefreshTokens: CreateRefreshTokenInput[] = [];
  readonly revokedRefreshTokenIds: string[] = [];
  readonly revokedUserIds: string[] = [];

  constructor(private readonly refreshTokens: RefreshTokenRecord[] = []) {}

  createRefreshToken(input: CreateRefreshTokenInput): Promise<void> {
    this.createdRefreshTokens.push(input);
    this.refreshTokens.push({
      expiresAt: input.expiresAt,
      id: faker.string.uuid(),
      revokedAt: null,
      tokenHash: input.tokenHash,
      userId: input.userId,
    });

    return Promise.resolve();
  }

  findActiveRefreshTokenByHash(
    tokenHash: string,
  ): Promise<RefreshTokenRecord | undefined> {
    return Promise.resolve(
      this.refreshTokens.find(
        (token) => token.tokenHash === tokenHash && token.revokedAt === null,
      ),
    );
  }

  findRefreshTokenByHash(
    tokenHash: string,
  ): Promise<RefreshTokenRecord | undefined> {
    return Promise.resolve(
      this.refreshTokens.find((token) => token.tokenHash === tokenHash),
    );
  }

  revokeAllRefreshTokensForUser(userId: string): Promise<void> {
    this.revokedUserIds.push(userId);
    this.refreshTokens.forEach((token) => {
      if (token.userId === userId) {
        token.revokedAt = new Date();
      }
    });

    return Promise.resolve();
  }

  revokeRefreshToken(id: string): Promise<void> {
    this.revokedRefreshTokenIds.push(id);

    const token = this.refreshTokens.find((candidate) => candidate.id === id);
    if (token !== undefined) {
      token.revokedAt = new Date();
    }

    return Promise.resolve();
  }
}

class InMemoryUserRepository implements UserRepository {
  readonly createdUsers: CreateUserData[] = [];

  constructor(private readonly users: User[] = []) {}

  changeRole(input: ChangeUserRoleInput): Promise<User> {
    const user = this.users.find((candidate) => candidate.id === input.userId);

    if (user === undefined) {
      throw new Error("User not found");
    }

    user.role = input.role;

    return Promise.resolve(user);
  }

  create(input: CreateUserData): Promise<User> {
    this.createdUsers.push(input);

    const user = makeUser({
      email: input.email,
      name: input.name,
      passwordHash: input.passwordHash,
      role: input.role ?? "customer",
    });
    this.users.push(user);

    return Promise.resolve(user);
  }

  findById(input: { id: string }): Promise<User | undefined> {
    return Promise.resolve(this.users.find((user) => user.id === input.id));
  }

  list(filters: ListUsersFilters): Promise<User[]> {
    if (filters.role === undefined) {
      return Promise.resolve([...this.users]);
    }

    return Promise.resolve(
      this.users.filter((user) => user.role === filters.role),
    );
  }
}

class InMemoryUserAuthLookup implements UserAuthLookup {
  constructor(private readonly users: User[]) {}

  findUserByEmail(email: string): Promise<User | undefined> {
    return Promise.resolve(this.users.find((user) => user.email === email));
  }

  findUserById(id: string): Promise<User | undefined> {
    return Promise.resolve(this.users.find((user) => user.id === id));
  }
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    createdAt: faker.date.recent(),
    email: faker.internet.email(),
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    passwordHash: faker.string.alphanumeric(60),
    role: "customer",
    ...overrides,
  };
}

function makeRefreshTokenRecord(
  refreshToken: string,
  overrides: Partial<RefreshTokenRecord> = {},
): RefreshTokenRecord {
  return {
    expiresAt: faker.date.future(),
    id: faker.string.uuid(),
    revokedAt: null,
    tokenHash: hashRefreshToken(refreshToken),
    userId: faker.string.uuid(),
    ...overrides,
  };
}

describe("auth use cases", () => {
  it("registers users with a hashed password and creates a session", async () => {
    const authRepository = new InMemoryAuthRepository();
    const userRepository = new InMemoryUserRepository();
    const useCase = new RegisterUseCase(authRepository, userRepository);
    const password = "Password123";

    const result = await useCase.execute({
      email: "new-user@example.com",
      name: "New User",
      password,
    });

    expect(userRepository.createdUsers).toHaveLength(1);
    expect(userRepository.createdUsers[0]).toMatchObject({
      email: "new-user@example.com",
      name: "New User",
    });
    expect(userRepository.createdUsers[0]?.passwordHash).not.toBe(password);
    await expect(
      bcrypt.compare(password, userRepository.createdUsers[0]?.passwordHash ?? ""),
    ).resolves.toBe(true);
    expect(authRepository.createdRefreshTokens).toHaveLength(1);
    expect(result).toMatchObject({
      user: {
        email: "new-user@example.com",
        name: "New User",
        role: "customer",
      },
    });
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
  });

  it("rejects weak registration passwords", async () => {
    const authRepository = new InMemoryAuthRepository();
    const userRepository = new InMemoryUserRepository();
    const useCase = new RegisterUseCase(authRepository, userRepository);

    await expect(
      useCase.execute({
        email: "new-user@example.com",
        name: "New User",
        password: "password",
      }),
    ).rejects.toThrow(ValidationError);

    expect(userRepository.createdUsers).toEqual([]);
    expect(authRepository.createdRefreshTokens).toEqual([]);
  });

  it("logs in users with valid credentials", async () => {
    const password = "Password123";
    const passwordHash = await bcrypt.hash(password, 10);
    const user = makeUser({ passwordHash });
    const authRepository = new InMemoryAuthRepository();
    const useCase = new LoginUseCase(
      authRepository,
      new InMemoryUserAuthLookup([user]),
    );

    const result = await useCase.execute({
      email: user.email,
      password,
    });

    expect(authRepository.createdRefreshTokens).toHaveLength(1);
    expect(result.user).toMatchObject({
      email: user.email,
      id: user.id,
      name: user.name,
    });
    expect(result.user).not.toHaveProperty("passwordHash");
  });

  it("rejects invalid login credentials", async () => {
    const passwordHash = await bcrypt.hash("Password123", 10);
    const user = makeUser({ passwordHash });
    const authRepository = new InMemoryAuthRepository();
    const useCase = new LoginUseCase(
      authRepository,
      new InMemoryUserAuthLookup([user]),
    );

    await expect(
      useCase.execute({
        email: user.email,
        password: "WrongPassword123",
      }),
    ).rejects.toThrow(UnauthorizedError);

    await expect(
      useCase.execute({
        email: "missing@example.com",
        password: "Password123",
      }),
    ).rejects.toThrow(UnauthorizedError);
    expect(authRepository.createdRefreshTokens).toEqual([]);
  });

  it("refreshes a valid session and revokes the old refresh token", async () => {
    const refreshToken = "valid-refresh-token";
    const user = makeUser();
    const refreshTokenRecord = makeRefreshTokenRecord(refreshToken, {
      userId: user.id,
    });
    const authRepository = new InMemoryAuthRepository([refreshTokenRecord]);
    const useCase = new RefreshSessionUseCase(
      authRepository,
      new InMemoryUserAuthLookup([user]),
    );

    const result = await useCase.execute({ refreshToken });

    expect(authRepository.revokedRefreshTokenIds).toEqual([
      refreshTokenRecord.id,
    ]);
    expect(authRepository.createdRefreshTokens).toHaveLength(1);
    expect(result.user).toMatchObject({
      id: user.id,
      role: user.role,
    });
  });

  it("revokes all user refresh tokens when a revoked token is reused", async () => {
    const refreshToken = "reused-refresh-token";
    const refreshTokenRecord = makeRefreshTokenRecord(refreshToken, {
      revokedAt: new Date(),
    });
    const authRepository = new InMemoryAuthRepository([refreshTokenRecord]);
    const useCase = new RefreshSessionUseCase(
      authRepository,
      new InMemoryUserAuthLookup([]),
    );

    await expect(useCase.execute({ refreshToken })).rejects.toThrow(
      UnauthorizedError,
    );

    expect(authRepository.revokedUserIds).toEqual([refreshTokenRecord.userId]);
    expect(authRepository.createdRefreshTokens).toEqual([]);
  });

  it("revokes expired refresh tokens", async () => {
    const refreshToken = "expired-refresh-token";
    const refreshTokenRecord = makeRefreshTokenRecord(refreshToken, {
      expiresAt: new Date(Date.now() - 1_000),
    });
    const authRepository = new InMemoryAuthRepository([refreshTokenRecord]);
    const useCase = new RefreshSessionUseCase(
      authRepository,
      new InMemoryUserAuthLookup([]),
    );

    await expect(useCase.execute({ refreshToken })).rejects.toThrow(
      UnauthorizedError,
    );

    expect(authRepository.revokedRefreshTokenIds).toEqual([
      refreshTokenRecord.id,
    ]);
    expect(authRepository.createdRefreshTokens).toEqual([]);
  });

  it("logs out active refresh tokens", async () => {
    const refreshToken = "active-refresh-token";
    const refreshTokenRecord = makeRefreshTokenRecord(refreshToken);
    const authRepository = new InMemoryAuthRepository([refreshTokenRecord]);
    const useCase = new LogoutUseCase(authRepository);

    await useCase.execute({ refreshToken });

    expect(authRepository.revokedRefreshTokenIds).toEqual([
      refreshTokenRecord.id,
    ]);
  });

  it("ignores logout for missing refresh tokens", async () => {
    const authRepository = new InMemoryAuthRepository();
    const useCase = new LogoutUseCase(authRepository);

    await useCase.execute({ refreshToken: "missing-refresh-token" });

    expect(authRepository.revokedRefreshTokenIds).toEqual([]);
  });

  it("logs out all sessions for a user", async () => {
    const authRepository = new InMemoryAuthRepository();
    const useCase = new LogoutAllUseCase(authRepository);
    const userId = faker.string.uuid();

    await useCase.execute(userId);

    expect(authRepository.revokedUserIds).toEqual([userId]);
  });

  it("gets the current public user", async () => {
    const user = makeUser();
    const useCase = new GetCurrentUserUseCase(new InMemoryUserAuthLookup([user]));

    const result = await useCase.execute(user.id);

    expect(result).toEqual({
      createdAt: user.createdAt,
      email: user.email,
      id: user.id,
      name: user.name,
      role: user.role,
    });
  });

  it("rejects current users that no longer exist", async () => {
    const useCase = new GetCurrentUserUseCase(new InMemoryUserAuthLookup([]));

    await expect(useCase.execute(faker.string.uuid())).rejects.toThrow(
      UnauthorizedError,
    );
  });
});
