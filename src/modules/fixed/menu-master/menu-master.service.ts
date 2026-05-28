import { Injectable, NotFoundException } from '@nestjs/common';
import { Menu } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
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
type MenuRecord = BaseMenuFields & {
  userMenus: {
    umId: string;
    umUserId: string;
    umMenuId: number;
    umCanView: boolean;
    umCanCreate: boolean;
    umCanEdit: boolean;
    umCanDelete: boolean;
    umCanPrint: boolean;
    umCanExport: boolean;
    umVisibility: boolean;
    umIsFavourite: boolean;
    umIsPinned: boolean;
    umSortOrder: number;
  }[];
};
@Injectable()
export class MenuMasterService {
  constructor(private readonly prisma: PrismaService) {}
  async get(
    queryDto: GetMenuQueryDto,
  ): Promise<{ items: MenuMasterPayload[]; meta: MenuMasterGetMeta }> {
    const userId = queryDto.userId ?? null;
    const includeChildren = queryDto.includeChildren ?? true;
    const activeOnly = queryDto.activeOnly ?? true;
    const visibleOnly = queryDto.visibleOnly ?? false;
    if (!userId) return this.getAll(queryDto);
    // Confirm the user from the token is active and logged in
    const activeUser = await this.prisma.userMaster.findUnique({
      where: { usrId: userId, usrIsActive: true, usrIsDeleted: false },
      select: { usrId: true },
    });
    if (!activeUser) return this.emptyResult(queryDto, includeChildren, activeOnly, visibleOnly);
    // Use the verified userId to get all umMenuIds assigned to this user
    const userMenuRows = await this.prisma.userMenus.findMany({
      where: { umUserId: activeUser.usrId, umIsDeleted: false },
      select: { umMenuId: true },
    });
    const assignedMenuIds = userMenuRows.map((r) => r.umMenuId);
    if (assignedMenuIds.length === 0) return this.emptyResult(queryDto, includeChildren, activeOnly, visibleOnly);
    // Fetch the menus for those IDs with this user's permission data attached
    const records = await this.prisma.menu.findMany({
      where: {
        menuId: { in: assignedMenuIds },
        ...(activeOnly ? { menuIsActive: true } : {}),
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
        userMenus: {
          where: { umUserId: activeUser.usrId, umIsDeleted: false },
          select: {
            umId: true,
            umUserId: true,
            umMenuId: true,
            umCanView: true,
            umCanCreate: true,
            umCanEdit: true,
            umCanDelete: true,
            umCanPrint: true,
            umCanExport: true,
            umVisibility: true,
            umIsFavourite: true,
            umIsPinned: true,
            umSortOrder: true,
          },
        },
      },
    });
    return this.buildResponse(queryDto, records, includeChildren, activeOnly, visibleOnly, (r, bp) =>
      this.toPayload(r, bp, includeChildren),
    );
  }
  async updateVisibility(
    items: { menuId: number; menuVisibility: boolean }[],
  ): Promise<{ menuId: number; menuVisibility: boolean }[]> {
    const menuIds = items.map((i) => i.menuId);
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
  async getAll(
    queryDto: GetMenuQueryDto,
  ): Promise<{ items: MenuMasterPayload[]; meta: MenuMasterGetMeta }> {
    const includeChildren = queryDto.includeChildren ?? true;
    const activeOnly = queryDto.activeOnly ?? true;
    const visibleOnly = queryDto.visibleOnly ?? false;
    const records = await this.prisma.menu.findMany({
      where: {
        ...(activeOnly ? { menuIsActive: true } : {}),
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
    return this.buildResponse(queryDto, records, includeChildren, activeOnly, visibleOnly, (r, bp) =>
      this.toSimplePayload(r, bp, includeChildren),
    );
  }
  private buildResponse<T extends BaseMenuFields>(
    queryDto: GetMenuQueryDto,
    records: T[],
    includeChildren: boolean,
    activeOnly: boolean,
    visibleOnly: boolean,
    toItem: (record: T, byParent: Map<number | null, T[]>) => MenuMasterPayload,
  ): { items: MenuMasterPayload[]; meta: MenuMasterGetMeta } {
    const recordsById = new Map(records.map((r) => [r.menuId, r]));
    const byParent = this.groupByParent(records);
    const roots = this.getRootRecords(byParent);
    let selected: T[];
    if (queryDto.menuId !== undefined) {
      const menu = recordsById.get(queryDto.menuId);
      if (!menu) {
        throw new NotFoundException(`Menu not found for menuId ${queryDto.menuId}`);
      }
      selected = [menu];
    } else if (queryDto.parentId !== undefined) {
      selected = byParent.get(queryDto.parentId) ?? [];
    } else {
      selected = roots;
    }
    const items = selected.map((record) => toItem(record, byParent));
    return {
      items,
      meta: {
        menuId: queryDto.menuId,
        parentId: queryDto.parentId ?? null,
        includeChildren,
        activeOnly,
        visibleOnly,
        count: items.length,
      },
    };
  }
  private emptyResult(
    queryDto: GetMenuQueryDto,
    includeChildren: boolean,
    activeOnly: boolean,
    visibleOnly: boolean,
  ): { items: MenuMasterPayload[]; meta: MenuMasterGetMeta } {
    return {
      items: [],
      meta: {
        menuId: queryDto.menuId,
        parentId: queryDto.parentId ?? null,
        includeChildren,
        activeOnly,
        visibleOnly,
        count: 0,
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
  private toPermissions(um: MenuRecord['userMenus'][0]): MenuMasterUserPermissions {
    return {
      canCreate: um.umCanCreate,
      canEdit: um.umCanEdit,
      canDelete: um.umCanDelete,
      canPrint: um.umCanPrint,
      canExport: um.umCanExport,
      isVisible: um.umVisibility,
      isFavourite: um.umIsFavourite,
      isPinned: um.umIsPinned,
      sortOrder: um.umSortOrder,
    };
  }
  private toPayload(
    record: MenuRecord,
    byParent: Map<number | null, MenuRecord[]>,
    includeChildren: boolean,
    visited: Set<number> = new Set<number>(),
  ): MenuMasterPayload {
    const um = record.userMenus[0];
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
      permissions: um ? this.toPermissions(um) : null,
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
      this.toPayload(child, byParent, includeChildren, nextVisited),
    );
    return payload;
  }
  private toSimplePayload(
    record: BaseMenuFields,
    byParent: Map<number | null, BaseMenuFields[]>,
    includeChildren: boolean,
    visited: Set<number> = new Set<number>(),
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
      permissions: null,
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
      this.toSimplePayload(child, byParent, includeChildren, nextVisited),
    );
    return payload;
  }
}