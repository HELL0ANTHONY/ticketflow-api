import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import type { UserRepository } from "#/modules/users/application/ports/user-repository.js";
import type {
  ChangeUserRoleInput,
  CreateUserData,
  ListUsersFilters,
  User,
} from "#/modules/users/domain/user.js";

import {
  ForbiddenError,
  NotFoundError,
} from "#/shared/errors/application-error.js";

import { ChangeUserRoleUseCase } from "./change-user-role.use-case.js";
import { GetUserByIdUseCase } from "./get-user-by-id.use-case.js";
import { ListUsersUseCase } from "./list-users.use-case.js";

class InMemoryUserRepository implements UserRepository {
  readonly changeRoleCalls: ChangeUserRoleInput[] = [];
  readonly listCalls: ListUsersFilters[] = [];

  constructor(private readonly users: User[]) {}

  changeRole(input: ChangeUserRoleInput): Promise<User> {
    this.changeRoleCalls.push(input);

    const user = this.users.find((candidate) => candidate.id === input.userId);

    if (user === undefined) {
      throw new Error("User not found");
    }

    user.role = input.role;

    return Promise.resolve(user);
  }

  create(input: CreateUserData): Promise<User> {
    const user = makeUser(input);
    this.users.push(user);

    return Promise.resolve(user);
  }

  findById(input: { id: string }): Promise<User | undefined> {
    return Promise.resolve(this.users.find((user) => user.id === input.id));
  }

  list(filters: ListUsersFilters): Promise<User[]> {
    this.listCalls.push(filters);

    if (filters.role === undefined) {
      return Promise.resolve([...this.users]);
    }

    return Promise.resolve(
      this.users.filter((user) => user.role === filters.role),
    );
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

describe("users use cases", () => {
  it("lists public users without password hashes", async () => {
    const users = [
      makeUser({ role: "admin" }),
      makeUser({ role: "agent" }),
      makeUser({ role: "customer" }),
    ];
    const repository = new InMemoryUserRepository(users);
    const useCase = new ListUsersUseCase(repository);

    const result = await useCase.execute({ role: "agent" });

    expect(repository.listCalls).toEqual([{ role: "agent" }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      email: users[1]?.email,
      id: users[1]?.id,
      name: users[1]?.name,
      role: "agent",
    });
    expect(result[0]).not.toHaveProperty("passwordHash");
  });

  it("gets a public user by id", async () => {
    const user = makeUser();
    const repository = new InMemoryUserRepository([user]);
    const useCase = new GetUserByIdUseCase(repository);

    const result = await useCase.execute({ id: user.id });

    expect(result).toEqual({
      createdAt: user.createdAt,
      email: user.email,
      id: user.id,
      name: user.name,
      role: user.role,
    });
  });

  it("throws when a user does not exist", async () => {
    const repository = new InMemoryUserRepository([]);
    const useCase = new GetUserByIdUseCase(repository);

    await expect(useCase.execute({ id: faker.string.uuid() })).rejects.toThrow(
      NotFoundError,
    );
  });

  it("lets admins change user roles", async () => {
    const actor = makeUser({ role: "admin" });
    const user = makeUser({ role: "customer" });
    const repository = new InMemoryUserRepository([actor, user]);
    const useCase = new ChangeUserRoleUseCase(repository);

    const result = await useCase.execute({
      actorId: actor.id,
      role: "agent",
      userId: user.id,
    });

    expect(repository.changeRoleCalls).toEqual([
      {
        actorId: actor.id,
        role: "agent",
        userId: user.id,
      },
    ]);
    expect(result).toMatchObject({
      id: user.id,
      role: "agent",
    });
    expect(result).not.toHaveProperty("passwordHash");
  });

  it("prevents non-admins from changing user roles", async () => {
    const actor = makeUser({ role: "agent" });
    const user = makeUser({ role: "customer" });
    const repository = new InMemoryUserRepository([actor, user]);
    const useCase = new ChangeUserRoleUseCase(repository);

    await expect(
      useCase.execute({
        actorId: actor.id,
        role: "admin",
        userId: user.id,
      }),
    ).rejects.toThrow(ForbiddenError);

    expect(repository.changeRoleCalls).toEqual([]);
  });

  it("throws before changing a missing target user", async () => {
    const actor = makeUser({ role: "admin" });
    const repository = new InMemoryUserRepository([actor]);
    const useCase = new ChangeUserRoleUseCase(repository);

    await expect(
      useCase.execute({
        actorId: actor.id,
        role: "agent",
        userId: faker.string.uuid(),
      }),
    ).rejects.toThrow(NotFoundError);

    expect(repository.changeRoleCalls).toEqual([]);
  });
});
