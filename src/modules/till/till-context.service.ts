import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import {
  assertMenuRight,
  loadRights,
  NO_RIGHTS,
  type MenuRight,
  type MenuRights,
} from '../../common/posting/rights';
import { DEFAULT_ACTOR } from '../../common/utils/module-shared.utils';
import { AppSettingValueService } from '../settings/appSettings/app-setting-value.service';
import { readTillSettings, type TillSettings } from './till.settings';
import { TILL_RIGHT_CODE_PREFIX } from './types/till-enum';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string | null | undefined): value is string =>
  typeof value === 'string' && UUID.test(value);

/** Who is calling, from where, under which settings — resolved once per verb. */
export interface TillCaller {
  /** user_master.usr_id, or the nil actor when unauthenticated (never in practice: the guard runs first). */
  userId: string;
  /** For the TEXT *_created_by / *_modified_by columns: the login name. */
  actorName: string;
  /** The login token's device (fixed.device_master.dev_id), or null for a web / unregistered client. */
  deviceId: string | null;
}

@Injectable()
export class TillContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly appSettings: AppSettingValueService,
  ) {}

  async caller(client?: Prisma.TransactionClient): Promise<TillCaller> {
    const userId = this.requestContext.getUserId();
    const deviceId = this.requestContext.getDeviceId();
    return {
      userId: isUuid(userId) ? userId : DEFAULT_ACTOR,
      actorName: await loginNameOf(client ?? this.prisma, userId),
      deviceId: isUuid(deviceId) ? deviceId : null,
    };
  }

  /** The `till.*` settings for this company / branch / device / user. */
  async settings(scope: {
    companyId: string;
    branchId: string;
    deviceId?: string | null;
    userId?: string | null;
  }): Promise<TillSettings> {
    const effective = await this.appSettings.resolveEffective({
      companyId: scope.companyId,
      branchId: scope.branchId,
      deviceId: isUuid(scope.deviceId) ? scope.deviceId : null,
      userId: isUuid(scope.userId) ? scope.userId : null,
    });
    return readTillSettings(effective);
  }

  /** 403 TILL_RIGHT_<RIGHT> unless the caller holds `right` on `menuId`. */
  async requireRight(menuId: number, right: MenuRight, action: string): Promise<MenuRights> {
    return assertMenuRight(this.prisma, {
      userId: this.requestContext.getUserId(),
      menuId,
      right,
      codePrefix: TILL_RIGHT_CODE_PREFIX,
      action,
    });
  }

  /** Every flag on a menu, for a decision that is not a refusal (blind mode). */
  async rights(menuId: number): Promise<MenuRights> {
    const userId = this.requestContext.getUserId();
    return isUuid(userId) ? loadRights(this.prisma, userId, menuId) : { ...NO_RIGHTS };
  }
}

async function loginNameOf(
  client: Prisma.TransactionClient | PrismaService,
  userId: string | null,
): Promise<string> {
  if (!isUuid(userId)) {
    return userId ?? DEFAULT_ACTOR;
  }
  const user = await client.userMaster.findUnique({
    where: { usrId: userId },
    select: { usrLoginName: true },
  });
  return user?.usrLoginName ?? userId;
}
