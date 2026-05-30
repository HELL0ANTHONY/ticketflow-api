export class LogoutAllUseCase {
  constructor(
    private readonly authRepository: {
      revokeAllRefreshTokensForUser(userId: string): Promise<void>;
    },
  ) {}

  execute(userId: string): Promise<void> {
    return this.authRepository.revokeAllRefreshTokensForUser(userId);
  }
}
