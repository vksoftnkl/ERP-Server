import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { IS_OPTIONAL_AUTH_KEY } from '../../../common/decorators/optional-auth.decorator';
import { PASSWORD_CHANGE_ALLOWED_KEY } from '../../../common/decorators/password-change-allowed.decorator';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuthEpochService } from '../../app-version/services/auth-epoch.service';
import { AuthSessionService } from '../auth-session.service';
import { AccessTokenPayload, TokenService } from '../token.service';
import { AuthErrorCode, authErrorBody } from '../types/auth-error-codes';
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
    private readonly authEpoch: AuthEpochService,
    // Review step 6 (U8): read only for a session whose token says its password must change.
    private readonly prisma: PrismaService,
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
      // @OptionalAuth: no Authorization header at all = an anonymous call. A header
      // that is there but malformed is still refused below, as on any route.
      if (!request.headers.authorization && this.isOptionalAuth(context)) {
        return true;
      }
      throw new UnauthorizedException(
        authErrorBody(
          'Missing or invalid Authorization header',
          'authorization',
          AuthErrorCode.AUTHORIZATION_MISSING,
        ),
      );
    }
    request.user = this.tokenService.verifyAccessToken(accessToken);
    // Part B Step 2 Rev 2: a token minted before the last backend update is
    // dead (401 AUTH_BACKEND_UPDATED), whatever Redis still holds. In memory,
    // no DB read. The build itself is checked only at login + refresh (D7).
    this.authEpoch.assertTokenEpoch(request.user.ep, 'access');
    await this.authSessionService.assertAccessTokenIsActive(accessToken, request.user);
    this.requestContextService.setUserId(request.user.sub);
    this.requestContextService.setUserType(request.user.user_type);
    this.requestContextService.setCompanyId(request.user.company_id);
    this.requestContextService.setBranchId(request.user.branch_id);
    this.requestContextService.setDeviceId(request.user.device_id);
    if (request.user.pwc === true && !this.isPasswordChangeAllowed(context)) {
      await this.assertPasswordChanged(request.user.sub);
    }
    return true;
  }
  /**
   * Review step 6 (U8): a session that logged in on an administrator's reset password may
   * call only the routes marked @AllowWhilePasswordChangeRequired (POST /auth/change-password)
   * until the user has changed it. The token cannot say it has been changed, so the user row
   * decides: a session that changed its password goes on without logging in again. Every
   * other session (no `pwc` claim) never reads the table here.
   * 403 AUTH_PASSWORD_CHANGE_REQUIRED, never 401: a client refreshes and retries on a 401.
   */
  private async assertPasswordChanged(usrId: string): Promise<void> {
    const user = await this.prisma.userMaster.findUnique({
      where: { usrId },
      select: { usrMustChangePassword: true },
    });
    if (user?.usrMustChangePassword === false) {
      return;
    }
    throw new ForbiddenException(
      authErrorBody(
        'Your password was reset: change it before you go on',
        'authorization',
        AuthErrorCode.PASSWORD_CHANGE_REQUIRED,
      ),
    );
  }
  private isPasswordChangeAllowed(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(PASSWORD_CHANGE_ALLOWED_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }
  private isOptionalAuth(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_OPTIONAL_AUTH_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
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
