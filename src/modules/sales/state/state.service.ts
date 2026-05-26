import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveStateDto } from './dto/save-state.dto';
import { StatePayload } from './types/state-api.types';
import {
  applyStateOptionalFields,
  DEFAULT_ACTOR,
  ensureStateNameIsUnique,
  handleStateWriteError,
  normalizeRequiredStateName,
  resolveStateActor,
  STATE_AUDIT_SCREEN_NAME,
  STATE_TABLE_NAME,
  throwStateBadRequest,
  throwStateNotFound,
  toStatePayload,
} from './utils/state.utils';
@Injectable()
export class StateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}
  async save(saveStateDto: SaveStateDto): Promise<StatePayload> {
    if (saveStateDto.stmId) {
      return this.updateState(saveStateDto);
    }
    return this.createState(saveStateDto);
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
          stmModifiedBy: DEFAULT_ACTOR,
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
        stmModifiedBy: DEFAULT_ACTOR,
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
          userId: DEFAULT_ACTOR,
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
  private async createState(saveStateDto: SaveStateDto): Promise<StatePayload> {
    const normalizedName = normalizeRequiredStateName(saveStateDto.stmName);
    const now = new Date();
    const createdBy = resolveStateActor(saveStateDto.stmCreatedBy);
    const modifiedBy = resolveStateActor(saveStateDto.stmModifiedBy, createdBy);
    const data: Prisma.StateMasterUncheckedCreateInput = {
      stmName: normalizedName,
      stmCreatedOn: now,
      stmCreatedBy: createdBy,
      stmModifiedOn: now,
      stmModifiedBy: modifiedBy,
    };
    applyStateOptionalFields(data, saveStateDto);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await ensureStateNameIsUnique(tx, normalizedName);
        const created = await tx.stateMaster.create({ data });
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
            userId: createdBy,
            notes: 'State created',
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