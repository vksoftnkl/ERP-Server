import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { APP_VERSION_ADMIN_TYPES, APP_VERSION_RELEASE_TYPES } from '../app-version.constants';
import { AppVersionErrorCode, appVersionErrorBody } from '../types/app-version-error-codes';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RequestWithUser = Request & { user?: { sub?: unknown } };

/** Which roles a route takes: admin only (default) or the release roles. */
export type AppVersionAccess = 'admin' | 'release';
export const APP_VERSION_ACCESS_KEY = 'appVersionAccess';
/** Marks a route as open to the release roles (ADMIN, SUPER ADMIN, RELEASE MANAGER). */
export const ReleaseAccess = (): MethodDecorator =>
  SetMetadata(APP_VERSION_ACCESS_KEY, 'release' satisfies AppVersionAccess);

const ROLES: Readonly<Record<AppVersionAccess, readonly string[]>> = {
  admin: APP_VERSION_ADMIN_TYPES,
  release: APP_VERSION_RELEASE_TYPES,
};

/**
 * Part B Step 2 Rev 2 (decision D5) / Step 4 (E5): who may use the release,
 * policy and support routes. The global AccessTokenGuard runs first, so a call
 * with no or a dead token is already 401. This guard adds 403
 * APP_VERSION_ADMIN_ONLY:
 *
 *   admin    (default)          ADMIN, SUPER ADMIN
 *   release  (@ReleaseAccess)   ADMIN, SUPER ADMIN, RELEASE MANAGER (the CI user)
 *
 * The role is read from user_master on every call, never from the token's
 * user_type claim, so a role taken away stops counting at once (the same rule
 * as callerIsSuperAdmin, notes 125).
 */
@Injectable()
export class AppVersionAdminGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const access =
      this.reflector.getAllAndOverride<AppVersionAccess | undefined>(APP_VERSION_ACCESS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'admin';
    const allowed = ROLES[access];
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user?.sub;
    if (typeof userId === 'string' && UUID.test(userId)) {
      const user = await this.prisma.userMaster.findFirst({
        where: { usrId: userId, usrIsActive: true, usrIsDeleted: false },
        select: { usrType: true },
      });
      const role = user?.usrType?.trim().toUpperCase() ?? '';
      if (allowed.includes(role)) {
        return true;
      }
    }
    throw new ForbiddenException(
      appVersionErrorBody(
        `Only a ${allowed.join(' / ')} user may use this route`,
        'authorization',
        AppVersionErrorCode.ADMIN_ONLY,
      ),
    );
  }
}

/** The signed-in user's id, for *_created_by / *_modified_by. */
export function actorOf(request: RequestWithUser): string {
  const userId = request.user?.sub;
  return typeof userId === 'string' && userId.length > 0 ? userId : 'unknown';
}
