import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { UserType } from '../../settings/userAdministration/types/user-administration.enum';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AccessTokenPayload } from '../token.service';
type RequestWithUser = Request & {
  user?: AccessTokenPayload;
};
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserType[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (request.method.toUpperCase() === 'OPTIONS') {
      return true;
    }
    const tokenPayload = request.user;
    if (!tokenPayload) {
      throw new ForbiddenException('Insufficient permissions');
    }
    const userType = tokenPayload.user_type ?? (await this.loadUserType(tokenPayload.sub));
    if (!userType) {
      throw new ForbiddenException('Insufficient permissions');
    }
    if (userType === UserType.SUPER_ADMIN || requiredRoles.includes(userType as UserType)) {
      return true;
    }
    throw new ForbiddenException('Insufficient permissions');
  }
  /**
   * Fallback for access tokens issued before the user_type claim existed.
   * Those tokens age out within the access-token TTL, so this lookup is transitional.
   */
  private async loadUserType(userId: string): Promise<string | null> {
    const user = await this.prisma.userMaster.findFirst({
      where: { usrId: userId, usrIsDeleted: false, usrIsActive: true },
      select: { usrType: true },
    });
    return user?.usrType ?? null;
  }
}
