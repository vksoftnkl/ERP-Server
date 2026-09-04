import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Menu } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { GetMenuQueryDto } from './dto/get-menu-query.dto';
import {
  MenuMasterGetMeta,
  MenuMasterPayload,
  MenuMasterUserPermissions,
} from './types/menu-master-api.types';
type BaseMenuFields = Pick<
  Menu,
  | 'menuId'
  | 'menuParentId'
  | 'menuName'
  | 'menuAlias'
  | 'menuVisibility'
  | 'menuPosition'
  | 'menuIconLocationDesktop'
  | 'menuIconLocationWeb'
  | 'menuIconLocationMobile'
  | 'menuSeparator'
  | 'menuIsActive'
>;
@Injectable()
export class MenuMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async get(
    queryDto: GetMenuQueryDto,
  ): Promise<{ items: MenuMasterPayload[]; meta: MenuMasterGetMeta }> {
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
  async getUserMenu(): Promise<{ items: MenuMasterPayload[]; meta: MenuMasterGetMeta }> {
    const userId = this.requestContextService.getUserId();
    if (!userId) {
      throw new UnauthorizedException('Unable to resolve the current user from the access token');
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
    const permissionsByMenuId = new Map<number, MenuMasterUserPermissions>(
      userMenus.map((userMenu) => [
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
      ]),
    );
    return this.buildResponse(records, true, (r, bp) =>
      this.toSimplePayload(r, bp, true, undefined, permissionsByMenuId),
    );
  }
  async updateVisibility(
    items: { menuId: number; menuVisibility: boolean }[],
  ): Promise<{ menuId: number; menuVisibility: boolean }[]> {
    const menuIds = items.map((i) => i.menuId);
    // Global visibility: update menuVisibility on the menu table
    const existing = await this.prisma.menu.findMany({
      where: { menuId: { in: menuIds } },
      select: { menuId: true, menuIsActive: true },
    });
    const foundIds = new Set(existing.map((r) => r.menuId));
    const missing = menuIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new NotFoundException(`Menu(s) not found for menuId(s): ${missing.join(', ')}`);
    }
    // Pin menuIsActive to its current value so any DB trigger cannot flip it
    // when menuVisibility is set to false.
    const activeById = new Map(existing.map((r) => [r.menuId, r.menuIsActive]));
    const updated = await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.menu.update({
          where: { menuId: item.menuId },
          data: {
            menuVisibility: item.menuVisibility,
            menuIsActive: activeById.get(item.menuId),
          },
          select: { menuId: true, menuVisibility: true },
        }),
      ),
    );
    return updated.map((r) => ({ menuId: r.menuId, menuVisibility: r.menuVisibility }));
  }
  private buildResponse<T extends BaseMenuFields>(
    records: T[],
    visibleOnly: boolean,
    toItem: (record: T, byParent: Map<number | null, T[]>) => MenuMasterPayload,
  ): { items: MenuMasterPayload[]; meta: MenuMasterGetMeta } {
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
  private groupByParent<T extends BaseMenuFields>(records: T[]): Map<number | null, T[]> {
    const byParent = new Map<number | null, T[]>();
    for (const record of records) {
      const parentId = record.menuParentId ?? null;
      const existing = byParent.get(parentId);
      if (existing) {
        existing.push(record);
      } else {
        byParent.set(parentId, [record]);
      }
    }
    return byParent;
  }
  private getRootRecords<T extends BaseMenuFields>(byParent: Map<number | null, T[]>): T[] {
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
  private toSimplePayload(
    record: BaseMenuFields,
    byParent: Map<number | null, BaseMenuFields[]>,
    includeChildren: boolean,
    visited: Set<number> = new Set<number>(),
    permissionsByMenuId?: Map<number, MenuMasterUserPermissions>,
  ): MenuMasterPayload {
    const payload: MenuMasterPayload = {
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
    payload.children = children.map((child) =>
      this.toSimplePayload(child, byParent, includeChildren, nextVisited, permissionsByMenuId),
    );
    return payload;
  }
}