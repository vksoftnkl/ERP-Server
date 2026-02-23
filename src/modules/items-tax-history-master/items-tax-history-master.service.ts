import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ItemTaxHistory, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ListItemTaxHistoryQueryDto } from './dto/list-item-tax-history-query.dto';
import { SaveItemTaxHistoryDto } from './dto/save-item-tax-history.dto';
import {
  ItemTaxHistoryErrorDetail,
  ItemTaxHistoryErrorResponse,
  ItemTaxHistoryListItem,
  ItemTaxHistoryListMeta,
  ItemTaxHistoryPayload,
} from './types/item-tax-history-api.types';

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const VALIDATION_FAILED_MESSAGE = 'Validation failed';
const ITEM_TAX_HISTORY_TABLE_NAME = 'item_tax_history';
const ITEM_TAX_HISTORY_AUDIT_SCREEN_NAME = 'Item Tax History';

@Injectable()
export class ItemsTaxHistoryMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async save(saveItemTaxHistoryDto: SaveItemTaxHistoryDto): Promise<ItemTaxHistoryPayload> {
    if (saveItemTaxHistoryDto.ith_id) {
      return this.updateItemTaxHistory(saveItemTaxHistoryDto);
    }

    return this.createItemTaxHistory(saveItemTaxHistoryDto);
  }

  async list(
    queryDto: ListItemTaxHistoryQueryDto,
  ): Promise<{ items: ItemTaxHistoryListItem[]; meta: ItemTaxHistoryListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const where = this.buildListWhere(queryDto);
    const [total, records] = await Promise.all([
      this.prisma.itemTaxHistory.count({ where }),
      this.prisma.itemTaxHistory.findMany({
        where,
        orderBy: [{ ithEffectiveFrom: 'desc' }, { ithId: 'desc' }],
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

  async getById(ithId: string): Promise<ItemTaxHistoryPayload> {
    const record = await this.prisma.itemTaxHistory.findUnique({
      where: {
        ithId,
      },
    });

    if (!record) {
      this.throwNotFound(ithId);
    }

    return this.toPayload(record);
  }

  async delete(ithId: string): Promise<{ ith_id: string; deleted: true }> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.itemTaxHistory.findUnique({
          where: {
            ithId,
          },
        });
        if (!existing) {
          this.throwNotFound(ithId);
        }

        await tx.itemTaxHistory.delete({
          where: {
            ithId,
          },
        });

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
            userId: DEFAULT_ACTOR,
            notes: 'Item tax history deleted',
          },
          tx,
        );

        return {
          ith_id: ithId,
          deleted: true,
        };
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

    const createdBy = this.resolveActor(saveItemTaxHistoryDto.ith_created_by);
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
        const existing = await tx.itemTaxHistory.findUnique({
          where: {
            ithId,
          },
        });
        if (!existing) {
          this.throwNotFound(ithId);
        }

        const data: Prisma.ItemTaxHistoryUncheckedUpdateInput = {
          ithItemId: saveItemTaxHistoryDto.ith_item_id,
          ithTaxId: saveItemTaxHistoryDto.ith_tax_id,
          ithEffectiveFrom: effectiveFrom,
        };
        this.applyOptionalFields(data, saveItemTaxHistoryDto);

        const updated = await tx.itemTaxHistory.update({
          where: {
            ithId,
          },
          data,
        });

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
            userId: DEFAULT_ACTOR,
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

  private buildListWhere(queryDto: ListItemTaxHistoryQueryDto): Prisma.ItemTaxHistoryWhereInput {
    const where: Prisma.ItemTaxHistoryWhereInput = {};

    if (queryDto.ith_item_id !== undefined) {
      where.ithItemId = queryDto.ith_item_id;
    }

    if (queryDto.ith_tax_id !== undefined) {
      where.ithTaxId = queryDto.ith_tax_id;
    }

    if (queryDto.ith_effective_from !== undefined) {
      where.ithEffectiveFrom = this.parseRequiredDate(
        queryDto.ith_effective_from,
        'ith_effective_from',
      );
    }

    if (queryDto.ith_effective_to !== undefined) {
      where.ithEffectiveTo = this.parseRequiredDate(queryDto.ith_effective_to, 'ith_effective_to');
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [{ ithReason: { contains: search, mode: 'insensitive' } }];
    }

    return where;
  }

  private applyOptionalFields(
    data: Prisma.ItemTaxHistoryUncheckedCreateInput | Prisma.ItemTaxHistoryUncheckedUpdateInput,
    saveItemTaxHistoryDto: SaveItemTaxHistoryDto,
  ): void {
    if (this.hasOwnProperty(saveItemTaxHistoryDto, 'ith_effective_to')) {
      data.ithEffectiveTo = this.parseOptionalDate(
        saveItemTaxHistoryDto.ith_effective_to,
        'ith_effective_to',
      );
    }

    if (this.hasOwnProperty(saveItemTaxHistoryDto, 'ith_reason')) {
      data.ithReason = saveItemTaxHistoryDto.ith_reason;
    }
  }

  private parseRequiredDate(value: string, fieldName: string): Date {
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: fieldName,
          message: `${fieldName} must be a valid date`,
        },
      ]);
    }

    return parsedDate;
  }

  private parseOptionalDate(
    value: string | null | undefined,
    fieldName: string,
  ): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    return this.parseRequiredDate(value, fieldName);
  }

  private validateDateRange(effectiveFrom: Date, effectiveTo: Date | null | undefined): void {
    if (!effectiveTo) {
      return;
    }

    if (effectiveFrom.getTime() > effectiveTo.getTime()) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
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

  private resolveActor(value: string | null | undefined, fallback = DEFAULT_ACTOR): string {
    const trimmed = value?.trim();
    return trimmed || fallback;
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Item tax history already exists', [
          {
            field: 'ith_id',
            message: 'Duplicate item tax history is not allowed',
          },
        ]),
      );
    }

    if (this.isForeignKeyConstraintError(error)) {
      throw new BadRequestException(
        this.buildErrorResponse('Invalid relation reference', [
          {
            field: 'ith_item_id',
            message: 'Referenced item or tax does not exist',
          },
        ]),
      );
    }
  }

  private handleDeleteError(error: unknown): void {
    if (this.isForeignKeyConstraintError(error)) {
      throw new BadRequestException(
        this.buildErrorResponse('Cannot delete item tax history', [
          {
            field: 'ith_id',
            message: 'Item tax history is referenced by related records',
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

  private isForeignKeyConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }

    return (error as { code?: string }).code === 'P2003';
  }

  private throwNotFound(ithId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Item tax history not found', [
        {
          field: 'ith_id',
          message: `No item tax history found with id ${ithId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: ItemTaxHistoryErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: ItemTaxHistoryErrorDetail[] = [],
  ): ItemTaxHistoryErrorResponse {
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
