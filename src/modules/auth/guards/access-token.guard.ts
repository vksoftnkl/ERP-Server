import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuthSessionService } from '../auth-session.service';
import { AccessTokenPayload, TokenService } from '../token.service';
type RequestWithUser = Request & {
  user?: AccessTokenPayload;
};
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    private readonly authSessionService: AuthSessionService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (request.method.toUpperCase() === 'OPTIONS') {
      return true;
    }
    const accessToken = this.extractBearerToken(request);
    if (!accessToken) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }
    request.user = this.tokenService.verifyAccessToken(accessToken);
    await this.authSessionService.assertAccessTokenIsActive(accessToken, request.user);
    this.requestContextService.setUserId(request.user.sub);
    return true;
  }
  private extractBearerToken(request: Request): string | null {
    const authorizationHeader = request.headers.authorization;
    if (!authorizationHeader) {
      return null;
    }
    const [scheme, token, ...rest] = authorizationHeader.trim().split(/\s+/);
    if (rest.length > 0 || !scheme || !token || scheme.toLowerCase() !== 'bearer') {
      return null;
    }
    return token;
  }
}