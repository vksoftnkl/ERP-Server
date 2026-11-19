import { Injectable } from '@nestjs/common';
import { assertMenuRight, loadRights } from '../../common/posting/rights';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { throwForbidden } from '../../common/utils/module-shared.utils';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  AUDIT_LOG_RIGHT_PREFIX,
  AUDIT_LOGS_MENU_ID,
  AUDIT_UNMAPPED_SCREEN_READERS,
  auditScreenMenusOf,
} from './audit-screen-menus.constants';
import { ListAuditLogQueryDto } from './dto/list-audit-log-query.dto';
import { AuditLogErrorCode, type AuditLogErrorDetail } from './types/audit-log-error-codes';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A screen the query names: by id, by name, or both once it is found. */
type NamedAuditScreen = { screenId: number | null; screenName: string | null };

/**
 * What a list call may return beyond its own filters. `screenIds` null = nothing more
 * (the call names its screen, and the caller may read it); a list = only these screens.
 */
export type AuditReadScope = { screenIds: number[] | null };

/**
 * Review list 11-19 step 3 (follow-up), user 2026-11-19 — who may read the audit log.
 *
 *  - A History button (`screen_id` / `screen_name` + `record_pk`): the View right on the
 *    screen's menu (AUDIT_SCREEN_MENUS; any one of its menus when it has several).
 *  - The Audit Logs report (no `record_pk`): the View right on Audit Logs (menu 106) and,
 *    when it names a screen, on that screen's menu too; across all screens it lists only
 *    the screens the caller holds View on.
 *  - A screen no menu shows: an ADMIN or SUPER ADMIN only.
 *
 * No SUPER ADMIN bypass on a menu right — VKPOS reads by its own user_menus rows, like
 * every assertMenuRight gate. Refusal: 403 AUDIT_LOG_RIGHT_VIEW on `userId`.
 */
@Injectable()
export class AuditLogAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async resolveReadScope(query: ListAuditLogQueryDto): Promise<AuditReadScope> {
    const userId = this.requestContextService.getUserId();
    const namedScreens = await this.namedScreens(query);
    const isHistoryButton = namedScreens.length > 0 && Boolean(query.record_pk?.trim());
    if (!isHistoryButton) {
      await assertMenuRight(this.prisma, {
        userId,
        menuId: AUDIT_LOGS_MENU_ID,
        right: 'view',
        codePrefix: AUDIT_LOG_RIGHT_PREFIX,
        action: 'open the Audit Logs report',
      });
    }
    for (const screen of namedScreens) {
      await this.assertScreenHistoryRight(userId, screen);
    }
    if (namedScreens.length > 0) {
      return { screenIds: null };
    }
    return { screenIds: await this.viewableScreenIds(userId) };
  }

  private async namedScreens(query: ListAuditLogQueryDto): Promise<NamedAuditScreen[]> {
    const screens: NamedAuditScreen[] = [];
    if (query.screen_id !== undefined) {
      const screen = await this.prisma.auditScreen.findFirst({
        where: { screenId: query.screen_id },
        select: { screenId: true, screenName: true },
      });
      screens.push(screen ?? { screenId: query.screen_id, screenName: null });
    }
    const screenName = query.screen_name?.trim();
    if (screenName && !screens.some((screen) => screen.screenName === screenName)) {
      screens.push({ screenId: null, screenName });
    }
    return screens;
  }

  /** 403 AUDIT_LOG_RIGHT_VIEW unless the caller may read this screen's history. */
  private async assertScreenHistoryRight(
    userId: string | null,
    screen: NamedAuditScreen,
  ): Promise<void> {
    const label = screen.screenName ?? `audit screen ${screen.screenId}`;
    const menuIds = screen.screenName ? auditScreenMenusOf(screen.screenName) : undefined;
    if (menuIds && menuIds.length > 0) {
      // Any one of the menus will do; the first is the one the refusal names.
      if (userId && UUID_PATTERN.test(userId)) {
        for (const menuId of menuIds.slice(1)) {
          if ((await loadRights(this.prisma, userId, menuId)).view) {
            return;
          }
        }
      }
      await assertMenuRight(this.prisma, {
        userId: userId && UUID_PATTERN.test(userId) ? userId : null,
        menuId: menuIds[0],
        right: 'view',
        codePrefix: AUDIT_LOG_RIGHT_PREFIX,
        action: `see the history of ${label}`,
      });
      return;
    }
    if (await this.callerReadsUnmappedScreens(userId)) {
      return;
    }
    const message =
      `This user may not see the history of ${label}: no menu shows it, so only an ` +
      `${AUDIT_UNMAPPED_SCREEN_READERS.join(' or ')} user may`;
    throwForbidden<AuditLogErrorDetail>(message, [
      { field: 'userId', message, code: AuditLogErrorCode.RIGHT_VIEW },
    ]);
  }

  /** The Audit Logs report across screens: the screens the caller may read, by id. */
  private async viewableScreenIds(userId: string | null): Promise<number[]> {
    if (!userId || !UUID_PATTERN.test(userId)) {
      return [];
    }
    const [viewRows, readsUnmapped, screens] = await Promise.all([
      this.prisma.$queryRaw<{ menu_id: number }[]>`
        SELECT um_menu_id AS menu_id
          FROM public.user_menus
         WHERE um_user_id    = ${userId}::uuid
           AND um_can_view   = true
           AND um_is_deleted = false`,
      this.callerReadsUnmappedScreens(userId),
      this.prisma.auditScreen.findMany({ select: { screenId: true, screenName: true } }),
    ]);
    const viewMenus = new Set(viewRows.map((row) => Number(row.menu_id)));
    return screens
      .filter((screen) => {
        const menuIds = auditScreenMenusOf(screen.screenName);
        return menuIds ? menuIds.some((menuId) => viewMenus.has(menuId)) : readsUnmapped;
      })
      .map((screen) => screen.screenId);
  }

  /**
   * ADMIN or SUPER ADMIN, read from user_master (never from the token's claim, so a role
   * taken away stops counting at once). An unknown, inactive or deleted caller is not one.
   */
  private async callerReadsUnmappedScreens(userId: string | null): Promise<boolean> {
    if (!userId || !UUID_PATTERN.test(userId)) {
      return false;
    }
    const user = await this.prisma.userMaster.findFirst({
      where: { usrId: userId, usrIsActive: true, usrIsDeleted: false },
      select: { usrType: true },
    });
    return Boolean(user?.usrType && AUDIT_UNMAPPED_SCREEN_READERS.includes(user.usrType));
  }
}
