import { UnauthorizedException } from '@nestjs/common';
import { User } from '@prisma/client';
import { scrypt as nodeScrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

const scryptAsync = promisify(nodeScrypt);
const TEST_USER_ID = '7a9a4d16-9940-4b65-a7bc-57e83887a112';

type UsersServiceMock = {
  findByUsername: jest.Mock<Promise<User | null>, [string]>;
};

type TokenServiceMock = {
  signAccessToken: jest.Mock<
    { token: string; expiresIn: number },
    [{ sub: string; user_name: string }]
  >;
};

const hashPasswordForTest = async (plainPassword: string): Promise<string> => {
  const salt = 'unit-test-salt';
  const derivedKey = (await scryptAsync(plainPassword, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
};

const makeUser = (overrides: Partial<User> = {}): User => ({
  user_id: TEST_USER_ID,
  user_name: 'john.doe',
  user_password: 'scrypt$unit-test-salt$invalid',
  ...overrides,
});

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersServiceMock;
  let tokenService: TokenServiceMock;

  beforeEach(() => {
    usersService = {
      findByUsername: jest.fn<Promise<User | null>, [string]>(),
    };
    tokenService = {
      signAccessToken: jest
        .fn<{ token: string; expiresIn: number }, [{ sub: string; user_name: string }]>()
        .mockReturnValue({
          token: 'signed-jwt-token',
          expiresIn: 3600,
        }),
    };

    service = new AuthService(
      usersService as unknown as UsersService,
      tokenService as unknown as TokenService,
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
      expires_in: 3600,
    });

    expect(usersService.findByUsername).toHaveBeenCalledWith('john.doe');
    expect(tokenService.signAccessToken).toHaveBeenCalledWith({
      sub: TEST_USER_ID,
      user_name: 'john.doe',
    });
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
  });
});
