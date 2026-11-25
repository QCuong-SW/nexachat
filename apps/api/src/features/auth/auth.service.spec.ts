import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
  };
  let jwtService: {
    signAsync: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-jwt-token'),
    };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
    );
  });

  describe('normalizeEmail', () => {
    it('trims whitespace and lowercases email', () => {
      expect(service.normalizeEmail('  Alice.Dev@Example.COM  ')).toBe(
        'alice.dev@example.com',
      );
    });
  });

  describe('register', () => {
    it('hashes password with Argon2id, normalizes email, and never returns passwordHash', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const createdAt = new Date('2026-11-23T00:00:00.000Z');
      prisma.user.create.mockImplementation(
        async (args: {
          data: { email: string; passwordHash: string; displayName: string };
        }) => ({
          id: '11111111-1111-4111-8111-111111111111',
          email: args.data.email,
          displayName: args.data.displayName,
          createdAt,
          updatedAt: createdAt,
        }),
      );

      const result = await service.register({
        email: '  Alice@Example.COM ',
        password: 'StrongPassword123!',
        displayName: '  Alice Nguyen  ',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'alice@example.com' },
        select: { id: true },
      });

      const createCall = prisma.user.create.mock.calls[0][0];
      expect(createCall.data.email).toBe('alice@example.com');
      expect(createCall.data.displayName).toBe('Alice Nguyen');
      expect(createCall.data.passwordHash).toMatch(/^\$argon2id\$/);
      expect(
        await argon2.verify(createCall.data.passwordHash, 'StrongPassword123!'),
      ).toBe(true);

      expect(result.accessToken).toBe('signed-jwt-token');
      expect(result.user).toEqual({
        id: '11111111-1111-4111-8111-111111111111',
        email: 'alice@example.com',
        displayName: 'Alice Nguyen',
        createdAt,
        updatedAt: createdAt,
      });
      expect('passwordHash' in result.user).toBe(false);
    });

    it('rejects duplicate email with ConflictException', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing-id' });

      await expect(
        service.register({
          email: 'alice@example.com',
          password: 'StrongPassword123!',
          displayName: 'Alice',
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('authenticates valid credentials and excludes passwordHash from returned user', async () => {
      const passwordHash = await argon2.hash('StrongPassword123!', {
        type: argon2.argon2id,
      });
      const now = new Date();
      prisma.user.findUnique.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111111',
        email: 'alice@example.com',
        displayName: 'Alice',
        passwordHash,
        createdAt: now,
        updatedAt: now,
      });

      const result = await service.login({
        email: 'ALICE@example.com',
        password: 'StrongPassword123!',
      });

      expect(result.accessToken).toBe('signed-jwt-token');
      expect(result.user.email).toBe('alice@example.com');
      expect('passwordHash' in result.user).toBe(false);
    });

    it('rejects non-existent user with UnauthorizedException', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nobody@example.com',
          password: 'StrongPassword123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects wrong password with UnauthorizedException', async () => {
      const passwordHash = await argon2.hash('CorrectPassword123!', {
        type: argon2.argon2id,
      });
      prisma.user.findUnique.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111111',
        email: 'alice@example.com',
        displayName: 'Alice',
        passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.login({
          email: 'alice@example.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getAuthenticatedUser', () => {
    it('returns user when found', async () => {
      const now = new Date();
      prisma.user.findUnique.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111111',
        email: 'alice@example.com',
        displayName: 'Alice',
        createdAt: now,
        updatedAt: now,
      });

      const user = await service.getAuthenticatedUser(
        '11111111-1111-4111-8111-111111111111',
      );
      expect(user.email).toBe('alice@example.com');
    });

    it('throws UnauthorizedException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.getAuthenticatedUser('missing-user-id'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
