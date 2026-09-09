import { NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService local personal mode', () => {
  const user = { id: 'user-1', email: 'pesquisa.local@leadhunter.app', name: 'Uso pessoal', role: 'USER' };
  const prisma = {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  };
  const jwt = { signAsync: jest.fn() };
  const config = { get: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    jwt.signAsync.mockResolvedValueOnce('access-token').mockResolvedValueOnce('refresh-token');
  });

  it('reuses the existing local user so saved leads remain accessible', async () => {
    config.get.mockImplementation((key: string, fallback?: unknown) => ({
      localPersonalMode: true,
      localUserEmail: user.email,
      'jwt.refreshSecret': 'refresh-secret',
      'jwt.refreshExpiration': '7d',
    } as Record<string, unknown>)[key] ?? fallback);
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue(user);
    const service = new AuthService(prisma as any, jwt as any, config as any);
    const result = await service.localSession();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ user, accessToken: 'access-token', refreshToken: 'refresh-token', localMode: true });
  });

  it('does not expose local login when personal mode is disabled', async () => {
    config.get.mockImplementation((_key: string, fallback?: unknown) => fallback);
    const service = new AuthService(prisma as any, jwt as any, config as any);
    await expect(service.localSession()).rejects.toBeInstanceOf(NotFoundException);
  });

  it('migrates the local personal profile from Brasil to Portugal', async () => {
    config.get.mockImplementation((key: string, fallback?: unknown) => ({
      localPersonalMode: true,
      localUserEmail: user.email,
      'jwt.refreshSecret': 'refresh-secret',
      'jwt.refreshExpiration': '7d',
    } as Record<string, unknown>)[key] ?? fallback);
    prisma.user.findUnique.mockResolvedValue({ ...user, defaultCountry: 'Brasil' });
    prisma.user.update
      .mockResolvedValueOnce({ ...user, defaultCountry: 'Portugal' })
      .mockResolvedValueOnce({ ...user, defaultCountry: 'Portugal' });
    const service = new AuthService(prisma as any, jwt as any, config as any);
    const result = await service.localSession();
    expect(prisma.user.update).toHaveBeenNthCalledWith(1, {
      where: { id: user.id }, data: { defaultCountry: 'Portugal' },
    });
    expect(result.user.defaultCountry).toBe('Portugal');
  });
});
