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
const APP_THEME_TEMPLATE_TABLE_NAME = 'app theme template';
const APP_THEME_TEMPLATE_AUDIT_SCREEN_NAME = 'App Theme Template';
const PLACEHOLDER_PATTERN = /\{\{([^{}]*)\}\}/g;
const TEMPLATE_KEYS = new Set([
    ...Object.keys(app_theme_types_1.APP_THEME_TOKENS),
    ...app_theme_types_1.APP_THEME_SIZE_KEYS,
]);
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
            template: this.toTemplateRef(await this.activeTemplate(this.prisma)),
        };
    }
    async bootstrap() {
        const [theme, template] = await Promise.all([
            this.prisma.appThemeMaster.findFirst({ where: { thmIsDefault: true, thmIsDeleted: false } }),
            this.activeTemplate(this.prisma),
        ]);
        return {
            tokens: theme ? this.readTokens(theme.thmTokens) : {},
            thmModifiedOn: theme ? (theme.thmModifiedOn ?? theme.thmCreatedOn).toISOString() : null,
            template: this.toTemplateRef(template),
        };
    }
    async template() {
        const record = await this.activeTemplate(this.prisma);
        if (!record) {
            (0, module_service_utils_1.throwSettingsNotFound)('No active app theme template', 'tplId', 'No live, active template exists: migration 20261001140000_app_theme_template seeds one.');
        }
        return this.toTemplatePayload(record);
    }
    async saveTemplate(dto) {
        await this.requireRight('edit', 'edit the app theme template');
        this.validateTemplate(dto.tplQss);
        const actor = this.actor();
        return this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `
        SELECT tpl_id FROM public.app_theme_template WHERE tpl_id = ${dto.tplId} FOR UPDATE`;
            const existing = await tx.appThemeTemplate.findUnique({ where: { tplId: dto.tplId } });
            if (!existing) {
                (0, module_service_utils_1.throwSettingsNotFound)('App theme template not found', 'tplId', `No app theme template found with id ${dto.tplId}`);
            }
            if (existing.tplIsDeleted || !existing.tplIsActive) {
                (0, module_service_utils_1.throwSettingsConflict)('Not the active template', [
                    {
                        field: 'tplId',
                        message: `Template ${existing.tplId} is not the one clients apply; edit the one GET /app-themes/template answers.`,
                    },
                ]);
            }
            const current = this.templateStamp(existing);
            const loaded = new Date(dto.tplModifiedOn).toISOString();
            if (loaded !== current) {
                (0, module_service_utils_1.throwSettingsConflict)('Template changed by someone else', [
                    {
                        field: 'tplModifiedOn',
                        message: `It was saved at ${current}, after the copy you loaded (${loaded}). Reload it and apply your edit again.`,
                    },
                ]);
            }
            const saved = await tx.appThemeTemplate.update({
                where: { tplId: existing.tplId },
                data: {
                    tplQss: dto.tplQss,
                    ...(dto.tplRemarks !== undefined ? { tplRemarks: dto.tplRemarks } : {}),
                    tplModifiedOn: new Date(),
                    tplModifiedBy: actor,
                },
            });
            await this.auditLogService.logEntityChange({
                action: 'update',
                tableName: APP_THEME_TEMPLATE_TABLE_NAME,
                screenName: APP_THEME_TEMPLATE_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: String(saved.tplId),
                displayName: saved.tplName,
                originalRecord: this.toTemplateAuditRecord(existing),
                modifiedRecord: this.toTemplateAuditRecord(saved),
                userId: actor,
                notes: 'App theme template saved',
            }, tx);
            return this.toTemplatePayload(saved);
        });
    }
    validateTemplate(qss) {
        const errors = [];
        const field = 'tplQss';
        const bytes = Buffer.byteLength(qss, 'utf8');
        if (bytes > app_theme_types_1.APP_THEME_TEMPLATE_MAX_BYTES) {
            errors.push({
                field,
                message: `at most ${app_theme_types_1.APP_THEME_TEMPLATE_MAX_BYTES / 1024} KB; this one is ${Math.ceil(bytes / 1024)} KB`,
            });
        }
        const unknown = new Set();
        for (const [, key] of qss.matchAll(PLACEHOLDER_PATTERN)) {
            if (!TEMPLATE_KEYS.has(key)) {
                unknown.add(key);
            }
        }
        for (const key of unknown) {
            errors.push({ field, message: `unknown placeholder {{${key}}}` });
        }
        const blank = (text) => text.replace(/[^\n]/g, ' ');
        let masked = qss;
        const openComment = masked.search(/\/\*(?![\s\S]*?\*\/)/);
        if (openComment >= 0) {
            errors.push({
                field,
                message: `the comment opened on line ${this.lineOf(qss, openComment)} is never closed`,
            });
            masked = masked.slice(0, openComment) + blank(masked.slice(openComment));
        }
        masked = masked
            .replace(/\/\*[\s\S]*?\*\//g, blank)
            .replace(/"[^"\n]*"|'[^'\n]*'/g, blank)
            .replace(PLACEHOLDER_PATTERN, blank);
        const opened = [];
        for (let index = 0; index < masked.length; index += 1) {
            if (masked[index] === '{') {
                opened.push(index);
            }
            else if (masked[index] === '}' && opened.pop() === undefined) {
                errors.push({ field, message: `the } on line ${this.lineOf(qss, index)} closes nothing` });
            }
        }
        for (const index of opened) {
            errors.push({ field, message: `the { on line ${this.lineOf(qss, index)} is never closed` });
        }
        for (const match of masked.matchAll(/url\(/gi)) {
            const start = (match.index ?? 0) + match[0].length;
            const end = qss.indexOf(')', start);
            const target = qss
                .slice(start, end < 0 ? undefined : end)
                .trim()
                .replace(/^["']|["']$/g, '');
            if (!target.startsWith(':/')) {
                errors.push({
                    field,
                    message: `url(${target}) on line ${this.lineOf(qss, start)} is not a :/ resource`,
                });
            }
        }
        if (errors.length) {
            (0, module_service_utils_1.throwSettingsBadRequest)('Invalid template', errors);
        }
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
    activeTemplate(client) {
        return client.appThemeTemplate.findFirst({
            where: { tplIsActive: true, tplIsDeleted: false },
            orderBy: { tplId: 'asc' },
        });
    }
    templateStamp(record) {
        return (record.tplModifiedOn ?? record.tplCreatedOn).toISOString();
    }
    toTemplateRef(record) {
        return record
            ? { tplId: record.tplId, tplQss: record.tplQss, tplModifiedOn: this.templateStamp(record) }
            : null;
    }
    toTemplatePayload(record) {
        const placeholders = [
            ...new Set([...record.tplQss.matchAll(PLACEHOLDER_PATTERN)].map(([, key]) => key)),
        ];
        return {
            tplId: record.tplId,
            tplName: record.tplName,
            tplQss: record.tplQss,
            tplRemarks: record.tplRemarks,
            tplModifiedOn: this.templateStamp(record),
            placeholders,
        };
    }
    toTemplateAuditRecord(record) {
        return {
            tplId: record.tplId,
            tplName: record.tplName,
            tplQss: record.tplQss,
            tplRemarks: record.tplRemarks,
            tplIsActive: record.tplIsActive,
            tplIsDeleted: record.tplIsDeleted,
        };
    }
    lineOf(text, index) {
        return text.slice(0, index).split('\n').length;
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