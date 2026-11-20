import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { loadRights } from '../../common/posting/rights';
import { requireMobileLoginRow } from '../common/mobile-login';
import { requireMobileLogin } from '../common/mobile-scope';
import type { MobileMe, MobileMenuRights } from './types/mobile-me-api.types';

/** The menus the phone acts on: 11 Sales Order, 12 Sales Bill, 99 Receipt. */
export const MOBILE_ME_MENUS = [11, 12, 99] as const;

/**
 * GET /mobile/me: who the token is. The login, its employee (the collector a
 * phone receipt carries) and its rights on the menus the phone acts on, read
 * by loadRights, the reader every desktop guard uses (sales assertRight,
 * receipts assertMenuRight): one user_menus row per menu, no row = no rights.
 */
@Injectable()
export class MobileMeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async me(): Promise<MobileMe> {
    const userId = requireMobileLogin(this.requestContextService.getUserId());
    const login = await requireMobileLoginRow(this.prisma, userId);
    const rights: Record<string, MobileMenuRights> = {};
    for (const menuId of MOBILE_ME_MENUS) {
      const held = await loadRights(this.prisma, userId, menuId);
      rights[String(menuId)] = {
        view: held.view,
        create: held.create,
        post: held.post,
        cancel: held.cancel,
        print: held.print,
      };
    }
    return {
      userId: login.userId,
      loginName: login.loginName,
      employeeId: login.employeeId,
      employeeName: login.employeeName,
      rights,
    };
  }
}
