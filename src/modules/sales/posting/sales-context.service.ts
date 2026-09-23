import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { AppSettingValueService } from '../../settings/appSettings/app-setting-value.service';
import { loadRights, type SalesRight } from './sales.guards';
import { readSalesSettings, type SalesSettings } from './sales.settings';
import type { RightsBlock } from './types/posting.types';

/**
 * What every sales verb needs before it touches a row: WHO is calling, WHAT
 * the company has configured, and WHICH of the four `user_menus` flags the
 * caller holds on this screen.
 *
 * Resolved ONCE per request and handed down, so the guards, the leg builder
 * and the response all see the same settings — a post whose discount cap
 * changed halfway through would be a genuinely confusing bug.
 */
export interface SalesCallContext {
  userId: string;
  /** What audit columns get: the user id, or the nil actor when unauthenticated. */
  actor: string;
  settings: SalesSettings;
  /** `accounts.cogs_mode` — PERPETUAL writes the COGS pair, PERIODIC does not. */
  cogsMode: 'PERPETUAL' | 'PERIODIC';
  rights: RightsBlock;
}

@Injectable()
export class SalesContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly appSettings: AppSettingValueService,
  ) {}

  /** The caller's id, or the nil actor. Never null: every audit column wants one. */
  actor(): string {
    return this.requestContext.getUserId() ?? DEFAULT_ACTOR;
  }

  async resolve(
    scope: { companyId: string; branchId: string; deviceId?: string | null },
    menuId: number,
    client?: Prisma.TransactionClient,
  ): Promise<SalesCallContext> {
    const userId = this.requestContext.getUserId();
    const effective = await this.appSettings.resolveEffective({
      companyId: scope.companyId,
      branchId: scope.branchId,
      deviceId: isUuid(scope.deviceId) ? scope.deviceId : null,
      userId: isUuid(userId) ? userId : null,
    });
    const settings = readSalesSettings(effective);
    const cogs = (effective.find((i) => i.asdKey === 'accounts.cogs_mode')?.value ?? '')
      .trim()
      .toUpperCase();

    const rights = isUuid(userId)
      ? await loadRights(client ?? this.prisma, userId, menuId)
      : { post: false, cancel: false, amend: false, override: false, retender: false };

    return {
      userId: userId ?? DEFAULT_ACTOR,
      actor: userId ?? DEFAULT_ACTOR,
      settings,
      cogsMode: cogs === 'PERIODIC' ? 'PERIODIC' : 'PERPETUAL',
      rights,
    };
  }

  /** Settings alone, for a save that checks no rights. */
  async settings(
    companyId: string,
    branchId: string,
    deviceId?: string | null,
  ): Promise<SalesSettings> {
    const effective = await this.appSettings.resolveEffective({
      companyId,
      branchId,
      deviceId: isUuid(deviceId) ? deviceId : null,
      userId: null,
    });
    return readSalesSettings(effective);
  }

  /** One raw setting value (any key, any module) through the same resolver. */
  async setting(companyId: string, branchId: string, key: string): Promise<string | null> {
    const effective = await this.appSettings.resolveEffective({
      companyId,
      branchId,
      deviceId: null,
      userId: null,
    });
    return effective.find((i) => i.asdKey === key)?.value ?? null;
  }

  /** All five flags, for a `/get` that resolves no settings. */
  async rights(menuId: number, client?: Prisma.TransactionClient): Promise<RightsBlock> {
    const userId = this.requestContext.getUserId();
    if (!isUuid(userId)) {
      return { post: false, cancel: false, amend: false, override: false, retender: false };
    }
    // Returned whole. Re-listing the keys here is what dropped `retender` from
    // every /get: loadRights already reads all five, and a second list of them
    // is a second place to forget one.
    return loadRights(client ?? this.prisma, userId, menuId);
  }

  hasRight(ctx: SalesCallContext, right: SalesRight): boolean {
    return ctx.rights[right] === true;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: string | null | undefined): v is string {
  return !!v && UUID.test(v);
}
