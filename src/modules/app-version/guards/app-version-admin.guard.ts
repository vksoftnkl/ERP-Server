import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { APP_VERSION_ADMIN_TYPES } from '../app-version.constants';
import { AppVersionErrorCode, appVersionErrorBody } from '../types/app-version-error-codes';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RequestWithUser = Request & { user?: { sub?: unknown } };

/**
 * Part B Step 2 Rev 2 (decision D5): the release, policy and support routes are
 * for an ADMIN or SUPER ADMIN user. They used to take an X-Ops-Key instead;
 * that is gone. The global AccessTokenGuard runs first, so a call with no or a
 * dead token is already 401. This guard adds 403 APP_VERSION_ADMIN_ONLY.
 *
 * The role is read from user_master on every call, never from the token's
 * user_type claim, so a role taken away stops counting at once (the same rule
 * as callerIsSuperAdmin, notes 125).
 */
@Injectable()
export class AppVersionAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user?.sub;
    if (typeof userId === 'string' && UUID.test(userId)) {
      const user = await this.prisma.userMaster.findFirst({
        where: { usrId: userId, usrIsActive: true, usrIsDeleted: false },
        select: { usrType: true },
      });
      const role = user?.usrType?.trim().toUpperCase() ?? '';
      if (APP_VERSION_ADMIN_TYPES.includes(role)) {
        return true;
      }
    }
    throw new ForbiddenException(
      appVersionErrorBody(
        'Only an ADMIN or SUPER ADMIN user may use this route',
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
