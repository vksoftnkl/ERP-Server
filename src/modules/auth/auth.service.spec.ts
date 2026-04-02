import { UnauthorizedException } from '@nestjs/common';
import { User } from '@prisma/client';
import { scrypt as nodeScrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { UsersService } from '../users/users.service';
import { AuthSessionService } from './auth-session.service';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

const scryptAsync = promisify(nodeScrypt);
const TEST_USER_ID = '7a9a4d16-9940-4b65-a7bc-57e83887a112';
const TEST_TIMESTAMP = new Date('2026-03-20T00:00:00.000Z');

type UsersServiceMock = {
  findByUsername: jest.Mock<Promise<User | null>, [string]>;
};

type TokenServiceMock = {
  signAccessToken: jest.Mock<
    { token: string; payload: { sub: string; user_name: string; sid: string; iat: number; exp: number } },
    [{ sub: string; user_name: string; sid: string }]
  >;
};

type AuthSessionServiceMock = {
  createSessionId: jest.Mock<string, []>;
  storeAccessTokenSession: jest.Mock<
    Promise<void>,
    [string, { sub: string; user_name: string; sid: string; iat: number; exp: number }]
  >;
};

const hashPasswordForTest = async (plainPassword: string): Promise<string> => {
  const salt = 'unit-test-salt';
  const derivedKey = (await scryptAsync(plainPassword, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
};

const makeUser = (overrides: Partial<User> = {}): User => ({
  user_id: TEST_USER_ID,
  user_code: 'us1000',
  user_phone: '9999999999',
  user_name: 'john.doe',
  user_password: 'scrypt$unit-test-salt$invalid',
  created_at: TEST_TIMESTAMP,
  updated_at: TEST_TIMESTAMP,
  ...overrides,
});

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersServiceMock;
  let tokenService: TokenServiceMock;
  let authSessionService: AuthSessionServiceMock;

  beforeEach(() => {
    usersService = {
      findByUsername: jest.fn<Promise<User | null>, [string]>(),
    };
    tokenService = {
      signAccessToken: jest
        .fn<
          { token: string; payload: { sub: string; user_name: string; sid: string; iat: number; exp: number } },
          [{ sub: string; user_name: string; sid: string }]
        >()
        .mockReturnValue({
          token: 'signed-jwt-token',
          payload: {
            sub: TEST_USER_ID,
            user_name: 'john.doe',
            sid: '4e457f70-cc9b-4e8f-b7e4-35cc3f588c22',
            iat: 1_710_979_200,
            exp: 1_710_982_800,
          },
        }),
    };
    authSessionService = {
      createSessionId: jest.fn<string, []>().mockReturnValue('4e457f70-cc9b-4e8f-b7e4-35cc3f588c22'),
      storeAccessTokenSession: jest
        .fn<
          Promise<void>,
          [string, { sub: string; user_name: string; sid: string; iat: number; exp: number }]
        >()
        .mockResolvedValue(undefined),
    };

    service = new AuthService(
      usersService as unknown as UsersService,
      tokenService as unknown as TokenService,
      authSessionService as unknown as AuthSessionService,
    );
  });

  it('returns token when credentials are valid', async () => {
    const hashedPassword = await hashPasswordForTest('StrongPassword123!');
    usersService.findByUsername.mockResolvedValue(
      makeUser({ user_name: 'john.doe', user_password: hashedPassword }),
    );

    await expect(
      service.login({
        user_name: 'john.doe',
        user_password: 'StrongPassword123!',
      }),
    ).resolves.toEqual({
      access_token: 'signed-jwt-token',
      token_type: 'Bearer',
      user_id: TEST_USER_ID,
    });

    expect(usersService.findByUsername).toHaveBeenCalledWith('john.doe');
    expect(tokenService.signAccessToken).toHaveBeenCalledWith({
      sub: TEST_USER_ID,
      user_name: 'john.doe',
      sid: '4e457f70-cc9b-4e8f-b7e4-35cc3f588c22',
    });
    expect(authSessionService.storeAccessTokenSession).toHaveBeenCalledWith(
      'signed-jwt-token',
      {
        sub: TEST_USER_ID,
        user_name: 'john.doe',
        sid: '4e457f70-cc9b-4e8f-b7e4-35cc3f588c22',
        iat: 1_710_979_200,
        exp: 1_710_982_800,
      },
    );
  });

  it('throws unauthorized when username does not exist', async () => {
    usersService.findByUsername.mockResolvedValue(null);

    await expect(
      service.login({
        user_name: 'missing.user',
        user_password: 'StrongPassword123!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(tokenService.signAccessToken).not.toHaveBeenCalled();
    expect(authSessionService.storeAccessTokenSession).not.toHaveBeenCalled();
  });

  it('throws unauthorized when password is invalid', async () => {
    const hashedPassword = await hashPasswordForTest('CorrectPassword123!');
    usersService.findByUsername.mockResolvedValue(
      makeUser({ user_name: 'john.doe', user_password: hashedPassword }),
    );

    await expect(
      service.login({
        user_name: 'john.doe',
        user_password: 'WrongPassword123!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(tokenService.signAccessToken).not.toHaveBeenCalled();
    expect(authSessionService.storeAccessTokenSession).not.toHaveBeenCalled();
  });
});
