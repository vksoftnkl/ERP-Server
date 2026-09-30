import { Injectable } from '@nestjs/common';
import { AppThemeMaster, Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { assertMenuRight, type MenuRight } from 'src/common/posting/rights';
import {
  DEFAULT_ACTOR,
  isUniqueConstraintError,
  throwSettingsBadRequest,
  throwSettingsConflict,
  throwSettingsNotFound,
  violatedCheckOf,
  violatedConstraintOf,
} from 'src/common/utils/module-service.utils';
import { SaveAppThemeDto } from './dto/save-app-theme.dto';
import {
  APP_THEME_COLOUR_PATTERN,
  APP_THEME_TOKENS,
  type AppThemeDeleteResult,
  type AppThemeEffectivePayload,
  type AppThemeErrorDetail,
  type AppThemePayload,
} from './types/app-theme.types';

const APP_THEME_TABLE_NAME = 'app theme master';
const APP_THEME_AUDIT_SCREEN_NAME = 'App Theme Master';
/**
 * The menu whose `user_menus` row gates the writes (plan §2.5). Found by name
 * under Configuration (60), not pinned: the migration draws its id from the
 * sequence, so it is 266 on 192.168.0.106 and something else on the live box.
 */
const APP_THEME_MENU = { parent: 60, name: 'App Themes' } as const;

/**
 * Company themes (theme/plan-app-theme.md §3): named colour VALUES a client
 * fills its own stylesheet template from — never CSS.
 *
 *   /get        one theme, any logged-in user
 *   /effective  the theme a company is painted in — its own if live, else the
 *               default — called by both clients at login and on every
 *               company switch
 *   /save       create / update, gated on the App Themes menu's create / edit
 *   /delete     soft delete, 409 while a company uses it or it is the default
 *   /restore    undo a delete
 *
 * The default is never absent while the table has a live row: it can be MOVED
 * (another theme saved with thmIsDefault) but not un-set, deactivated or
 * deleted, because every company with no theme of its own is painted in it.
 */
@Injectable()
export class AppThemeService {
  private menuId: number | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContext: RequestContextService,
  ) {}

  /** One theme, deleted or not — the screen's Restore needs the deleted ones. */
  async getById(thmId: number): Promise<AppThemePayload> {
    const record = await this.prisma.appThemeMaster.findUnique({ where: { thmId } });
    if (!record) {
      this.throwNotFound(thmId);
    }
    return this.toPayload(record, await this.usedByCount(this.prisma, thmId));
  }

  /**
   * The theme a company is painted in: its comp_stylesheet_id when that row is
   * active and not deleted, else the default. 404 only for an unknown company
   * or when the table has no live default at all (a seed defect).
   */
  async effective(companyId: string): Promise<AppThemeEffectivePayload> {
    const company = await this.prisma.company.findFirst({
      where: { compId: companyId, compIsDeleted: false },
      select: { compStylesheetId: true },
    });
    if (!company) {
      throwSettingsNotFound<AppThemeErrorDetail>(
        'Company not found',
        'companyId',
        `No live company found with id ${companyId}`,
      );
    }
    const own = company.compStylesheetId
      ? await this.prisma.appThemeMaster.findFirst({
          where: { thmId: company.compStylesheetId, thmIsActive: true, thmIsDeleted: false },
        })
      : null;
    const theme =
      own ??
      (await this.prisma.appThemeMaster.findFirst({
        where: { thmIsDefault: true, thmIsDeleted: false },
      }));
    if (!theme) {
      throwSettingsNotFound<AppThemeErrorDetail>(
        'No default app theme',
        'thmIsDefault',
        'No live theme is marked default. Mark one with POST /app-themes/save.',
      );
    }
    return {
      ...this.toPayload(theme, await this.usedByCount(this.prisma, theme.thmId)),
      resolvedFrom: own ? 'COMPANY' : 'DEFAULT',
    };
  }

  /**
   * Create (no thmId) or update. `tokens` replaces the stored object; every key
   * must be a v1 token and every value a colour — checked here, field by field,
   * before ck_thm_tokens could refuse the row whole.
   */
  async save(dto: SaveAppThemeDto): Promise<AppThemePayload> {
    const creating = dto.thmId === undefined;
    await this.requireRight(
      creating ? 'create' : 'edit',
      creating ? 'create app themes' : 'edit app themes',
    );
    const tokens = this.validateTokens(dto.tokens);
    const actor = this.actor();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = creating
          ? null
          : await tx.appThemeMaster.findUnique({ where: { thmId: dto.thmId } });
        if (!creating && !existing) {
          this.throwNotFound(dto.thmId!);
        }
        if (existing?.thmIsDeleted) {
          throwSettingsConflict<AppThemeErrorDetail>('App theme is deleted', [
            { field: 'thmId', message: `Restore theme ${existing.thmId} before editing it.` },
          ]);
        }
        const willBeDefault = dto.thmIsDefault ?? existing?.thmIsDefault ?? false;
        const willBeActive = dto.thmIsActive ?? existing?.thmIsActive ?? true;
        if (existing?.thmIsDefault && dto.thmIsDefault === false) {
          throwSettingsBadRequest<AppThemeErrorDetail>('The default theme stays the default', [
            {
              field: 'thmIsDefault',
              message:
                'Every company without a theme of its own is painted in the default. Save ' +
                'another theme with thmIsDefault = true instead.',
            },
          ]);
        }
        if (willBeDefault && !willBeActive) {
          throwSettingsBadRequest<AppThemeErrorDetail>('The default theme must be active', [
            { field: 'thmIsActive', message: 'The default theme cannot be inactive.' },
          ]);
        }
        await this.assertNameIsFree(tx, dto.thmName, existing?.thmId ?? null);
        if (willBeDefault && !existing?.thmIsDefault) {
          // ux_thm_default allows one live default: the old one lets go first.
          await tx.appThemeMaster.updateMany({
            where: { thmIsDefault: true, thmIsDeleted: false },
            data: { thmIsDefault: false, thmModifiedOn: new Date(), thmModifiedBy: actor },
          });
        }
        const data = {
          thmName: dto.thmName,
          thmBase: dto.thmBase,
          thmTokens: tokens,
          thmIsDefault: willBeDefault,
          thmIsActive: willBeActive,
          ...(dto.thmRemarks !== undefined ? { thmRemarks: dto.thmRemarks } : {}),
        };
        const saved = existing
          ? await tx.appThemeMaster.update({
              where: { thmId: existing.thmId },
              data: { ...data, thmModifiedOn: new Date(), thmModifiedBy: actor },
            })
          : await tx.appThemeMaster.create({
              data: { ...data, thmCreatedBy: actor },
            });
        await this.auditLogService.logEntityChange(
          {
            action: existing ? 'update' : 'New',
            tableName: APP_THEME_TABLE_NAME,
            screenName: APP_THEME_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: String(saved.thmId),
            displayName: saved.thmName,
            originalRecord: existing ? this.toAuditRecord(existing) : null,
            modifiedRecord: this.toAuditRecord(saved),
            userId: actor,
            notes: existing ? 'App theme updated' : 'App theme created',
          },
          tx,
        );
        return this.toPayload(saved, await this.usedByCount(tx, saved.thmId));
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }

  /**
   * Soft delete. 409 when it is already deleted, when it is the default, or
   * while a live company uses it — the FK's SET NULL never fires because rows
   * are never hard-deleted, so the guard is here.
   */
  async softDelete(thmId: number): Promise<AppThemeDeleteResult> {
    await this.requireRight('delete', 'delete app themes');
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.appThemeMaster.findUnique({ where: { thmId } });
      if (!existing) {
        this.throwNotFound(thmId);
      }
      if (existing.thmIsDeleted) {
        throwSettingsConflict<AppThemeErrorDetail>('App theme is already deleted', [
          {
            field: 'thmId',
            message: 'Nothing to delete. POST /app-themes/restore brings it back.',
          },
        ]);
      }
      if (existing.thmIsDefault) {
        throwSettingsConflict<AppThemeErrorDetail>('The default theme cannot be deleted', [
          { field: 'thmId', message: 'Make another theme the default first.' },
        ]);
      }
      const usedBy = await this.usedByCount(tx, thmId);
      if (usedBy > 0) {
        throwSettingsConflict<AppThemeErrorDetail>('App theme is in use', [
          {
            field: 'thmId',
            message: `In use by ${usedBy} compan${usedBy === 1 ? 'y' : 'ies'}. Point them at another theme first.`,
          },
        ]);
      }
      return this.setDeleted(tx, existing, true, 'App theme soft deleted');
    });
  }

  /** Undo a delete. 409 when it is not deleted, or a live theme now has its name. */
  async restore(thmId: number): Promise<AppThemeDeleteResult> {
    await this.requireRight('edit', 'restore app themes');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.appThemeMaster.findUnique({ where: { thmId } });
        if (!existing) {
          this.throwNotFound(thmId);
        }
        if (!existing.thmIsDeleted) {
          throwSettingsConflict<AppThemeErrorDetail>('App theme is not deleted', [
            { field: 'thmId', message: 'Nothing to restore.' },
          ]);
        }
        await this.assertNameIsFree(tx, existing.thmName, thmId);
        return this.setDeleted(tx, existing, false, 'App theme restored');
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }

  /**
   * 400 per offending key, all at once: an unknown key, or a value that is
   * not #rrggbb / #rrggbbaa. Keys may be omitted, never null.
   */
  validateTokens(tokens: Record<string, unknown>): Record<string, string> {
    const errors: AppThemeErrorDetail[] = [];
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(tokens ?? {})) {
      if (!Object.prototype.hasOwnProperty.call(APP_THEME_TOKENS, key)) {
        errors.push({ field: `tokens.${key}`, message: 'unknown token' });
        continue;
      }
      if (typeof value !== 'string' || !APP_THEME_COLOUR_PATTERN.test(value)) {
        errors.push({ field: `tokens.${key}`, message: 'not a colour: #rrggbb or #rrggbbaa' });
        continue;
      }
      clean[key] = value.toUpperCase();
    }
    if (errors.length) {
      throwSettingsBadRequest<AppThemeErrorDetail>('Validation failed', errors);
    }
    return clean;
  }

  private async setDeleted(
    tx: Prisma.TransactionClient,
    existing: AppThemeMaster,
    deleted: boolean,
    notes: string,
  ): Promise<AppThemeDeleteResult> {
    const actor = this.actor();
    const updated = await tx.appThemeMaster.update({
      where: { thmId: existing.thmId },
      data: { thmIsDeleted: deleted, thmModifiedOn: new Date(), thmModifiedBy: actor },
    });
    await this.auditLogService.logEntityChange(
      {
        action: deleted ? 'cancel' : 'update',
        tableName: APP_THEME_TABLE_NAME,
        screenName: APP_THEME_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: String(existing.thmId),
        displayName: existing.thmName,
        originalRecord: this.toAuditRecord(existing),
        modifiedRecord: this.toAuditRecord(updated),
        userId: actor,
        notes,
      },
      tx,
    );
    return { thmId: existing.thmId, deleted };
  }

  /** lower() = lower() among live rows — what ux_thm_name enforces. */
  private async assertNameIsFree(
    client: Pick<Prisma.TransactionClient, '$queryRaw'>,
    name: string,
    excludeThmId: number | null,
  ): Promise<void> {
    const [clash] = await client.$queryRaw<Array<{ thmId: number }>>`
      SELECT thm_id AS "thmId" FROM public.app_theme_master
       WHERE thm_is_deleted = false
         AND lower(thm_name) = lower(${name})
         AND (${excludeThmId}::int IS NULL OR thm_id <> ${excludeThmId}::int)
       LIMIT 1`;
    if (clash) {
      throwSettingsConflict<AppThemeErrorDetail>('App theme name already exists', [
        { field: 'thmName', message: `"${name}" is already theme ${clash.thmId}.` },
      ]);
    }
  }

  private async usedByCount(
    client: Pick<Prisma.TransactionClient, 'company'>,
    thmId: number,
  ): Promise<number> {
    return client.company.count({ where: { compStylesheetId: thmId, compIsDeleted: false } });
  }

  /** The App Themes menu's `user_menus` row decides. No row, no rights. */
  private async requireRight(right: MenuRight, action: string): Promise<void> {
    await assertMenuRight(this.prisma, {
      userId: this.requestContext.getUserId(),
      menuId: await this.resolveMenuId(),
      right,
      codePrefix: 'THM',
      action,
    });
  }

  private async resolveMenuId(): Promise<number> {
    if (this.menuId !== null) {
      return this.menuId;
    }
    const menu = await this.prisma.menu.findFirst({
      where: { menuParentId: APP_THEME_MENU.parent, menuName: APP_THEME_MENU.name },
      select: { menuId: true },
    });
    if (!menu) {
      // No menu row means nobody can hold the right: 0 matches no grant. Not
      // cached, so the row is found once a migration adds it.
      return 0;
    }
    this.menuId = menu.menuId;
    return menu.menuId;
  }

  private actor(): string {
    return this.requestContext.getUserId() ?? DEFAULT_ACTOR;
  }

  private toPayload(record: AppThemeMaster, usedByCount: number): AppThemePayload {
    return {
      thmId: record.thmId,
      thmName: record.thmName,
      thmBase: record.thmBase,
      thmIsDefault: record.thmIsDefault,
      thmIsActive: record.thmIsActive,
      thmIsDeleted: record.thmIsDeleted,
      thmRemarks: record.thmRemarks,
      tokens: this.readTokens(record.thmTokens),
      usedByCount,
      thmModifiedOn: (record.thmModifiedOn ?? record.thmCreatedOn).toISOString(),
    };
  }

  /** The audit screen reads thm_* names; `tokens` alone would match nothing. */
  private toAuditRecord(record: AppThemeMaster): Record<string, unknown> {
    return {
      thmId: record.thmId,
      thmName: record.thmName,
      thmBase: record.thmBase,
      thmTokens: record.thmTokens,
      thmIsDefault: record.thmIsDefault,
      thmIsActive: record.thmIsActive,
      thmIsDeleted: record.thmIsDeleted,
      thmRemarks: record.thmRemarks,
    };
  }

  private readTokens(value: Prisma.JsonValue): Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    const tokens: Record<string, string> = {};
    for (const [key, colour] of Object.entries(value)) {
      if (typeof colour === 'string') {
        tokens[key] = colour;
      }
    }
    return tokens;
  }

  private throwNotFound(thmId: number): never {
    throwSettingsNotFound<AppThemeErrorDetail>(
      'App theme not found',
      'thmId',
      `No app theme found with id ${thmId}`,
    );
  }

  private handleWriteError(error: unknown): void {
    if (isUniqueConstraintError(error)) {
      const constraint = violatedConstraintOf(error) ?? '';
      throwSettingsConflict<AppThemeErrorDetail>(
        constraint.includes('default')
          ? 'Another theme is already the default'
          : 'App theme name already exists',
        [
          constraint.includes('default')
            ? { field: 'thmIsDefault', message: 'Save again: another request moved the default.' }
            : { field: 'thmName', message: 'A live theme already has this name.' },
        ],
      );
    }
    const check = violatedCheckOf(error);
    if (check === 'ck_thm_tokens' || check === 'ck_thm_base') {
      throwSettingsBadRequest<AppThemeErrorDetail>('Validation failed', [
        {
          field: check === 'ck_thm_tokens' ? 'tokens' : 'thmBase',
          message:
            check === 'ck_thm_tokens'
              ? 'every token must be #rrggbb or #rrggbbaa'
              : 'thmBase must be LIGHT or DARK',
        },
      ]);
    }
  }
}
