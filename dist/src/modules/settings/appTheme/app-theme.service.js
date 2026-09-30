"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppThemeService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const rights_1 = require("../../../common/posting/rights");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const app_theme_types_1 = require("./types/app-theme.types");
const APP_THEME_TABLE_NAME = 'app theme master';
const APP_THEME_AUDIT_SCREEN_NAME = 'App Theme Master';
const APP_THEME_MENU = { parent: 60, name: 'App Themes' };
let AppThemeService = class AppThemeService {
    prisma;
    auditLogService;
    requestContext;
    menuId = null;
    constructor(prisma, auditLogService, requestContext) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContext = requestContext;
    }
    async getById(thmId) {
        const record = await this.prisma.appThemeMaster.findUnique({ where: { thmId } });
        if (!record) {
            this.throwNotFound(thmId);
        }
        return this.toPayload(record, await this.usedByCount(this.prisma, thmId));
    }
    async effective(companyId) {
        const company = await this.prisma.company.findFirst({
            where: { compId: companyId, compIsDeleted: false },
            select: { compStylesheetId: true },
        });
        if (!company) {
            (0, module_service_utils_1.throwSettingsNotFound)('Company not found', 'companyId', `No live company found with id ${companyId}`);
        }
        const own = company.compStylesheetId
            ? await this.prisma.appThemeMaster.findFirst({
                where: { thmId: company.compStylesheetId, thmIsActive: true, thmIsDeleted: false },
            })
            : null;
        const theme = own ??
            (await this.prisma.appThemeMaster.findFirst({
                where: { thmIsDefault: true, thmIsDeleted: false },
            }));
        if (!theme) {
            (0, module_service_utils_1.throwSettingsNotFound)('No default app theme', 'thmIsDefault', 'No live theme is marked default. Mark one with POST /app-themes/save.');
        }
        return {
            ...this.toPayload(theme, await this.usedByCount(this.prisma, theme.thmId)),
            resolvedFrom: own ? 'COMPANY' : 'DEFAULT',
        };
    }
    async save(dto) {
        const creating = dto.thmId === undefined;
        await this.requireRight(creating ? 'create' : 'edit', creating ? 'create app themes' : 'edit app themes');
        const tokens = this.validateTokens(dto.tokens);
        const actor = this.actor();
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = creating
                    ? null
                    : await tx.appThemeMaster.findUnique({ where: { thmId: dto.thmId } });
                if (!creating && !existing) {
                    this.throwNotFound(dto.thmId);
                }
                if (existing?.thmIsDeleted) {
                    (0, module_service_utils_1.throwSettingsConflict)('App theme is deleted', [
                        { field: 'thmId', message: `Restore theme ${existing.thmId} before editing it.` },
                    ]);
                }
                const willBeDefault = dto.thmIsDefault ?? existing?.thmIsDefault ?? false;
                const willBeActive = dto.thmIsActive ?? existing?.thmIsActive ?? true;
                if (existing?.thmIsDefault && dto.thmIsDefault === false) {
                    (0, module_service_utils_1.throwSettingsBadRequest)('The default theme stays the default', [
                        {
                            field: 'thmIsDefault',
                            message: 'Every company without a theme of its own is painted in the default. Save ' +
                                'another theme with thmIsDefault = true instead.',
                        },
                    ]);
                }
                if (willBeDefault && !willBeActive) {
                    (0, module_service_utils_1.throwSettingsBadRequest)('The default theme must be active', [
                        { field: 'thmIsActive', message: 'The default theme cannot be inactive.' },
                    ]);
                }
                await this.assertNameIsFree(tx, dto.thmName, existing?.thmId ?? null);
                if (willBeDefault && !existing?.thmIsDefault) {
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
                await this.auditLogService.logEntityChange({
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
                }, tx);
                return this.toPayload(saved, await this.usedByCount(tx, saved.thmId));
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async softDelete(thmId) {
        await this.requireRight('delete', 'delete app themes');
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.appThemeMaster.findUnique({ where: { thmId } });
            if (!existing) {
                this.throwNotFound(thmId);
            }
            if (existing.thmIsDeleted) {
                (0, module_service_utils_1.throwSettingsConflict)('App theme is already deleted', [
                    {
                        field: 'thmId',
                        message: 'Nothing to delete. POST /app-themes/restore brings it back.',
                    },
                ]);
            }
            if (existing.thmIsDefault) {
                (0, module_service_utils_1.throwSettingsConflict)('The default theme cannot be deleted', [
                    { field: 'thmId', message: 'Make another theme the default first.' },
                ]);
            }
            const usedBy = await this.usedByCount(tx, thmId);
            if (usedBy > 0) {
                (0, module_service_utils_1.throwSettingsConflict)('App theme is in use', [
                    {
                        field: 'thmId',
                        message: `In use by ${usedBy} compan${usedBy === 1 ? 'y' : 'ies'}. Point them at another theme first.`,
                    },
                ]);
            }
            return this.setDeleted(tx, existing, true, 'App theme soft deleted');
        });
    }
    async restore(thmId) {
        await this.requireRight('edit', 'restore app themes');
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.appThemeMaster.findUnique({ where: { thmId } });
                if (!existing) {
                    this.throwNotFound(thmId);
                }
                if (!existing.thmIsDeleted) {
                    (0, module_service_utils_1.throwSettingsConflict)('App theme is not deleted', [
                        { field: 'thmId', message: 'Nothing to restore.' },
                    ]);
                }
                await this.assertNameIsFree(tx, existing.thmName, thmId);
                return this.setDeleted(tx, existing, false, 'App theme restored');
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    validateTokens(tokens) {
        const errors = [];
        const clean = {};
        for (const [key, value] of Object.entries(tokens ?? {})) {
            if (!Object.prototype.hasOwnProperty.call(app_theme_types_1.APP_THEME_TOKENS, key)) {
                errors.push({ field: `tokens.${key}`, message: 'unknown token' });
                continue;
            }
            if (typeof value !== 'string' || !app_theme_types_1.APP_THEME_COLOUR_PATTERN.test(value)) {
                errors.push({ field: `tokens.${key}`, message: 'not a colour: #rrggbb or #rrggbbaa' });
                continue;
            }
            clean[key] = value.toUpperCase();
        }
        if (errors.length) {
            (0, module_service_utils_1.throwSettingsBadRequest)('Validation failed', errors);
        }
        return clean;
    }
    async setDeleted(tx, existing, deleted, notes) {
        const actor = this.actor();
        const updated = await tx.appThemeMaster.update({
            where: { thmId: existing.thmId },
            data: { thmIsDeleted: deleted, thmModifiedOn: new Date(), thmModifiedBy: actor },
        });
        await this.auditLogService.logEntityChange({
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
        }, tx);
        return { thmId: existing.thmId, deleted };
    }
    async assertNameIsFree(client, name, excludeThmId) {
        const [clash] = await client.$queryRaw `
      SELECT thm_id AS "thmId" FROM public.app_theme_master
       WHERE thm_is_deleted = false
         AND lower(thm_name) = lower(${name})
         AND (${excludeThmId}::int IS NULL OR thm_id <> ${excludeThmId}::int)
       LIMIT 1`;
        if (clash) {
            (0, module_service_utils_1.throwSettingsConflict)('App theme name already exists', [
                { field: 'thmName', message: `"${name}" is already theme ${clash.thmId}.` },
            ]);
        }
    }
    async usedByCount(client, thmId) {
        return client.company.count({ where: { compStylesheetId: thmId, compIsDeleted: false } });
    }
    async requireRight(right, action) {
        await (0, rights_1.assertMenuRight)(this.prisma, {
            userId: this.requestContext.getUserId(),
            menuId: await this.resolveMenuId(),
            right,
            codePrefix: 'THM',
            action,
        });
    }
    async resolveMenuId() {
        if (this.menuId !== null) {
            return this.menuId;
        }
        const menu = await this.prisma.menu.findFirst({
            where: { menuParentId: APP_THEME_MENU.parent, menuName: APP_THEME_MENU.name },
            select: { menuId: true },
        });
        if (!menu) {
            return 0;
        }
        this.menuId = menu.menuId;
        return menu.menuId;
    }
    actor() {
        return this.requestContext.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
    }
    toPayload(record, usedByCount) {
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
    toAuditRecord(record) {
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
    readTokens(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return {};
        }
        const tokens = {};
        for (const [key, colour] of Object.entries(value)) {
            if (typeof colour === 'string') {
                tokens[key] = colour;
            }
        }
        return tokens;
    }
    throwNotFound(thmId) {
        (0, module_service_utils_1.throwSettingsNotFound)('App theme not found', 'thmId', `No app theme found with id ${thmId}`);
    }
    handleWriteError(error) {
        if ((0, module_service_utils_1.isUniqueConstraintError)(error)) {
            const constraint = (0, module_service_utils_1.violatedConstraintOf)(error) ?? '';
            (0, module_service_utils_1.throwSettingsConflict)(constraint.includes('default')
                ? 'Another theme is already the default'
                : 'App theme name already exists', [
                constraint.includes('default')
                    ? { field: 'thmIsDefault', message: 'Save again: another request moved the default.' }
                    : { field: 'thmName', message: 'A live theme already has this name.' },
            ]);
        }
        const check = (0, module_service_utils_1.violatedCheckOf)(error);
        if (check === 'ck_thm_tokens' || check === 'ck_thm_base') {
            (0, module_service_utils_1.throwSettingsBadRequest)('Validation failed', [
                {
                    field: check === 'ck_thm_tokens' ? 'tokens' : 'thmBase',
                    message: check === 'ck_thm_tokens'
                        ? 'every token must be #rrggbb or #rrggbbaa'
                        : 'thmBase must be LIGHT or DARK',
                },
            ]);
        }
    }
};
exports.AppThemeService = AppThemeService;
exports.AppThemeService = AppThemeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], AppThemeService);
//# sourceMappingURL=app-theme.service.js.map