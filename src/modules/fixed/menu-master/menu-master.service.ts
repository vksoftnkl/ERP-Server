import { Injectable, NotFoundException } from '@nestjs/common';
import { Menu, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { GetMenuQueryDto } from './dto/get-menu-query.dto';
import { MenuMasterGetMeta, MenuMasterPayload } from './types/menu-master-api.types';

type MenuRecord = Pick<
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
  constructor(private readonly prisma: PrismaService) {}

  async get(
    queryDto: GetMenuQueryDto,
  ): Promise<{ items: MenuMasterPayload[]; meta: MenuMasterGetMeta }> {
    const includeChildren = queryDto.includeChildren ?? true;
    const activeOnly = queryDto.activeOnly ?? true;
    const visibleOnly = queryDto.visibleOnly ?? true;

    const where: Prisma.MenuWhereInput = {};
    if (activeOnly) {
      where.menuIsActive = true;
    }
    if (visibleOnly) {
      where.menuVisibility = true;
    }

    const records = await this.prisma.menu.findMany({
      where,
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

    const recordsById = new Map(records.map((record) => [record.menuId, record]));
    const byParent = this.groupByParent(records);
    const roots = this.getRootRecords(byParent);

    let selected: MenuRecord[];
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

    const items = selected.map((record) => this.toPayload(record, byParent, includeChildren));

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

  private groupByParent(records: MenuRecord[]): Map<number | null, MenuRecord[]> {
    const byParent = new Map<number | null, MenuRecord[]>();

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

  private getRootRecords(byParent: Map<number | null, MenuRecord[]>): MenuRecord[] {
    const nullRoots = byParent.get(null) ?? [];
    const zeroRoots = byParent.get(0) ?? [];

    if (zeroRoots.length === 0) {
      return nullRoots;
    }

    const merged = [...nullRoots];
    for (const root of zeroRoots) {
      if (!merged.some((existing) => existing.menuId === root.menuId)) {
        merged.push(root);
      }
    }
    return merged;
  }

  private toPayload(
    record: MenuRecord,
    byParent: Map<number | null, MenuRecord[]>,
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
}

