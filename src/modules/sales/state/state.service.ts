import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveStateDto } from './dto/save-state.dto';
import { StateMasterCreateResult, StatePayload } from './types/state-api.types';
import {
  applyStateOptionalFields,
  DEFAULT_ACTOR,
  ensureStateNameIsUnique,
  handleStateWriteError,
  normalizeRequiredStateName,
  resolveStateActor,
  STATE_AUDIT_SCREEN_NAME,
  STATE_TABLE_NAME,
  STATES_ACCOUNT_GROUP_ID,
  throwStateBadRequest,
  throwStateNotFound,
  toStatePayload,
} from './utils/state.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
@Injectable()
export class StateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async save(saveStateDto: SaveStateDto): Promise<StatePayload> {
    if (saveStateDto.stmId) {
      return this.updateState(saveStateDto);
    }
    const userId = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    const { stateMaster } = await this.createStateMaster(saveStateDto, userId);
    return stateMaster;
  }
  async createStateMaster(
    dto: SaveStateDto,
    userId: string,
    // parentId is a separate argument because it can't come from the state payload. For this flow
    // it defaults to the fixed "States" account group; callers may override it.
    parentId: string = STATES_ACCOUNT_GROUP_ID,
  ): Promise<StateMasterCreateResult> {
    const normalizedName = normalizeRequiredStateName(dto.stmName);
    const actor = resolveStateActor(userId);
    const now = new Date();
    // stmIsActive collapses onto soft-delete state: active => is_deleted false, inactive => true.
    const isDeleted = dto.stmIsActive === false;
    const order = dto.stmOrder ?? 0;
    try {
      // $transaction is the rollback boundary: the account group insert and the state master
      // insert commit together. Any throw below (including the second insert failing) rolls
      // back BOTH rows.
      return await this.prisma.$transaction(async (tx) => {
        await ensureStateNameIsUnique(tx, normalizedName);
        // acc_group_type / company / nature / ledger profile are required (or NOT NULL) on
        // account_groups and are never client-supplied — inherit them from the parent group.
        const parent = await tx.accountGroup.findFirst({
          where: {
            accGroupId: parentId,
            accGroupIsDeleted: false,
          },
          select: {
            accGroupCompanyId: true,
            accGroupType: true,
            accLedgerProfile: true,
            accGroupNature: true,
          },
        });
        if (!parent) {
          throwStateBadRequest('Parent account group does not exist', [
            {
              field: 'parentId',
              message: `No active account group found with id ${parentId}`,
            },
          ]);
        }
        // Step 2-3: create the account group derived from the state fields; capture acc_group_id.
        const accountGroupData: Prisma.AccountGroupUncheckedCreateInput = {
          accGroupName: normalizedName, // <- stmName
          accGroupShort: dto.stmShort ?? null, // <- stmShort
          accGroupDescription: null, // not carried from the state payload
          accGroupSort: order, // <- stmOrder
          accGroupParentId: parentId, // <- parentId argument
          accGroupCompanyId: parent.accGroupCompanyId,
          accGroupType: parent.accGroupType,
          accLedgerProfile: parent.accLedgerProfile,
          accGroupNature: parent.accGroupNature,
          accGroupChildIds: [],
          accGroupIsActive: !isDeleted,
          accGroupIsDeleted: isDeleted,
          accGroupCreatedOn: now,
          accGroupCreatedBy: actor,
          accGroupModifiedOn: now,
          accGroupModifiedBy: actor,
        };
        const accountGroup = await tx.accountGroup.create({ data: accountGroupData });
        const accGroupId = accountGroup.accGroupId;
        // Step 4-5: the state master shares its PK with the account group. stm_id is set
        // EXPLICITLY to acc_group_id; the model has no uuidv7() default, so this exact value
        // is persisted (stmAlias lives on the state row only — there is no group alias here).
        const stateMasterData: Prisma.StateMasterUncheckedCreateInput = {
          stmId: accGroupId,
          stmName: normalizedName,
          stmAlias: dto.stmAlias ?? null,
          stmShort: dto.stmShort ?? null,
          stmOrder: order,
          stmIsActive: !isDeleted,
          stmIsDeleted: isDeleted,
          stmCreatedOn: now,
          stmCreatedBy: actor,
          stmModifiedOn: now,
          stmModifiedBy: actor,
        };
        const created = await tx.stateMaster.create({ data: stateMasterData });
        const payload = toStatePayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: STATE_TABLE_NAME,
            screenName: STATE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.stmId,
            displayName: payload.stmName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: actor,
            notes: 'State created with linked account group',
          },
          tx,
        );
        return { stateMaster: payload, accGroupId };
      });
    } catch (error: unknown) {
      handleStateWriteError(error);
      throw error;
    }
  }
  async getById(stmId: string): Promise<StatePayload> {
    const record = await this.prisma.stateMaster.findFirst({
      where: {
        stmId,
        stmIsDeleted: false,
      },
    });
    if (!record) {
      throwStateNotFound(stmId);
    }
    return toStatePayload(record);
  }
  async softDelete(stmId: string): Promise<{ stmId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.stateMaster.findFirst({
        where: {
          stmId,
          stmIsDeleted: false,
        },
      });
      if (!existing) {
        throwStateNotFound(stmId);
      }
      const cityCount = await tx.cityMaster.count({
        where: {
          ctmStateId: stmId,
          ctmIsDeleted: false,
        },
      });
      if (cityCount > 0) {
        throwStateBadRequest('Cannot delete state with active cities', [
          {
            field: 'stmId',
            message: `State ${stmId} is used by ${cityCount} city(s).`,
          },
        ]);
      }
      const modifiedOn = new Date();
      const result = await tx.stateMaster.updateMany({
        where: {
          stmId,
          stmIsDeleted: false,
        },
        data: {
          stmIsDeleted: true,
          stmIsActive: false,
          stmModifiedOn: modifiedOn,
          stmModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        throwStateNotFound(stmId);
      }
      const originalRecord = toStatePayload(existing);
      const modifiedRecord = toStatePayload({
        ...existing,
        stmIsDeleted: true,
        stmIsActive: false,
        stmModifiedOn: modifiedOn,
        stmModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: STATE_TABLE_NAME,
          screenName: STATE_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: stmId,
          displayName: existing.stmName,
          originalRecord,
          modifiedRecord,
          userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
          notes: 'State soft deleted',
        },
        tx,
      );
      return {
        stmId,
        deleted: true,
      };
    });
  }
  // private async createState(saveStateDto: SaveStateDto): Promise<StatePayload> {
  //   const normalizedName = normalizeRequiredStateName(saveStateDto.stmName);
  //   const now = new Date();
  //   const createdBy = resolveStateActor(saveStateDto.stmCreatedBy);
  //   try {
  //     return await this.prisma.$transaction(async (tx) => {
  //       await ensureStateNameIsUnique(tx, normalizedName);
  //       // stm_id no longer has a DB default (it is normally the linked acc_group_id). A standalone
  //       // state has no account group, so generate a uuidv7 here to preserve the time-ordered PK.
  //       const [generated] = await tx.$queryRaw<
  //         Array<{ stmId: string }>
  //       >`SELECT uuidv7() AS "stmId"`;
  //       const data: Prisma.StateMasterUncheckedCreateInput = {
  //         stmId: generated.stmId,
  //         stmName: normalizedName,
  //         stmCreatedOn: now,
  //         stmCreatedBy: createdBy,
  //       };
  //       applyStateOptionalFields(data, saveStateDto);
  //       const created = await tx.stateMaster.create({ data });
  //       const payload = toStatePayload(created);
  //       await this.auditLogService.logEntityChange(
  //         {
  //           action: 'New',
  //           tableName: STATE_TABLE_NAME,
  //           screenName: STATE_AUDIT_SCREEN_NAME,
  //           screenType: 'master',
  //           pk: payload.stmId,
  //           displayName: payload.stmName,
  //           originalRecord: null,
  //           modifiedRecord: payload,
  //           userId: createdBy,
  //           notes: 'State created',
  //         },
  //         tx,
  //       );
  //       return payload;
  //     });
  //   } catch (error: unknown) {
  //     handleStateWriteError(error);
  //     throw error;
  //   }
  // }
  private async updateState(saveStateDto: SaveStateDto): Promise<StatePayload> {
    const stmId = saveStateDto.stmId!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.stateMaster.findFirst({
          where: {
            stmId,
            stmIsDeleted: false,
          },
        });
        if (!existing) {
          throwStateNotFound(stmId);
        }
        const normalizedName = normalizeRequiredStateName(saveStateDto.stmName);
        await ensureStateNameIsUnique(tx, normalizedName, stmId);
        const data: Prisma.StateMasterUncheckedUpdateInput = {
          stmName: normalizedName,
          stmModifiedOn: new Date(),
          stmModifiedBy: resolveStateActor(saveStateDto.stmModifiedBy),
        };
        applyStateOptionalFields(data, saveStateDto);
        const updated = await tx.stateMaster.update({
          where: {
            stmId,
          },
          data,
        });
        const payload = toStatePayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: STATE_TABLE_NAME,
            screenName: STATE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: stmId,
            displayName: payload.stmName,
            originalRecord: toStatePayload(existing),
            modifiedRecord: payload,
            userId: payload.stmModifiedBy,
            notes: 'State updated',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      handleStateWriteError(error);
      throw error;
    }
  }
}
