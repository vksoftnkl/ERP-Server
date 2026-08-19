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
exports.MenuMasterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
let MenuMasterService = class MenuMasterService {
    prisma;
    requestContextService;
    constructor(prisma, requestContextService) {
        this.prisma = prisma;
        this.requestContextService = requestContextService;
    }
    async get(queryDto) {
        const visibleOnly = queryDto.visibleOnly ?? false;
        const records = await this.prisma.menu.findMany({
            where: {
                menuIsActive: true,
                ...(visibleOnly ? { menuVisibility: true } : {}),
            },
            orderBy: [{ menuParentId: 'asc' }, { menuPosition: 'asc' }, { menuId: 'asc' }],
            select: {
                menuId: true,
                menuParentId: true,
                menuName: true,
                menuAlias: true,
                menuVisibility: true,
                menuPosition: true,
                menuIconLocationDesktop: true,
                menuIconLocationWeb: true,
                menuIconLocationMobile: true,
                menuSeparator: true,
                menuIsActive: true,
            },
        });
        return this.buildResponse(records, visibleOnly, (r, bp) => this.toSimplePayload(r, bp, true));
    }
    async getUserMenu() {
        const userId = this.requestContextService.getUserId();
        if (!userId) {
            throw new common_1.UnauthorizedException('Unable to resolve the current user from the access token');
        }
        const userMenus = await this.prisma.userMenus.findMany({
            where: {
                umUserId: userId,
                umVisibility: true,
                umIsDeleted: false,
                menu: { menuIsActive: true },
            },
            select: {
                umMenuId: true,
                umCanCreate: true,
                umCanEdit: true,
                umCanDelete: true,
                umCanPrint: true,
                umCanExport: true,
                umVisibility: true,
                umIsFavourite: true,
                umIsPinned: true,
                umSortOrder: true,
                menu: {
                    select: {
                        menuId: true,
                        menuParentId: true,
                        menuName: true,
                        menuAlias: true,
                        menuVisibility: true,
                        menuPosition: true,
                        menuIconLocationDesktop: true,
                        menuIconLocationWeb: true,
                        menuIconLocationMobile: true,
                        menuSeparator: true,
                        menuIsActive: true,
                    },
                },
            },
            orderBy: [
                { umSortOrder: 'asc' },
                { menu: { menuPosition: 'asc' } },
                { menu: { menuId: 'asc' } },
            ],
        });
        const records = userMenus.map((userMenu) => userMenu.menu);
        const permissionsByMenuId = new Map(userMenus.map((userMenu) => [
            userMenu.umMenuId,
            {
                canCreate: userMenu.umCanCreate,
                canEdit: userMenu.umCanEdit,
                canDelete: userMenu.umCanDelete,
                canPrint: userMenu.umCanPrint,
                canExport: userMenu.umCanExport,
                isVisible: userMenu.umVisibility,
                isFavourite: userMenu.umIsFavourite,
                isPinned: userMenu.umIsPinned,
                sortOrder: userMenu.umSortOrder,
            },
        ]));
        return this.buildResponse(records, true, (r, bp) => this.toSimplePayload(r, bp, true, undefined, permissionsByMenuId));
    }
    async updateVisibility(items) {
        const menuIds = items.map((i) => i.menuId);
        const existing = await this.prisma.menu.findMany({
            where: { menuId: { in: menuIds } },
            select: { menuId: true, menuIsActive: true },
        });
        const foundIds = new Set(existing.map((r) => r.menuId));
        const missing = menuIds.filter((id) => !foundIds.has(id));
        if (missing.length > 0) {
            throw new common_1.NotFoundException(`Menu(s) not found for menuId(s): ${missing.join(', ')}`);
        }
        const activeById = new Map(existing.map((r) => [r.menuId, r.menuIsActive]));
        const updated = await this.prisma.$transaction(items.map((item) => this.prisma.menu.update({
            where: { menuId: item.menuId },
            data: {
                menuVisibility: item.menuVisibility,
                menuIsActive: activeById.get(item.menuId),
            },
            select: { menuId: true, menuVisibility: true },
        })));
        return updated.map((r) => ({ menuId: r.menuId, menuVisibility: r.menuVisibility }));
    }
    buildResponse(records, visibleOnly, toItem) {
        const byParent = this.groupByParent(records);
        const roots = this.getRootRecords(byParent);
        const items = roots.map((record) => toItem(record, byParent));
        return {
            items,
            meta: {
                visibleOnly,
                count: items.length,
            },
        };
    }
    groupByParent(records) {
        const byParent = new Map();
        for (const record of records) {
            const parentId = record.menuParentId ?? null;
            const existing = byParent.get(parentId);
            if (existing) {
                existing.push(record);
            }
            else {
                byParent.set(parentId, [record]);
            }
        }
        return byParent;
    }
    getRootRecords(byParent) {
        const nullRoots = byParent.get(null) ?? [];
        const zeroRoots = byParent.get(0) ?? [];
        if (zeroRoots.length === 0) {
            return nullRoots;
        }
        const merged = [...nullRoots];
        for (const root of zeroRoots) {
            if (!merged.some((r) => r.menuId === root.menuId)) {
                merged.push(root);
            }
        }
        return merged;
    }
    toSimplePayload(record, byParent, includeChildren, visited = new Set(), permissionsByMenuId) {
        const payload = {
            menuId: record.menuId,
            menuParentId: record.menuParentId,
            menuName: record.menuName,
            menuAlias: record.menuAlias,
            menuVisibility: record.menuVisibility,
            menuPosition: record.menuPosition?.toString() ?? null,
            menuIconLocationDesktop: record.menuIconLocationDesktop,
            menuIconLocationWeb: record.menuIconLocationWeb,
            menuIconLocationMobile: record.menuIconLocationMobile,
            menuSeparator: record.menuSeparator,
            menuIsActive: record.menuIsActive,
            permissions: permissionsByMenuId?.get(record.menuId) ?? null,
        };
        if (!includeChildren || visited.has(record.menuId)) {
            return payload;
        }
        const children = byParent.get(record.menuId) ?? [];
        if (children.length === 0) {
            return payload;
        }
        const nextVisited = new Set(visited);
        nextVisited.add(record.menuId);
        payload.children = children.map((child) => this.toSimplePayload(child, byParent, includeChildren, nextVisited, permissionsByMenuId));
        return payload;
    }
};
exports.MenuMasterService = MenuMasterService;
exports.MenuMasterService = MenuMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService])
], MenuMasterService);
//# sourceMappingURL=menu-master.service.js.map