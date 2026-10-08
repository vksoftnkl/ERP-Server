import { Injectable } from '@nestjs/common';
import { AccGroupMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveAccGroupMasterDto } from './dto/save-acc-group-master.dto';
import {
  AccGroupMasterErrorDetail,
  AccGroupMasterPayload,
} from './types/acc-group-master-api.types';
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
import {
  AccLedgerProfile,
  AccGroupMasterNature,
  AccGroupMasterType,
} from './types/acc-group-master-enum';
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
        throwAccountsBadRequest<AccGroupMasterErrorDetail>(
          'Reserved account group cannot be deleted',
          [
            {
              field: 'accGroupId',
              message: `Account group ${accGroupId} is reserved and cannot be deleted`,
            },
          ],
        );
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
          accGroupCreatedOn: now,
          accGroupCreatedBy: createdBy,
        };
        this.applyOptionalFields(data, saveAccGroupMasterDto);
        const created = await tx.accGroupMaster.create({ data });
        const parentName = await this.getParentName(created.accGroupParentId, tx);
        const payload = this.toPayload(created, parentName);
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
      throwOnUniqueConstraintError<AccGroupMasterErrorDetail>(
        error,
        'Account group already exists',
        [{ field: 'accGroupName', message: 'Duplicate accGroupName is not allowed' }],
      );
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
          throwAccountsBadRequest<AccGroupMasterErrorDetail>(
            'Reserved account group cannot be edited',
            [
              {
                field: 'accGroupId',
                message: `Account group ${accGroupId} is reserved and cannot be edited`,
              },
            ],
          );
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
        // Still needed, and only for this: a group cannot be reparented under one of
        // its own descendants. Nothing here maintains a stored child array any more.
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
        await this.ensureNameIsUnique(tx, normalizedName, nextCompanyId, accGroupId, {
          accGroupName: existing.accGroupName,
          accGroupCompanyId: existing.accGroupCompanyId,
        });
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
        const originalParentName = await this.getParentName(existing.accGroupParentId, tx);
        const parentName = await this.getParentName(updated.accGroupParentId, tx);
        const payload = this.toPayload(updated, parentName);
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
      throwOnUniqueConstraintError<AccGroupMasterErrorDetail>(
        error,
        'Account group already exists',
        [{ field: 'accGroupName', message: 'Duplicate accGroupName is not allowed' }],
      );
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
  // "Unique within what ONE COMPANY CAN SEE" — three rules, not one:
  //   1 · no two SHARED groups (company_id NULL) share a name;
  //   2 · no two groups in the SAME company share a name;
  //   3 · a company-scoped group must not collide with a SHARED one.
  // Rule 3 is the one the old check missed entirely. It scoped the lookup to the
  // company being written, so a scoped group could take a name a shared group
  // already held — and since a shared group is visible from every company, the
  // operator then saw two identical names and a Tally export merged them.
  //
  // Both scopes collapse into one filter: a SHARED write must clash with nothing
  // at all (rules 1 + 3 together), and a SCOPED write must clash with neither its
  // own company nor the shared pool (rules 2 + 3).
  //
  // `previous` grandfathers rows that already violate rule 3. If the name and the
  // scope are both unchanged, the write introduces no collision that was not
  // already there, and refusing it would lock a legacy pair out of every unrelated
  // edit. The DB trigger tr_acc_group_name_scope makes the same allowance.
  private async ensureNameIsUnique(
    tx: AccGroupMasterWriteClient,
    groupName: string,
    companyId?: string | null,
    excludeId?: string,
    previous?: { accGroupName: string; accGroupCompanyId: string | null },
  ): Promise<void> {
    const nextCompanyId = companyId ?? null;
    if (
      previous &&
      previous.accGroupName.trim().toLowerCase() === groupName.trim().toLowerCase() &&
      previous.accGroupCompanyId === nextCompanyId
    ) {
      return;
    }
    const existing = await tx.accGroupMaster.findFirst({
      where: {
        accGroupIsDeleted: false,
        ...(nextCompanyId === null
          ? {}
          : { OR: [{ accGroupCompanyId: nextCompanyId }, { accGroupCompanyId: null }] }),
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
        accGroupCompanyId: true,
      },
    });
    if (existing) {
      const clashCompanyId = existing.accGroupCompanyId ?? null;
      let message: string;
      if (clashCompanyId === nextCompanyId) {
        message =
          nextCompanyId === null
            ? `Account group "${groupName}" already exists as a shared group`
            : 'Duplicate accGroupName is not allowed for this company';
      } else if (nextCompanyId === null) {
        message = `Account group "${groupName}" already exists in one company, and a shared group is visible from every company`;
      } else {
        message = `Account group "${groupName}" already exists as a shared group, which this company also sees`;
      }
      throwAccountsConflict<AccGroupMasterErrorDetail>('Account group name already exists', [
        { field: 'accGroupName', message },
      ]);
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
    // The four Tally behaviour flags (§1.3) plus is-active. The columns have always
    // been there, NOT NULL DEFAULT false; until now no payload could reach them, so
    // every export emitted Tally's default for all four.
    if (hasOwnProperty(saveAccGroupMasterDto, 'accGroupBehaveAsSubledger')) {
      data.accGroupBehaveAsSubledger = saveAccGroupMasterDto.accGroupBehaveAsSubledger;
    }
    if (hasOwnProperty(saveAccGroupMasterDto, 'accGroupNetDebitCredit')) {
      data.accGroupNetDebitCredit = saveAccGroupMasterDto.accGroupNetDebitCredit;
    }
    if (hasOwnProperty(saveAccGroupMasterDto, 'accGroupUsedForCalculation')) {
      data.accGroupUsedForCalculation = saveAccGroupMasterDto.accGroupUsedForCalculation;
    }
    if (hasOwnProperty(saveAccGroupMasterDto, 'accGroupAffectsGrossProfit')) {
      data.accGroupAffectsGrossProfit = saveAccGroupMasterDto.accGroupAffectsGrossProfit;
    }
    if (hasOwnProperty(saveAccGroupMasterDto, 'accGroupIsActive')) {
      data.accGroupIsActive = saveAccGroupMasterDto.accGroupIsActive;
    }
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
