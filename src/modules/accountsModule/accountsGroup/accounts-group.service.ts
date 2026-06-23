import { Injectable } from '@nestjs/common';
import { AccountGroup, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveAccountGroupDto } from './dto/save-account-group.dto';
import { AccountGroupErrorDetail, AccountGroupPayload } from './types/account-group-api.types';
import {
  DEFAULT_ACTOR,
  hasOwnProperty,
  isForeignKeyConstraintError,
  normalizeRequiredText,
  throwAccountsBadRequest,
  throwAccountsConflict,
  throwAccountsNotFound,
  throwOnUniqueConstraintError,
} from 'src/common/utils/module-service.utils';
import type { AccountsWriteClient } from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AccountGroupType } from './types/account-group-enum';
const ACCOUNT_GROUP_TABLE_NAME = 'account groups';
const ACCOUNT_GROUP_AUDIT_SCREEN_NAME = 'Account Group Master';
type AccountGroupWriteClient = AccountsWriteClient;
type AccountGroupParentRecord = {
  accGroupId: string;
  accGroupCompanyId: string | null;
  accGroupType: string;
};
@Injectable()
export class AccountsGroupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async save(saveAccountGroupDto: SaveAccountGroupDto): Promise<AccountGroupPayload> {
    if (saveAccountGroupDto.accGroupId) {
      return this.updateAccountGroup(saveAccountGroupDto);
    }
    return this.createAccountGroup(saveAccountGroupDto);
  }

  async getById(accGroupId: string): Promise<AccountGroupPayload> {
    const record = await this.prisma.accountGroup.findFirst({
      where: {
        accGroupId,
        accGroupIsDeleted: false,
      },
    });
    if (!record) {
      throwAccountsNotFound<AccountGroupErrorDetail>(
        'Account group not found',
        'accGroupId',
        `No active account group found with id ${accGroupId}`,
      );
    }
    const parentName = await this.getParentName(record.accGroupParentId);
    return this.toPayload(record, parentName);
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
        throwAccountsNotFound<AccountGroupErrorDetail>(
          'Account group not found',
          'accGroupId',
          `No active account group found with id ${accGroupId}`,
        );
      }
      if (existing.accGroupIsReserved) {
        throwAccountsBadRequest<AccountGroupErrorDetail>('Reserved account group cannot be deleted', [
          {
            field: 'accGroupId',
            message: `Account group ${accGroupId} is reserved and cannot be deleted`,
          },
        ]);
      }
      const hasChildren = await tx.accountGroup.count({
        where: {
          accGroupParentId: accGroupId,
          accGroupIsDeleted: false,
        },
      });
      if (hasChildren > 0) {
        throwAccountsBadRequest<AccountGroupErrorDetail>(
          'Cannot delete account group with active children',
          [
            {
              field: 'accGroupId',
              message: `Account group ${accGroupId} has child groups. Reassign or delete them first.`,
            },
          ],
        );
      }
      const ledgerCount = await tx.accLedgerMaster.count({
        where: {
          ledGroupId: accGroupId,
          ledIsDeleted: false,
        },
      });
      if (ledgerCount > 0) {
        throwAccountsBadRequest<AccountGroupErrorDetail>(
          'Cannot delete account group with active ledgers',
          [
            {
              field: 'accGroupId',
              message: `Account group ${accGroupId} is used by ${ledgerCount} ledger(s).`,
            },
          ],
        );
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
          accGroupModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        throwAccountsNotFound<AccountGroupErrorDetail>(
          'Account group not found',
          'accGroupId',
          `No active account group found with id ${accGroupId}`,
        );
      }
      await this.removeChildIds(tx, ancestorIds, [accGroupId]);
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        accGroupIsDeleted: true,
        accGroupIsActive: false,
        accGroupModifiedOn: modifiedOn,
        accGroupModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
          userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
        const normalizedName = normalizeRequiredText<AccountGroupErrorDetail>(
          saveAccountGroupDto.accGroupName,
          'accGroupName',
        );
        if (!saveAccountGroupDto.accGroupParentId) {
          throwAccountsBadRequest<AccountGroupErrorDetail>('Parent account group is required', [
            {
              field: 'accGroupParentId',
              message: 'accGroupParentId is required to create an account group',
            },
          ]);
        }
        // Type and company are inherited from the parent — never supplied by the client.
        const parent = await this.ensureParentExists(saveAccountGroupDto.accGroupParentId, tx);
        const companyId = parent.accGroupCompanyId;
        await this.ensureNameIsUnique(tx, normalizedName, companyId);
        const now = new Date();
        const createdBy = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
        const data: Prisma.AccountGroupUncheckedCreateInput = {
          accGroupCompanyId: companyId,
          accGroupName: normalizedName,
          accGroupType: parent.accGroupType,
          accGroupChildIds: [],
          accGroupCreatedOn: now,
          accGroupCreatedBy: createdBy,
        };
        this.applyOptionalFields(data, saveAccountGroupDto);
        const created = await tx.accountGroup.create({ data });
        await this.ensureSelfInChildIds(tx, created.accGroupId);
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
        const finalRecord =
          refreshed ??
          ({
            ...created,
            accGroupChildIds: this.mergeChildIds(created.accGroupChildIds, [created.accGroupId]),
          } as AccountGroup);
        const parentName = await this.getParentName(finalRecord.accGroupParentId, tx);
        const payload = this.toPayload(finalRecord, parentName);
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
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Account group created',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<AccountGroupErrorDetail>(error, 'Account group already exists', [
        { field: 'accGroupName', message: 'Duplicate accGroupName is not allowed' },
      ]);
      if (isForeignKeyConstraintError(error)) {
        throwAccountsBadRequest<AccountGroupErrorDetail>('Invalid reference value provided', [
          {
            field: 'accGroupCompanyId',
            message: 'Referenced company or parent account group does not exist',
          },
        ]);
      }
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
          throwAccountsNotFound<AccountGroupErrorDetail>(
            'Account group not found',
            'accGroupId',
            `No active account group found with id ${accGroupId}`,
          );
        }
        if (existing.accGroupIsReserved) {
          throwAccountsBadRequest<AccountGroupErrorDetail>('Reserved account group cannot be edited', [
            {
              field: 'accGroupId',
              message: `Account group ${accGroupId} is reserved and cannot be edited`,
            },
          ]);
        }
        const normalizedName = normalizeRequiredText<AccountGroupErrorDetail>(
          saveAccountGroupDto.accGroupName,
          'accGroupName',
        );
        if (saveAccountGroupDto.accGroupParentId === accGroupId) {
          throwAccountsBadRequest<AccountGroupErrorDetail>(
            'Account group cannot be its own parent',
            [
              {
                field: 'accGroupParentId',
                message: 'accGroupParentId cannot be same as accGroupId',
              },
            ],
          );
        }
        const hasParentField = hasOwnProperty(saveAccountGroupDto, 'accGroupParentId');
        const nextParentId = hasParentField
          ? (saveAccountGroupDto.accGroupParentId ?? null)
          : existing.accGroupParentId;
        const isParentChanged = hasParentField && nextParentId !== existing.accGroupParentId;
        const subtreeIds = isParentChanged ? await this.getActiveSubtreeIds(tx, accGroupId) : [];
        if (isParentChanged && nextParentId && subtreeIds.includes(nextParentId)) {
          throwAccountsBadRequest<AccountGroupErrorDetail>('Circular hierarchy is not allowed', [
            {
              field: 'accGroupParentId',
              message: 'Parent cannot be a child of the same account group',
            },
          ]);
        }
        const parent = nextParentId ? await this.ensureParentExists(nextParentId, tx) : null;
        // Company follows the parent (root keeps its existing company); type is immutable post-create.
        const nextCompanyId = parent ? parent.accGroupCompanyId : existing.accGroupCompanyId;
        await this.ensureNameIsUnique(tx, normalizedName, nextCompanyId, accGroupId);
        const oldAncestorIds = isParentChanged
          ? await this.getAncestorIds(tx, existing.accGroupParentId)
          : [];
        const data: Prisma.AccountGroupUncheckedUpdateInput = {
          accGroupCompanyId: nextCompanyId,
          accGroupName: normalizedName,
          accGroupModifiedOn: new Date(),
          accGroupModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        };
        this.applyOptionalFields(data, saveAccountGroupDto);
        const updated = await tx.accountGroup.update({
          where: {
            accGroupId,
          },
          data,
        });
        await this.ensureSelfInChildIds(tx, accGroupId);
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
        const finalRecord = refreshed ?? updated;
        const originalParentName = await this.getParentName(existing.accGroupParentId, tx);
        const parentName = await this.getParentName(finalRecord.accGroupParentId, tx);
        const payload = this.toPayload(finalRecord, parentName);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: ACCOUNT_GROUP_TABLE_NAME,
            screenName: ACCOUNT_GROUP_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: accGroupId,
            displayName: payload.accGroupName,
            originalRecord: this.toPayload(existing, originalParentName),
            modifiedRecord: payload,
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Account group updated',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<AccountGroupErrorDetail>(error, 'Account group already exists', [
        { field: 'accGroupName', message: 'Duplicate accGroupName is not allowed' },
      ]);
      if (isForeignKeyConstraintError(error)) {
        throwAccountsBadRequest<AccountGroupErrorDetail>('Invalid reference value provided', [
          {
            field: 'accGroupCompanyId',
            message: 'Referenced company or parent account group does not exist',
          },
        ]);
      }
      throw error;
    }
  }
  private async ensureParentExists(
    parentId: string,
    tx: AccountGroupWriteClient,
  ): Promise<AccountGroupParentRecord> {
    const parent = await tx.accountGroup.findFirst({
      where: {
        accGroupId: parentId,
        accGroupIsDeleted: false,
      },
      select: {
        accGroupId: true,
        accGroupCompanyId: true,
        accGroupType: true,
      },
    });
    if (!parent) {
      throwAccountsBadRequest<AccountGroupErrorDetail>('Parent account group does not exist', [
        {
          field: 'accGroupParentId',
          message: `No active account group found with id ${parentId}`,
        },
      ]);
    }
    return parent;
  }
  private async ensureNameIsUnique(
    tx: AccountGroupWriteClient,
    groupName: string,
    companyId?: string | null,
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
      throwAccountsConflict<AccountGroupErrorDetail>(
        'Account group name already exists for this company',
        [
          {
            field: 'accGroupName',
            message: 'Duplicate accGroupName is not allowed for this company',
          },
        ],
      );
    }
  }
  private applyOptionalFields(
    data: Prisma.AccountGroupUncheckedCreateInput | Prisma.AccountGroupUncheckedUpdateInput,
    saveAccountGroupDto: SaveAccountGroupDto,
  ): void {
    if (hasOwnProperty(saveAccountGroupDto, 'accGroupAlias')) {
      data.accGroupAlias = saveAccountGroupDto.accGroupAlias;
    }
    if (hasOwnProperty(saveAccountGroupDto, 'accGroupShort')) {
      data.accGroupShort = saveAccountGroupDto.accGroupShort;
    }
    if (hasOwnProperty(saveAccountGroupDto, 'accGroupDescription')) {
      data.accGroupDescription = saveAccountGroupDto.accGroupDescription;
    }
    if (hasOwnProperty(saveAccountGroupDto, 'accGroupParentId')) {
      data.accGroupParentId = saveAccountGroupDto.accGroupParentId;
    }
    if (hasOwnProperty(saveAccountGroupDto, 'accGroupSort')) {
      data.accGroupSort = saveAccountGroupDto.accGroupSort;
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
  private async ensureSelfInChildIds(
    tx: AccountGroupWriteClient,
    accGroupId: string,
  ): Promise<void> {
    await this.appendChildIds(tx, [accGroupId], [accGroupId]);
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
  private async getParentName(
    parentId: string | null,
    client: AccountGroupWriteClient = this.prisma,
  ): Promise<string | null> {
    if (!parentId) {
      return null;
    }
    const parent = await client.accountGroup.findFirst({
      where: {
        accGroupId: parentId,
        accGroupIsDeleted: false,
      },
      select: {
        accGroupName: true,
      },
    });
    return parent?.accGroupName ?? null;
  }
  private toPayload(
    record: AccountGroup,
    accGroupParentName: string | null = null,
  ): AccountGroupPayload {
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
      accGroupTallyGuid: record.accGroupTallyGuid,
      accGroupTallyMasterId: record.accGroupTallyMasterId?.toString() ?? null,
      accGroupTallyAlterId: record.accGroupTallyAlterId?.toString() ?? null,
      accGroupParentId: record.accGroupParentId,
      accGroupParentName,
      accGroupSort: record.accGroupSort,
      accGroupChildIds: record.accGroupChildIds,
      accGroupType: record.accGroupType as AccountGroupType,
      accGroupIsDefault: record.accGroupIsDefault,
      accGroupIsReserved: record.accGroupIsReserved,
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
}
