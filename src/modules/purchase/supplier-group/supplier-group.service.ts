import { Injectable } from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { Prisma, SupplierGroup } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListSupplierGroupQueryDto } from './dto/list-supplier-group-query.dto';
import { SaveSupplierGroupDto } from './dto/save-supplier-group.dto';
import {
  SupplierGroupListItem,
  SupplierGroupListMeta,
  SupplierGroupPayload,
} from './types/supplier-group-api.types';
import {
  DEFAULT_ACTOR,
  PurchaseWriteClient,
  applyPresentFields,
  normalizeRequiredText,
  resolveActor,
  throwOnUniqueConstraintError,
  throwPurchaseBadRequest,
  throwPurchaseConflict,
  throwPurchaseNotFound,
} from '../utils/purchase-service.utils';
import { resolvePagination, runConfiguredGridQuery, runPurchaseListQuery } from '../utils/purchase-list.utils';

const SUPPLIER_GROUP_TABLE_NAME = 'supplier groups';
const SUPPLIER_GROUP_AUDIT_SCREEN_NAME = 'Supplier Group Master';
const SUPPLIER_GROUP_OPTIONAL_FIELDS = ['spgAlias', 'spgShort', 'spgDesc', 'spgIsActive'];

type SupplierGroupWriteClient = PurchaseWriteClient;

