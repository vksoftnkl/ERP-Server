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
exports.AuditLogAccessService = void 0;
const common_1 = require("@nestjs/common");
const rights_1 = require("../../common/posting/rights");
const request_context_service_1 = require("../../common/request-context/request-context.service");
const module_shared_utils_1 = require("../../common/utils/module-shared.utils");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const audit_screen_menus_constants_1 = require("./audit-screen-menus.constants");
const audit_log_error_codes_1 = require("./types/audit-log-error-codes");
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let AuditLogAccessService = class AuditLogAccessService {
    prisma;
    requestContextService;
    constructor(prisma, requestContextService) {
        this.prisma = prisma;
        this.requestContextService = requestContextService;
    }
    async resolveReadScope(query) {
        const userId = this.requestContextService.getUserId();
        const namedScreens = await this.namedScreens(query);
        const isHistoryButton = namedScreens.length > 0 && Boolean(query.record_pk?.trim());
        if (!isHistoryButton) {
            await (0, rights_1.assertMenuRight)(this.prisma, {
                userId,
                menuId: audit_screen_menus_constants_1.AUDIT_LOGS_MENU_ID,
                right: 'view',
                codePrefix: audit_screen_menus_constants_1.AUDIT_LOG_RIGHT_PREFIX,
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
    async namedScreens(query) {
        const screens = [];
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
    async assertScreenHistoryRight(userId, screen) {
        const label = screen.screenName ?? `audit screen ${screen.screenId}`;
        const menuIds = screen.screenName ? (0, audit_screen_menus_constants_1.auditScreenMenusOf)(screen.screenName) : undefined;
        if (menuIds && menuIds.length > 0) {
            if (userId && UUID_PATTERN.test(userId)) {
                for (const menuId of menuIds.slice(1)) {
                    if ((await (0, rights_1.loadRights)(this.prisma, userId, menuId)).view) {
                        return;
                    }
                }
            }
            await (0, rights_1.assertMenuRight)(this.prisma, {
                userId: userId && UUID_PATTERN.test(userId) ? userId : null,
                menuId: menuIds[0],
                right: 'view',
                codePrefix: audit_screen_menus_constants_1.AUDIT_LOG_RIGHT_PREFIX,
                action: `see the history of ${label}`,
            });
            return;
        }
        if (await this.callerReadsUnmappedScreens(userId)) {
            return;
        }
        const message = `This user may not see the history of ${label}: no menu shows it, so only an ` +
            `${audit_screen_menus_constants_1.AUDIT_UNMAPPED_SCREEN_READERS.join(' or ')} user may`;
        (0, module_shared_utils_1.throwForbidden)(message, [
            { field: 'userId', message, code: audit_log_error_codes_1.AuditLogErrorCode.RIGHT_VIEW },
        ]);
    }
    async viewableScreenIds(userId) {
        if (!userId || !UUID_PATTERN.test(userId)) {
            return [];
        }
        const [viewRows, readsUnmapped, screens] = await Promise.all([
            this.prisma.$queryRaw `
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
            const menuIds = (0, audit_screen_menus_constants_1.auditScreenMenusOf)(screen.screenName);
            return menuIds ? menuIds.some((menuId) => viewMenus.has(menuId)) : readsUnmapped;
        })
            .map((screen) => screen.screenId);
    }
    async callerReadsUnmappedScreens(userId) {
        if (!userId || !UUID_PATTERN.test(userId)) {
            return false;
        }
        const user = await this.prisma.userMaster.findFirst({
            where: { usrId: userId, usrIsActive: true, usrIsDeleted: false },
            select: { usrType: true },
        });
        return Boolean(user?.usrType && audit_screen_menus_constants_1.AUDIT_UNMAPPED_SCREEN_READERS.includes(user.usrType));
    }
};
exports.AuditLogAccessService = AuditLogAccessService;
exports.AuditLogAccessService = AuditLogAccessService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService])
], AuditLogAccessService);
//# sourceMappingURL=audit-log-access.service.js.map