import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountGroup, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListAccountGroupQueryDto } from './dto/list-account-group-query.dto';
import { SaveAccountGroupDto } from './dto/save-account-group.dto';
import {
  AccountGroupErrorDetail,
  AccountGroupErrorResponse,
  AccountGroupListItem,
  AccountGroupListMeta,
  AccountGroupPayload,
} from './types/account-group-api.types';

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const ACCOUNT_GROUP_TABLE_NAME = 'account_groups';
const ACCOUNT_GROUP_AUDIT_SCREEN_NAME = 'Account Group Master';

type AccountGroupWriteClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class AccountsGroupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async save(saveAccountGroupDto: SaveAccountGroupDto): Promise<AccountGroupPayload> {
    if (saveAccountGroupDto.accGroupId) {
      return this.updateAccountGroup(saveAccountGroupDto);
    }

    return this.createAccountGroup(saveAccountGroupDto);
  }

  async list(
    queryDto: ListAccountGroupQueryDto,
  ): Promise<{ items: AccountGroupListItem[]; meta: AccountGroupListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const where: Prisma.AccountGroupWhereInput = {
      accGroupIsDeleted: false,
    };

    if (queryDto.accGroupCompanyId !== undefined) {
      where.accGroupCompanyId = queryDto.accGroupCompanyId;
    }

    if (queryDto.accGroupParentId !== undefined) {
      where.accGroupParentId = queryDto.accGroupParentId;
    }

    if (queryDto.accGroupIsActive !== undefined) {
      where.accGroupIsActive = queryDto.accGroupIsActive;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { accGroupName: { contains: search, mode: 'insensitive' } },
        { accGroupAlias: { contains: search, mode: 'insensitive' } },
        { accGroupShort: { contains: search, mode: 'insensitive' } },
        { accGroupDescription: { contains: search, mode: 'insensitive' } },
        { accGroupTallyName: { contains: search, mode: 'insensitive' } },
        { accGroupPrimaryName: { contains: search, mode: 'insensitive' } },
        { accGroupNature: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.accountGroup.count({ where }),
      this.prisma.accountGroup.findMany({
        where,
        orderBy: [{ accGroupSort: 'asc' }, { accGroupName: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: records.map((record) => this.toPayload(record)),
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async getById(accGroupId: string): Promise<AccountGroupPayload> {
    const record = await this.prisma.accountGroup.findFirst({
      where: {
        accGroupId,
        accGroupIsDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(accGroupId);
    }

    return this.toPayload(record);
  }

  async softDelete(accGroupId: string): Promise<{ accGroupId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.accountGroup.findFirst({
        where: {
          accGroupId,
          accGroupIsDeleted: false,
        },
      });

      if (!existing) {
        this.throwNotFound(accGroupId);
      }

      const hasChildren = await tx.accountGroup.count({
        where: {
          accGroupParentId: accGroupId,
          accGroupIsDeleted: false,
        },
      });
      if (hasChildren > 0) {
        this.throwBadRequest('Cannot delete account group with active children', [
          {
            field: 'accGroupId',
            message: `Account group ${accGroupId} has child groups. Reassign or delete them first.`,
          },
        ]);
      }

      const ledgerCount = await tx.accLedgerMaster.count({
        where: {
          ledGroupId: accGroupId,
          ledIsDeleted: false,
        },
      });
      if (ledgerCount > 0) {
        this.throwBadRequest('Cannot delete account group with active ledgers', [
          {
            field: 'accGroupId',
            message: `Account group ${accGroupId} is used by ${ledgerCount} ledger(s).`,
          },
        ]);
      }

      const ancestorIds = await this.getAncestorIds(tx, existing.accGroupParentId);
      const modifiedOn = new Date();

      const result = await tx.accountGroup.updateMany({
        where: {
          accGroupId,
          accGroupIsDeleted: false,
        },
        data: {
          accGroupIsDeleted: true,
          accGroupIsActive: false,
          accGroupModifiedOn: modifiedOn,
          accGroupModifiedBy: DEFAULT_ACTOR,
        },
      });

      if (result.count === 0) {
        this.throwNotFound(accGroupId);
      }

      await this.removeChildIds(tx, ancestorIds, [accGroupId]);

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        accGroupIsDeleted: true,
        accGroupIsActive: false,
        accGroupModifiedOn: modifiedOn,
        accGroupModifiedBy: DEFAULT_ACTOR,
      });

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: ACCOUNT_GROUP_TABLE_NAME,
          screenName: ACCOUNT_GROUP_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: accGroupId,
          displayName: existing.accGroupName,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'Account group soft deleted',
        },
        tx,
      );

      return {
        accGroupId,
        deleted: true,
      };
    });
  }

  private async createAccountGroup(
    saveAccountGroupDto: SaveAccountGroupDto,
  ): Promise<AccountGroupPayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const normalizedName = this.normalizeRequiredName(saveAccountGroupDto.accGroupName);
        const normalizedTypeCode = this.normalizeTypeCode(saveAccountGroupDto.accGroupTypeCode);

        if (saveAccountGroupDto.accGroupParentId) {
          await this.ensureParentExists(saveAccountGroupDto.accGroupParentId, tx);
        }

        const companyId = this.hasOwnProperty(saveAccountGroupDto, 'accGroupCompanyId')
          ? (saveAccountGroupDto.accGroupCompanyId ?? null)
          : null;
        await this.ensureNameIsUnique(tx, normalizedName, companyId);

        const now = new Date();
        const createdBy = DEFAULT_ACTOR;
        const data: Prisma.AccountGroupUncheckedCreateInput = {
          accGroupName: normalizedName,
          accGroupTypeCode: normalizedTypeCode,
          accGroupChildIds: [],
          accGroupCreatedOn: now,
          accGroupCreatedBy: createdBy,
          accGroupModifiedOn: now,
          accGroupModifiedBy: createdBy,
        };

        this.applyOptionalFields(data, saveAccountGroupDto);

        const created = await tx.accountGroup.create({ data });

        if (created.accGroupParentId) {
          const ancestorIds = await this.getAncestorIds(tx, created.accGroupParentId);
          await this.appendChildIds(tx, ancestorIds, [created.accGroupId]);
        }

        const refreshed = await tx.accountGroup.findFirst({
          where: {
            accGroupId: created.accGroupId,
            accGroupIsDeleted: false,
          },
        });

        const payload = this.toPayload(refreshed ?? created);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: ACCOUNT_GROUP_TABLE_NAME,
            screenName: ACCOUNT_GROUP_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.accGroupId,
            displayName: payload.accGroupName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Account group created',
          },
          tx,
        );

        return payload;
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }

  private async updateAccountGroup(
    saveAccountGroupDto: SaveAccountGroupDto,
  ): Promise<AccountGroupPayload> {
    const accGroupId = saveAccountGroupDto.accGroupId!;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.accountGroup.findFirst({
          where: {
            accGroupId,
            accGroupIsDeleted: false,
          },
        });

        if (!existing) {
          this.throwNotFound(accGroupId);
        }

        const normalizedName = this.normalizeRequiredName(saveAccountGroupDto.accGroupName);
        const normalizedTypeCode = this.normalizeTypeCode(saveAccountGroupDto.accGroupTypeCode);

        if (saveAccountGroupDto.accGroupParentId === accGroupId) {
          this.throwBadRequest('Account group cannot be its own parent', [
            {
              field: 'accGroupParentId',
              message: 'accGroupParentId cannot be same as accGroupId',
            },
          ]);
        }

        if (saveAccountGroupDto.accGroupParentId) {
          await this.ensureParentExists(saveAccountGroupDto.accGroupParentId, tx);
        }

        const hasParentField = this.hasOwnProperty(saveAccountGroupDto, 'accGroupParentId');
        const nextParentId = hasParentField
          ? (saveAccountGroupDto.accGroupParentId ?? null)
          : existing.accGroupParentId;
        const isParentChanged = hasParentField && nextParentId !== existing.accGroupParentId;

        const subtreeIds = isParentChanged ? await this.getActiveSubtreeIds(tx, accGroupId) : [];

        if (isParentChanged && nextParentId && subtreeIds.includes(nextParentId)) {
          this.throwBadRequest('Circular hierarchy is not allowed', [
            {
              field: 'accGroupParentId',
              message: 'Parent cannot be a child of the same account group',
            },
          ]);
        }

        const nextCompanyId = this.hasOwnProperty(saveAccountGroupDto, 'accGroupCompanyId')
          ? (saveAccountGroupDto.accGroupCompanyId ?? null)
          : existing.accGroupCompanyId;
        await this.ensureNameIsUnique(tx, normalizedName, nextCompanyId, accGroupId);

        const oldAncestorIds = isParentChanged
          ? await this.getAncestorIds(tx, existing.accGroupParentId)
          : [];

        const data: Prisma.AccountGroupUncheckedUpdateInput = {
          accGroupName: normalizedName,
          accGroupTypeCode: normalizedTypeCode,
          accGroupModifiedOn: new Date(),
          accGroupModifiedBy: DEFAULT_ACTOR,
        };

        this.applyOptionalFields(data, saveAccountGroupDto);

        const updated = await tx.accountGroup.update({
          where: {
            accGroupId,
          },
          data,
        });

        if (isParentChanged) {
          const newAncestorIds = await this.getAncestorIds(tx, nextParentId);
          await this.removeChildIds(tx, oldAncestorIds, subtreeIds);
          await this.appendChildIds(tx, newAncestorIds, subtreeIds);
        }

        const refreshed = await tx.accountGroup.findFirst({
          where: {
            accGroupId,
            accGroupIsDeleted: false,
          },
        });

        const payload = this.toPayload(refreshed ?? updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: ACCOUNT_GROUP_TABLE_NAME,
            screenName: ACCOUNT_GROUP_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: accGroupId,
            displayName: payload.accGroupName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Account group updated',
          },
          tx,
        );

        return payload;
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }

  private async ensureParentExists(parentId: string, tx: AccountGroupWriteClient): Promise<void> {
    const parent = await tx.accountGroup.findFirst({
      where: {
        accGroupId: parentId,
        accGroupIsDeleted: false,
      },
      select: {
        accGroupId: true,
      },
    });

    if (!parent) {
      this.throwBadRequest('Parent account group does not exist', [
        {
          field: 'accGroupParentId',
          message: `No active account group found with id ${parentId}`,
        },
      ]);
    }
  }

  private async ensureNameIsUnique(
    tx: AccountGroupWriteClient,
    groupName: string,
    companyId: number | null,
    excludeId?: string,
  ): Promise<void> {
    const existing = await tx.accountGroup.findFirst({
      where: {
        accGroupIsDeleted: false,
        accGroupCompanyId: companyId,
        accGroupName: {
          equals: groupName,
          mode: 'insensitive',
        },
        ...(excludeId
          ? {
              accGroupId: {
                not: excludeId,
              },
            }
          : {}),
      },
      select: {
        accGroupId: true,
      },
    });

    if (existing) {
      throw new ConflictException(
        this.buildErrorResponse('Account group name already exists for this company', [
          {
            field: 'accGroupName',
            message: 'Duplicate accGroupName is not allowed for this company',
          },
        ]),
      );
    }
  }

  private applyOptionalFields(
    data: Prisma.AccountGroupUncheckedCreateInput | Prisma.AccountGroupUncheckedUpdateInput,
    saveAccountGroupDto: SaveAccountGroupDto,
  ): void {
    if (this.hasOwnProperty(saveAccountGroupDto, 'accGroupCompanyId')) {
      data.accGroupCompanyId = saveAccountGroupDto.accGroupCompanyId;
    }

    if (this.hasOwnProperty(saveAccountGroupDto, 'accGroupAlias')) {
      data.accGroupAlias = saveAccountGroupDto.accGroupAlias;
    }

    if (this.hasOwnProperty(saveAccountGroupDto, 'accGroupShort')) {
      data.accGroupShort = saveAccountGroupDto.accGroupShort;
    }

    if (this.hasOwnProperty(saveAccountGroupDto, 'accGroupDescription')) {
      data.accGroupDescription = saveAccountGroupDto.accGroupDescription;
    }

    if (this.hasOwnProperty(saveAccountGroupDto, 'accGroupTallyName')) {
      data.accGroupTallyName = saveAccountGroupDto.accGroupTallyName;
    }

    if (this.hasOwnProperty(saveAccountGroupDto, 'accGroupPrimaryName')) {
      data.accGroupPrimaryName = saveAccountGroupDto.accGroupPrimaryName;
    }

    if (this.hasOwnProperty(saveAccountGroupDto, 'accGroupNature')) {
      data.accGroupNature = saveAccountGroupDto.accGroupNature;
    }

    if (this.hasOwnProperty(saveAccountGroupDto, 'accGroupParentId')) {
      data.accGroupParentId = saveAccountGroupDto.accGroupParentId;
    }

    if (this.hasOwnProperty(saveAccountGroupDto, 'accGroupSort')) {
      data.accGroupSort = saveAccountGroupDto.accGroupSort;
    }

    if (this.hasOwnProperty(saveAccountGroupDto, 'accGroupIsDefault')) {
      data.accGroupIsDefault = saveAccountGroupDto.accGroupIsDefault;
    }

    if (this.hasOwnProperty(saveAccountGroupDto, 'accGroupBehaveAsSubledger')) {
      data.accGroupBehaveAsSubledger = saveAccountGroupDto.accGroupBehaveAsSubledger;
    }

    if (this.hasOwnProperty(saveAccountGroupDto, 'accGroupNetDebitCredit')) {
      data.accGroupNetDebitCredit = saveAccountGroupDto.accGroupNetDebitCredit;
    }

    if (this.hasOwnProperty(saveAccountGroupDto, 'accGroupUsedForCalculation')) {
      data.accGroupUsedForCalculation = saveAccountGroupDto.accGroupUsedForCalculation;
    }

    if (this.hasOwnProperty(saveAccountGroupDto, 'accGroupAffectsGrossProfit')) {
      data.accGroupAffectsGrossProfit = saveAccountGroupDto.accGroupAffectsGrossProfit;
    }

    if (this.hasOwnProperty(saveAccountGroupDto, 'accGroupIsActive')) {
      data.accGroupIsActive = saveAccountGroupDto.accGroupIsActive;
    }
  }

  private async getAncestorIds(
    tx: AccountGroupWriteClient,
    startParentId: string | null | undefined,
  ): Promise<string[]> {
    const ancestorIds: string[] = [];
    const visited = new Set<string>();
    let currentParentId = startParentId;

    while (currentParentId) {
      if (visited.has(currentParentId)) {
        break;
      }
      visited.add(currentParentId);

      const parent = await tx.accountGroup.findFirst({
        where: {
          accGroupId: currentParentId,
          accGroupIsDeleted: false,
        },
        select: {
          accGroupId: true,
          accGroupParentId: true,
        },
      });

      if (!parent) {
        break;
      }

      ancestorIds.push(parent.accGroupId);
      currentParentId = parent.accGroupParentId;
    }

    return ancestorIds;
  }

  private async getActiveSubtreeIds(
    tx: AccountGroupWriteClient,
    rootId: string,
  ): Promise<string[]> {
    const subtreeIds: string[] = [];
    const visited = new Set<string>();
    const queue: string[] = [rootId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) {
        continue;
      }
      visited.add(currentId);

      const node = await tx.accountGroup.findFirst({
        where: {
          accGroupId: currentId,
          accGroupIsDeleted: false,
        },
        select: {
          accGroupId: true,
        },
      });

      if (!node) {
        continue;
      }

      subtreeIds.push(node.accGroupId);

      const children = await tx.accountGroup.findMany({
        where: {
          accGroupParentId: node.accGroupId,
          accGroupIsDeleted: false,
        },
        select: {
          accGroupId: true,
        },
      });

      for (const child of children) {
        if (!visited.has(child.accGroupId)) {
          queue.push(child.accGroupId);
        }
      }
    }

    return subtreeIds;
  }

  private async appendChildIds(
    tx: AccountGroupWriteClient,
    targetIds: string[],
    idsToAdd: string[],
  ): Promise<void> {
    const normalizedTargetIds = this.toUniqueIds(targetIds);
    const normalizedIdsToAdd = this.toUniqueIds(idsToAdd);
    if (normalizedTargetIds.length === 0 || normalizedIdsToAdd.length === 0) {
      return;
    }

    const records = await tx.accountGroup.findMany({
      where: {
        accGroupId: {
          in: normalizedTargetIds,
        },
        accGroupIsDeleted: false,
      },
      select: {
        accGroupId: true,
        accGroupChildIds: true,
      },
    });

    for (const record of records) {
      const nextChildIds = this.mergeChildIds(record.accGroupChildIds, normalizedIdsToAdd);
      if (this.areSameIds(record.accGroupChildIds, nextChildIds)) {
        continue;
      }

      await tx.accountGroup.update({
        where: {
          accGroupId: record.accGroupId,
        },
        data: {
          accGroupChildIds: nextChildIds,
        },
      });
    }
  }

  private async removeChildIds(
    tx: AccountGroupWriteClient,
    targetIds: string[],
    idsToRemove: string[],
  ): Promise<void> {
    const normalizedTargetIds = this.toUniqueIds(targetIds);
    const normalizedIdsToRemove = this.toUniqueIds(idsToRemove);
    if (normalizedTargetIds.length === 0 || normalizedIdsToRemove.length === 0) {
      return;
    }

    const records = await tx.accountGroup.findMany({
      where: {
        accGroupId: {
          in: normalizedTargetIds,
        },
        accGroupIsDeleted: false,
      },
      select: {
        accGroupId: true,
        accGroupChildIds: true,
      },
    });

    for (const record of records) {
      const nextChildIds = this.excludeChildIds(record.accGroupChildIds, normalizedIdsToRemove);
      if (this.areSameIds(record.accGroupChildIds, nextChildIds)) {
        continue;
      }

      await tx.accountGroup.update({
        where: {
          accGroupId: record.accGroupId,
        },
        data: {
          accGroupChildIds: nextChildIds,
        },
      });
    }
  }

  private mergeChildIds(existingIds: readonly string[], idsToAdd: readonly string[]): string[] {
    return this.toUniqueIds([...existingIds, ...idsToAdd]);
  }

  private excludeChildIds(
    existingIds: readonly string[],
    idsToRemove: readonly string[],
  ): string[] {
    const removeSet = new Set(idsToRemove);
    return existingIds.filter((id) => !removeSet.has(id));
  }

  private toUniqueIds(ids: readonly string[]): string[] {
    const uniqueIds: string[] = [];
    const seen = new Set<string>();
    for (const id of ids) {
      if (!seen.has(id)) {
        seen.add(id);
        uniqueIds.push(id);
      }
    }
    return uniqueIds;
  }

  private areSameIds(left: readonly string[], right: readonly string[]): boolean {
    if (left.length !== right.length) {
      return false;
    }

    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) {
        return false;
      }
    }

    return true;
  }

  private normalizeRequiredName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'accGroupName',
          message: 'accGroupName must not be empty',
        },
      ]);
    }

    return trimmed;
  }

  private normalizeTypeCode(typeCode: string): string {
    const normalized = typeCode.trim().toUpperCase();
    if (normalized.length !== 2) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'accGroupTypeCode',
          message: 'accGroupTypeCode must be exactly 2 characters',
        },
      ]);
    }

    return normalized;
  }

  private toPayload(record: AccountGroup): AccountGroupPayload {
    return {
      accGroupId: record.accGroupId,
      accGroupCompanyId: record.accGroupCompanyId,
      accGroupName: record.accGroupName,
      accGroupAlias: record.accGroupAlias,
      accGroupShort: record.accGroupShort,
      accGroupDescription: record.accGroupDescription,
      accGroupTallyName: record.accGroupTallyName,
      accGroupPrimaryName: record.accGroupPrimaryName,
      accGroupNature: record.accGroupNature,
      accGroupParentId: record.accGroupParentId,
      accGroupSort: record.accGroupSort,
      accGroupChildIds: record.accGroupChildIds,
      accGroupTypeCode: record.accGroupTypeCode,
      accGroupIsDefault: record.accGroupIsDefault,
      accGroupBehaveAsSubledger: record.accGroupBehaveAsSubledger,
      accGroupNetDebitCredit: record.accGroupNetDebitCredit,
      accGroupUsedForCalculation: record.accGroupUsedForCalculation,
      accGroupAffectsGrossProfit: record.accGroupAffectsGrossProfit,
      accGroupIsActive: record.accGroupIsActive,
      accGroupIsDeleted: record.accGroupIsDeleted,
      accGroupSyncDate: record.accGroupSyncDate ? record.accGroupSyncDate.toISOString() : null,
      accGroupCreatedOn: record.accGroupCreatedOn.toISOString(),
      accGroupCreatedBy: record.accGroupCreatedBy,
      accGroupModifiedOn: record.accGroupModifiedOn.toISOString(),
      accGroupModifiedBy: record.accGroupModifiedBy,
    };
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Account group already exists', [
          {
            field: 'accGroupName',
            message: 'Duplicate accGroupName is not allowed',
          },
        ]),
      );
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }

    return (error as { code?: string }).code === 'P2002';
  }

  private throwNotFound(accGroupId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Account group not found', [
        {
          field: 'accGroupId',
          message: `No active account group found with id ${accGroupId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: AccountGroupErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: AccountGroupErrorDetail[] = [],
  ): AccountGroupErrorResponse {
    return {
      success: false,
      message,
      errors,
    };
  }

  private hasOwnProperty<T extends object>(obj: T, key: PropertyKey): boolean {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }
}
