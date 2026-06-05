import { Injectable } from '@nestjs/common';
import { ItemTaxHistory, Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { SaveItemTaxHistoryDto } from './dto/save-item-tax-history.dto';
import {
  ItemTaxHistoryErrorDetail,
  ItemTaxHistoryPayload,
} from './types/item-tax-history-api.types';
import {
  DEFAULT_ACTOR,
  hasOwnProperty,
  isForeignKeyConstraintError,
  resolveActor,
  throwInventoryBadRequest,
  throwInventoryNotFound,
  throwOnUniqueConstraintError,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';

const ITEM_TAX_HISTORY_TABLE_NAME = 'item tax history';
const ITEM_TAX_HISTORY_AUDIT_SCREEN_NAME = 'Item Tax History';

@Injectable()
export class ItemsTaxHistoryMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async save(saveItemTaxHistoryDto: SaveItemTaxHistoryDto): Promise<ItemTaxHistoryPayload> {
    if (saveItemTaxHistoryDto.ith_id) {
      return this.updateItemTaxHistory(saveItemTaxHistoryDto);
    }
    return this.createItemTaxHistory(saveItemTaxHistoryDto);
  }
  async getById(ithId: string): Promise<ItemTaxHistoryPayload> {
    const record = await this.prisma.itemTaxHistory.findUnique({ where: { ithId } });
    if (!record) {
      throwInventoryNotFound<ItemTaxHistoryErrorDetail>(
        'Item tax history not found',
        'ith_id',
        `No item tax history found with id ${ithId}`,
      );
    }
    return this.toPayload(record);
  }

  async delete(ithId: string): Promise<{ ith_id: string; deleted: true }> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.itemTaxHistory.findUnique({ where: { ithId } });
        if (!existing) {
          throwInventoryNotFound<ItemTaxHistoryErrorDetail>(
            'Item tax history not found',
            'ith_id',
            `No item tax history found with id ${ithId}`,
          );
        }
        await tx.itemTaxHistory.delete({ where: { ithId } });
        await this.auditLogService.logEntityChange(
          {
            action: 'cancel',
            tableName: ITEM_TAX_HISTORY_TABLE_NAME,
            screenName: ITEM_TAX_HISTORY_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: ithId,
            displayName: this.buildDisplayName(existing),
            originalRecord: this.toPayload(existing),
            modifiedRecord: null,
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Item tax history deleted',
          },
          tx,
        );
        return { ith_id: ithId, deleted: true };
      });
    } catch (error: unknown) {
      this.handleDeleteError(error);
      throw error;
    }
  }

  private async createItemTaxHistory(
    saveItemTaxHistoryDto: SaveItemTaxHistoryDto,
  ): Promise<ItemTaxHistoryPayload> {
    const effectiveFrom = this.parseRequiredDate(
      saveItemTaxHistoryDto.ith_effective_from,
      'ith_effective_from',
    );
    const effectiveTo = this.parseOptionalDate(
      saveItemTaxHistoryDto.ith_effective_to,
      'ith_effective_to',
    );
    this.validateDateRange(effectiveFrom, effectiveTo);
    const createdBy = resolveActor(saveItemTaxHistoryDto.ith_created_by, this.requestContextService.getUserId());
    const data: Prisma.ItemTaxHistoryUncheckedCreateInput = {
      ithItemId: saveItemTaxHistoryDto.ith_item_id,
      ithTaxId: saveItemTaxHistoryDto.ith_tax_id,
      ithEffectiveFrom: effectiveFrom,
      ithCreatedOn: new Date(),
      ithCreatedBy: createdBy,
    };
    this.applyOptionalFields(data, saveItemTaxHistoryDto);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.itemTaxHistory.create({ data });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: ITEM_TAX_HISTORY_TABLE_NAME,
            screenName: ITEM_TAX_HISTORY_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.ith_id,
            displayName: this.buildDisplayName(created),
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'Item tax history created',
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

  private async updateItemTaxHistory(
    saveItemTaxHistoryDto: SaveItemTaxHistoryDto,
  ): Promise<ItemTaxHistoryPayload> {
    const ithId = saveItemTaxHistoryDto.ith_id!;
    const effectiveFrom = this.parseRequiredDate(
      saveItemTaxHistoryDto.ith_effective_from,
      'ith_effective_from',
    );
    const effectiveTo = this.parseOptionalDate(
      saveItemTaxHistoryDto.ith_effective_to,
      'ith_effective_to',
    );
    this.validateDateRange(effectiveFrom, effectiveTo);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.itemTaxHistory.findUnique({ where: { ithId } });
        if (!existing) {
          throwInventoryNotFound<ItemTaxHistoryErrorDetail>(
            'Item tax history not found',
            'ith_id',
            `No item tax history found with id ${ithId}`,
          );
        }
        const data: Prisma.ItemTaxHistoryUncheckedUpdateInput = {
          ithItemId: saveItemTaxHistoryDto.ith_item_id,
          ithTaxId: saveItemTaxHistoryDto.ith_tax_id,
          ithEffectiveFrom: effectiveFrom,
        };
        this.applyOptionalFields(data, saveItemTaxHistoryDto);
        const updated = await tx.itemTaxHistory.update({ where: { ithId }, data });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: ITEM_TAX_HISTORY_TABLE_NAME,
            screenName: ITEM_TAX_HISTORY_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: ithId,
            displayName: this.buildDisplayName(updated),
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Item tax history updated',
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
  private applyOptionalFields(
    data: Prisma.ItemTaxHistoryUncheckedCreateInput | Prisma.ItemTaxHistoryUncheckedUpdateInput,
    saveItemTaxHistoryDto: SaveItemTaxHistoryDto,
  ): void {
    if (hasOwnProperty(saveItemTaxHistoryDto, 'ith_effective_to')) {
      data.ithEffectiveTo = this.parseOptionalDate(
        saveItemTaxHistoryDto.ith_effective_to,
        'ith_effective_to',
      );
    }
    if (hasOwnProperty(saveItemTaxHistoryDto, 'ith_reason')) {
      data.ithReason = saveItemTaxHistoryDto.ith_reason;
    }
  }

  private parseRequiredDate(value: string, fieldName: string): Date {
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      throwInventoryBadRequest<ItemTaxHistoryErrorDetail>('Validation failed', [
        { field: fieldName, message: `${fieldName} must be a valid date` },
      ]);
    }
    return parsedDate;
  }

  private parseOptionalDate(
    value: string | null | undefined,
    fieldName: string,
  ): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    return this.parseRequiredDate(value, fieldName);
  }

  private validateDateRange(effectiveFrom: Date, effectiveTo: Date | null | undefined): void {
    if (!effectiveTo) return;
    if (effectiveFrom.getTime() > effectiveTo.getTime()) {
      throwInventoryBadRequest<ItemTaxHistoryErrorDetail>('Validation failed', [
        {
          field: 'ith_effective_to',
          message: 'ith_effective_to must be greater than or equal to ith_effective_from',
        },
      ]);
    }
  }

  private toPayload(record: ItemTaxHistory): ItemTaxHistoryPayload {
    return {
      ith_id: record.ithId,
      ith_item_id: record.ithItemId,
      ith_tax_id: record.ithTaxId,
      ith_effective_from: record.ithEffectiveFrom.toISOString(),
      ith_effective_to: record.ithEffectiveTo ? record.ithEffectiveTo.toISOString() : null,
      ith_reason: record.ithReason,
      ith_created_on: record.ithCreatedOn.toISOString(),
      ith_created_by: record.ithCreatedBy,
    };
  }

  private buildDisplayName(record: ItemTaxHistory): string {
    return `${record.ithItemId}:${record.ithTaxId}:${record.ithEffectiveFrom.toISOString().slice(0, 10)}`;
  }

  private handleWriteError(error: unknown): void {
    throwOnUniqueConstraintError<ItemTaxHistoryErrorDetail>(
      error,
      'Item tax history already exists',
      [{ field: 'ith_id', message: 'Duplicate item tax history is not allowed' }],
    );
    if (isForeignKeyConstraintError(error)) {
      throwInventoryBadRequest<ItemTaxHistoryErrorDetail>('Invalid relation reference', [
        { field: 'ith_item_id', message: 'Referenced item or tax does not exist' },
      ]);
    }
  }

  private handleDeleteError(error: unknown): void {
    if (isForeignKeyConstraintError(error)) {
      throwInventoryBadRequest<ItemTaxHistoryErrorDetail>('Cannot delete item tax history', [
        { field: 'ith_id', message: 'Item tax history is referenced by related records' },
      ]);
    }
  }
}
