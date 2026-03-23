import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { UsersService } from '../users/users.service';
import { LoginAuthDto } from './dto/login-auth.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { AuthSessionService } from './auth-session.service';
import { TokenService } from './token.service';

const scryptAsync = promisify(nodeScrypt);

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  async login(loginAuthDto: LoginAuthDto): Promise<LoginResponseDto> {
    const user = await this.usersService.findByUsername(loginAuthDto.user_name);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.verifyPassword(
      loginAuthDto.user_password,
      user.user_password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const issuedAccessToken = this.tokenService.signAccessToken({
      sub: user.user_id,
      user_name: user.user_name,
      sid: randomUUID(),
    });
    await this.authSessionService.storeAccessTokenSession(
      issuedAccessToken.token,
      issuedAccessToken.payload,
    );

    return {
      access_token: issuedAccessToken.token,
      token_type: 'Bearer',
    };
  }

  private async verifyPassword(plainPassword: string, storedPassword: string): Promise<boolean> {
    try {
      const [algorithm, salt, hashHex] = storedPassword.split('$');
      if (algorithm !== 'scrypt' || !salt || !hashHex) {
        return false;
      }

      const storedHashBuffer = Buffer.from(hashHex, 'hex');
      if (storedHashBuffer.length === 0) {
        return false;
      }

      const computedHashBuffer = (await scryptAsync(
        plainPassword,
        salt,
        storedHashBuffer.length,
      )) as Buffer;

      if (computedHashBuffer.length !== storedHashBuffer.length) {
        return false;
      }

      return timingSafeEqual(computedHashBuffer, storedHashBuffer);
    } catch {
      return false;
    }
  }
}
