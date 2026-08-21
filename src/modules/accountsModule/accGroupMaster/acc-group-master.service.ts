import { Injectable } from '@nestjs/common';
import { AccGroupMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveAccGroupMasterDto } from './dto/save-acc-group-master.dto';
import { AccGroupMasterErrorDetail, AccGroupMasterPayload } from './types/acc-group-master-api.types';
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
import { AccLedgerProfile, AccGroupMasterNature, AccGroupMasterType } from './types/acc-group-master-enum';
const ACC_GROUP_MASTER_TABLE_NAME = 'account groups';
const ACC_GROUP_MASTER_AUDIT_SCREEN_NAME = 'Account Group Master';
type AccGroupMasterWriteClient = AccountsWriteClient;
type AccGroupMasterParentRecord = {
  accGroupId: string;
  accGroupCompanyId: string | null;
  accGroupType: string;
  accLedgerProfile: string;
  accGroupNature: string | null;
};
@Injectable()
export class AccGroupMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async save(saveAccGroupMasterDto: SaveAccGroupMasterDto): Promise<AccGroupMasterPayload> {
    if (saveAccGroupMasterDto.accGroupId) {
      return this.updateAccGroupMaster(saveAccGroupMasterDto);
    }
    return this.createAccGroupMaster(saveAccGroupMasterDto);
  }
  async getById(accGroupId: string): Promise<AccGroupMasterPayload> {
    const record = await this.prisma.accGroupMaster.findFirst({
      where: {
        accGroupId,
        accGroupIsDeleted: false,
      },
    });
    if (!record) {
      throwAccountsNotFound<AccGroupMasterErrorDetail>(
        'Account group not found',
        'accGroupId',
        `No active account group found with id ${accGroupId}`,
      );
    }
    const parentName = await this.getParentName(record.accGroupParentId);
    const companyName = await this.getCompanyName(record.accGroupCompanyId);
    return this.toPayload(record, parentName, companyName);
  }
  async softDelete(accGroupId: string): Promise<{ accGroupId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.accGroupMaster.findFirst({
        where: {
          accGroupId,
          accGroupIsDeleted: false,
        },
      });
      if (!existing) {
        throwAccountsNotFound<AccGroupMasterErrorDetail>(
          'Account group not found',
          'accGroupId',
          `No active account group found with id ${accGroupId}`,
        );
      }
      if (existing.accGroupIsReserved) {
        throwAccountsBadRequest<AccGroupMasterErrorDetail>('Reserved account group cannot be deleted', [
          {
            field: 'accGroupId',
            message: `Account group ${accGroupId} is reserved and cannot be deleted`,
          },
        ]);
      }
      const hasChildren = await tx.accGroupMaster.count({
        where: {
          accGroupParentId: accGroupId,
          accGroupIsDeleted: false,
        },
      });
      if (hasChildren > 0) {
        throwAccountsBadRequest<AccGroupMasterErrorDetail>(
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
        throwAccountsBadRequest<AccGroupMasterErrorDetail>(
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
      const result = await tx.accGroupMaster.updateMany({
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
        throwAccountsNotFound<AccGroupMasterErrorDetail>(
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
          tableName: ACC_GROUP_MASTER_TABLE_NAME,
          screenName: ACC_GROUP_MASTER_AUDIT_SCREEN_NAME,
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
  private async createAccGroupMaster(
    saveAccGroupMasterDto: SaveAccGroupMasterDto,
  ): Promise<AccGroupMasterPayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const normalizedName = normalizeRequiredText<AccGroupMasterErrorDetail>(
          saveAccGroupMasterDto.accGroupName,
          'accGroupName',
        );
        if (!saveAccGroupMasterDto.accGroupParentId) {
          throwAccountsBadRequest<AccGroupMasterErrorDetail>('Parent account group is required', [
            {
              field: 'accGroupParentId',
              message: 'accGroupParentId is required to create an account group',
            },
          ]);
        }
        // Type, company, ledger profile, and nature are inherited from the parent —
        // never supplied by the client.
        const parent = await this.ensureParentExists(saveAccGroupMasterDto.accGroupParentId, tx);
        const companyId = parent.accGroupCompanyId;
        await this.ensureNameIsUnique(tx, normalizedName, companyId);
        const now = new Date();
        const createdBy = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
        const data: Prisma.AccGroupMasterUncheckedCreateInput = {
          accGroupCompanyId: companyId,
          accGroupName: normalizedName,
          accGroupType: parent.accGroupType,
          accLedgerProfile: parent.accLedgerProfile,
          accGroupNature: parent.accGroupNature,
          accGroupChildIds: [],
          accGroupCreatedOn: now,
          accGroupCreatedBy: createdBy,
        };
        this.applyOptionalFields(data, saveAccGroupMasterDto);
        const created = await tx.accGroupMaster.create({ data });
        await this.ensureSelfInChildIds(tx, created.accGroupId);
        if (created.accGroupParentId) {
          const ancestorIds = await this.getAncestorIds(tx, created.accGroupParentId);
          await this.appendChildIds(tx, ancestorIds, [created.accGroupId]);
        }
        const refreshed = await tx.accGroupMaster.findFirst({
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
          } as AccGroupMaster);
        const parentName = await this.getParentName(finalRecord.accGroupParentId, tx);
        const payload = this.toPayload(finalRecord, parentName);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: ACC_GROUP_MASTER_TABLE_NAME,
            screenName: ACC_GROUP_MASTER_AUDIT_SCREEN_NAME,
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
      throwOnUniqueConstraintError<AccGroupMasterErrorDetail>(error, 'Account group already exists', [
        { field: 'accGroupName', message: 'Duplicate accGroupName is not allowed' },
      ]);
      if (isForeignKeyConstraintError(error)) {
        throwAccountsBadRequest<AccGroupMasterErrorDetail>('Invalid reference value provided', [
          {
            field: 'accGroupCompanyId',
            message: 'Referenced company or parent account group does not exist',
          },
        ]);
      }
      throw error;
    }
  }
  private async updateAccGroupMaster(
    saveAccGroupMasterDto: SaveAccGroupMasterDto,
  ): Promise<AccGroupMasterPayload> {
    const accGroupId = saveAccGroupMasterDto.accGroupId!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.accGroupMaster.findFirst({
          where: {
            accGroupId,
            accGroupIsDeleted: false,
          },
        });
        if (!existing) {
          throwAccountsNotFound<AccGroupMasterErrorDetail>(
            'Account group not found',
            'accGroupId',
            `No active account group found with id ${accGroupId}`,
          );
        }
        if (existing.accGroupIsReserved) {
          throwAccountsBadRequest<AccGroupMasterErrorDetail>('Reserved account group cannot be edited', [
            {
              field: 'accGroupId',
              message: `Account group ${accGroupId} is reserved and cannot be edited`,
            },
          ]);
        }
        const normalizedName = normalizeRequiredText<AccGroupMasterErrorDetail>(
          saveAccGroupMasterDto.accGroupName,
          'accGroupName',
        );
        if (saveAccGroupMasterDto.accGroupParentId === accGroupId) {
          throwAccountsBadRequest<AccGroupMasterErrorDetail>(
            'Account group cannot be its own parent',
            [
              {
                field: 'accGroupParentId',
                message: 'accGroupParentId cannot be same as accGroupId',
              },
            ],
          );
        }
        const hasParentField = hasOwnProperty(saveAccGroupMasterDto, 'accGroupParentId');
        const nextParentId = hasParentField
          ? (saveAccGroupMasterDto.accGroupParentId ?? null)
          : existing.accGroupParentId;
        const isParentChanged = hasParentField && nextParentId !== existing.accGroupParentId;
        const subtreeIds = isParentChanged ? await this.getActiveSubtreeIds(tx, accGroupId) : [];
        if (isParentChanged && nextParentId && subtreeIds.includes(nextParentId)) {
          throwAccountsBadRequest<AccGroupMasterErrorDetail>('Circular hierarchy is not allowed', [
            {
              field: 'accGroupParentId',
              message: 'Parent cannot be a child of the same account group',
            },
          ]);
        }
        const parent = nextParentId ? await this.ensureParentExists(nextParentId, tx) : null;
        // Company, type, ledger profile, and nature all mirror the effective parent — never
        // supplied by the client. A root (no parent) keeps its existing values for all four.
        const nextCompanyId = parent ? parent.accGroupCompanyId : existing.accGroupCompanyId;
        await this.ensureNameIsUnique(tx, normalizedName, nextCompanyId, accGroupId);
        const oldAncestorIds = isParentChanged
          ? await this.getAncestorIds(tx, existing.accGroupParentId)
          : [];
        const data: Prisma.AccGroupMasterUncheckedUpdateInput = {
          accGroupCompanyId: nextCompanyId,
          accGroupName: normalizedName,
          accGroupModifiedOn: new Date(),
          accGroupModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        };
        if (parent) {
          // Inherited from the effective parent; left untouched for roots.
          data.accGroupType = parent.accGroupType;
          data.accLedgerProfile = parent.accLedgerProfile;
          data.accGroupNature = parent.accGroupNature;
        }
        this.applyOptionalFields(data, saveAccGroupMasterDto);
        const updated = await tx.accGroupMaster.update({
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
        const refreshed = await tx.accGroupMaster.findFirst({
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
            tableName: ACC_GROUP_MASTER_TABLE_NAME,
            screenName: ACC_GROUP_MASTER_AUDIT_SCREEN_NAME,
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
      throwOnUniqueConstraintError<AccGroupMasterErrorDetail>(error, 'Account group already exists', [
        { field: 'accGroupName', message: 'Duplicate accGroupName is not allowed' },
      ]);
      if (isForeignKeyConstraintError(error)) {
        throwAccountsBadRequest<AccGroupMasterErrorDetail>('Invalid reference value provided', [
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
    tx: AccGroupMasterWriteClient,
  ): Promise<AccGroupMasterParentRecord> {
    const parent = await tx.accGroupMaster.findFirst({
      where: {
        accGroupId: parentId,
        accGroupIsDeleted: false,
      },
      select: {
        accGroupId: true,
        accGroupCompanyId: true,
        accGroupType: true,
        accLedgerProfile: true,
        accGroupNature: true,
      },
    });
    if (!parent) {
      throwAccountsBadRequest<AccGroupMasterErrorDetail>('Parent account group does not exist', [
        {
          field: 'accGroupParentId',
          message: `No active account group found with id ${parentId}`,
        },
      ]);
    }
    return parent;
  }
  private async ensureNameIsUnique(
    tx: AccGroupMasterWriteClient,
    groupName: string,
    companyId?: string | null,
    excludeId?: string,
  ): Promise<void> {
    const existing = await tx.accGroupMaster.findFirst({
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
      throwAccountsConflict<AccGroupMasterErrorDetail>(
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
    data: Prisma.AccGroupMasterUncheckedCreateInput | Prisma.AccGroupMasterUncheckedUpdateInput,
    saveAccGroupMasterDto: SaveAccGroupMasterDto,
  ): void {
    if (hasOwnProperty(saveAccGroupMasterDto, 'accGroupAlias')) {
      data.accGroupAlias = saveAccGroupMasterDto.accGroupAlias;
    }
    if (hasOwnProperty(saveAccGroupMasterDto, 'accGroupShort')) {
      data.accGroupShort = saveAccGroupMasterDto.accGroupShort;
    }
    if (hasOwnProperty(saveAccGroupMasterDto, 'accGroupDescription')) {
      data.accGroupDescription = saveAccGroupMasterDto.accGroupDescription;
    }
    if (hasOwnProperty(saveAccGroupMasterDto, 'accGroupParentId')) {
      data.accGroupParentId = saveAccGroupMasterDto.accGroupParentId;
    }
    if (hasOwnProperty(saveAccGroupMasterDto, 'accGroupSort')) {
      data.accGroupSort = saveAccGroupMasterDto.accGroupSort;
    }
  }
  private async getAncestorIds(
    tx: AccGroupMasterWriteClient,
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
      const parent = await tx.accGroupMaster.findFirst({
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
    tx: AccGroupMasterWriteClient,
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
      const node = await tx.accGroupMaster.findFirst({
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
      const children = await tx.accGroupMaster.findMany({
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
    tx: AccGroupMasterWriteClient,
    targetIds: string[],
    idsToAdd: string[],
  ): Promise<void> {
    const normalizedTargetIds = this.toUniqueIds(targetIds);
    const normalizedIdsToAdd = this.toUniqueIds(idsToAdd);
    if (normalizedTargetIds.length === 0 || normalizedIdsToAdd.length === 0) {
      return;
    }
    const records = await tx.accGroupMaster.findMany({
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
      await tx.accGroupMaster.update({
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
    tx: AccGroupMasterWriteClient,
    targetIds: string[],
    idsToRemove: string[],
  ): Promise<void> {
    const normalizedTargetIds = this.toUniqueIds(targetIds);
    const normalizedIdsToRemove = this.toUniqueIds(idsToRemove);
    if (normalizedTargetIds.length === 0 || normalizedIdsToRemove.length === 0) {
      return;
    }
    const records = await tx.accGroupMaster.findMany({
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
      await tx.accGroupMaster.update({
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
    tx: AccGroupMasterWriteClient,
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
    client: AccGroupMasterWriteClient = this.prisma,
  ): Promise<string | null> {
    if (!parentId) {
      return null;
    }
    const parent = await client.accGroupMaster.findFirst({
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
  private async getCompanyName(
    companyId: string | null,
    client: AccGroupMasterWriteClient = this.prisma,
  ): Promise<string | null> {
    if (!companyId) {
      return null;
    }
    const company = await client.company.findFirst({
      where: {
        compId: companyId,
      },
      select: {
        compName: true,
      },
    });
    return company?.compName ?? null;
  }
  private toPayload(
    record: AccGroupMaster,
    accGroupParentName: string | null = null,
    accGroupCompanyName: string | null = null,
  ): AccGroupMasterPayload {
    return {
      accGroupId: record.accGroupId,
      accGroupCompanyId: record.accGroupCompanyId,
      accGroupCompanyName,
      accGroupName: record.accGroupName,
      accGroupAlias: record.accGroupAlias,
      accGroupShort: record.accGroupShort,
      accGroupDescription: record.accGroupDescription,
      accGroupTallyName: record.accGroupTallyName,
      accGroupPrimaryName: record.accGroupPrimaryName,
      accGroupNature: record.accGroupNature as AccGroupMasterNature | null,
      accLedgerProfile: record.accLedgerProfile as AccLedgerProfile,
      accGroupTallyGuid: record.accGroupTallyGuid,
      accGroupTallyMasterId: record.accGroupTallyMasterId?.toString() ?? null,
      accGroupTallyAlterId: record.accGroupTallyAlterId?.toString() ?? null,
      accGroupParentId: record.accGroupParentId,
      accGroupParentName,
      accGroupSort: record.accGroupSort,
      accGroupChildIds: record.accGroupChildIds,
      accGroupType: record.accGroupType as AccGroupMasterType,
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