@Injectable()
export class SupplierGroupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}

  async save(saveSupplierGroupDto: SaveSupplierGroupDto): Promise<SupplierGroupPayload> {
    if (saveSupplierGroupDto.spgId) {
      return this.updateSupplierGroup(saveSupplierGroupDto);
    }
    return this.createSupplierGroup(saveSupplierGroupDto);
  }

  async list(
    queryDto: ListSupplierGroupQueryDto,
  ): Promise<ConfiguredGridListResult<SupplierGroupListItem, SupplierGroupListMeta>> {
    const { page, limit, skip } = resolvePagination(queryDto);
    const hasStructuredFilters = queryDto.spgIsActive !== undefined;
    const where: Prisma.SupplierGroupWhereInput = { spgIsDeleted: false };
    if (queryDto.spgIsActive !== undefined) {
      where.spgIsActive = queryDto.spgIsActive;
    }
    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { spgName: { contains: search, mode: 'insensitive' } },
        { spgAlias: { contains: search, mode: 'insensitive' } },
        { spgShort: { contains: search, mode: 'insensitive' } },
        { spgDesc: { contains: search, mode: 'insensitive' } },
      ];
    }
    return runPurchaseListQuery({ page, limit }, {
      hasStructuredFilters,
      configuredGridFn: () => runConfiguredGridQuery(this.configuredGridSqlService, {
        tableName: SUPPLIER_GROUP_TABLE_NAME,
        alias: 'supplier_group_grid',
        search: queryDto.search,
        page,
        limit,
        skip,
      }),
      countFn: () => this.prisma.supplierGroup.count({ where }),
      findManyFn: () => this.prisma.supplierGroup.findMany({
        where,
        orderBy: [{ spgName: 'asc' }, { spgId: 'asc' }],
        skip,
        take: limit,
      }),
      toItemFn: (record) => this.toPayload(record),
    });
  }

  async getById(spgId: string): Promise<SupplierGroupPayload> {
    const record = await this.prisma.supplierGroup.findFirst({
      where: { spgId, spgIsDeleted: false },
    });
    if (!record) {
      throwPurchaseNotFound('Supplier group not found', 'spgId', `No active supplier group found with id ${spgId}`);
    }
    return this.toPayload(record);
  }

  async softDelete(spgId: string): Promise<{ spgId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.supplierGroup.findFirst({
        where: { spgId, spgIsDeleted: false },
      });
      if (!existing) {
        throwPurchaseNotFound('Supplier group not found', 'spgId', `No active supplier group found with id ${spgId}`);
      }
      const supplierCount = await tx.supplier.count({
        where: { supGroupId: spgId, supIsDeleted: false },
      });
      if (supplierCount > 0) {
        throwPurchaseBadRequest('Cannot delete supplier group with active suppliers', [
          { field: 'spgId', message: `Supplier group ${spgId} is used by ${supplierCount} supplier(s).` },
        ]);
      }
      const modifiedOn = new Date();
      const result = await tx.supplierGroup.updateMany({
        where: { spgId, spgIsDeleted: false },
        data: { spgIsDeleted: true, spgIsActive: false, spgModifiedOn: modifiedOn, spgModifiedBy: DEFAULT_ACTOR },
      });
      if (result.count === 0) {
        throwPurchaseNotFound('Supplier group not found', 'spgId', `No active supplier group found with id ${spgId}`);
      }
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        spgIsDeleted: true,
        spgIsActive: false,
        spgModifiedOn: modifiedOn,
        spgModifiedBy: DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: SUPPLIER_GROUP_TABLE_NAME,
          screenName: SUPPLIER_GROUP_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: spgId,
          displayName: existing.spgName,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'Supplier group soft deleted',
        },
        tx,
      );
      return { spgId, deleted: true };
    });
  }

  private async createSupplierGroup(
    saveSupplierGroupDto: SaveSupplierGroupDto,
  ): Promise<SupplierGroupPayload> {
    const now = new Date();
    const createdBy = resolveActor(saveSupplierGroupDto.spgCreatedBy);
    const modifiedBy = resolveActor(saveSupplierGroupDto.spgModifiedBy, createdBy);
    const normalizedName = normalizeRequiredText(saveSupplierGroupDto.spgName, 'spgName');
    const data: Prisma.SupplierGroupUncheckedCreateInput = {
      spgName: normalizedName,
      spgCreatedOn: now,
      spgCreatedBy: createdBy,
      spgModifiedOn: now,
      spgModifiedBy: modifiedBy,
    };
    applyPresentFields(data, saveSupplierGroupDto, SUPPLIER_GROUP_OPTIONAL_FIELDS);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureNameIsUnique(tx, normalizedName);
        const created = await tx.supplierGroup.create({ data });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: SUPPLIER_GROUP_TABLE_NAME,
            screenName: SUPPLIER_GROUP_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.spgId,
            displayName: payload.spgName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'Supplier group created',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError(error, 'Supplier group name already exists', [
        { field: 'spgName', message: 'Duplicate supplier group name is not allowed' },
      ]);
      throw error;
    }
  }

  private async updateSupplierGroup(
    saveSupplierGroupDto: SaveSupplierGroupDto,
  ): Promise<SupplierGroupPayload> {
    const spgId = saveSupplierGroupDto.spgId!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.supplierGroup.findFirst({
          where: { spgId, spgIsDeleted: false },
        });
        if (!existing) {
          throwPurchaseNotFound('Supplier group not found', 'spgId', `No active supplier group found with id ${spgId}`);
        }
        const normalizedName = normalizeRequiredText(saveSupplierGroupDto.spgName, 'spgName');
        await this.ensureNameIsUnique(tx, normalizedName, spgId);
        const data: Prisma.SupplierGroupUncheckedUpdateInput = {
          spgName: normalizedName,
          spgModifiedOn: new Date(),
          spgModifiedBy: resolveActor(saveSupplierGroupDto.spgModifiedBy),
        };
        applyPresentFields(data, saveSupplierGroupDto, SUPPLIER_GROUP_OPTIONAL_FIELDS);
        const updated = await tx.supplierGroup.update({ where: { spgId }, data });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: SUPPLIER_GROUP_TABLE_NAME,
            screenName: SUPPLIER_GROUP_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: spgId,
            displayName: payload.spgName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.spgModifiedBy,
            notes: 'Supplier group updated',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError(error, 'Supplier group name already exists', [
        { field: 'spgName', message: 'Duplicate supplier group name is not allowed' },
      ]);
      throw error;
    }
  }

  private async ensureNameIsUnique(
    tx: SupplierGroupWriteClient,
    groupName: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await tx.supplierGroup.findFirst({
      where: {
        spgIsDeleted: false,
        spgName: { equals: groupName, mode: 'insensitive' },
        ...(excludeId ? { spgId: { not: excludeId } } : {}),
      },
      select: { spgId: true },
    });
    if (existing) {
      throwPurchaseConflict('Supplier group name already exists', [
        { field: 'spgName', message: 'Duplicate supplier group name is not allowed' },
      ]);
    }
  }

  private toPayload(record: SupplierGroup): SupplierGroupPayload {
    return {
      spgId: record.spgId,
      spgName: record.spgName,
      spgAlias: record.spgAlias,
      spgShort: record.spgShort,
      spgDesc: record.spgDesc,
      spgIsActive: record.spgIsActive,
      spgIsDeleted: record.spgIsDeleted,
      spgSyncDate: record.spgSyncDate ? record.spgSyncDate.toISOString() : null,
      spgCreatedOn: record.spgCreatedOn.toISOString(),
      spgCreatedBy: record.spgCreatedBy,
      spgModifiedOn: record.spgModifiedOn.toISOString(),
      spgModifiedBy: record.spgModifiedBy,
    };
  }
}
