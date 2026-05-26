import { Injectable } from '@nestjs/common';
import { ItemEanCode, Prisma } from '@prisma/client';
import { SaveItemEanCodeDto } from './dto/save-item-ean-code.dto';
import {
  ItemEanCodeDeleteResult,
  ItemEanCodeErrorDetail,
  ItemEanCodePayload,
} from './types/item-ean-code-api.types';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import {
  DEFAULT_ACTOR,
  hasOwnProperty,
  isForeignKeyConstraintError,
  resolveActor,
  throwInventoryBadRequest,
  throwInventoryNotFound,
  throwOnUniqueConstraintError,
} from 'src/common/utils/module-service.utils';
const ITEM_EAN_CODE_TABLE_NAME = 'item ean codes';
const ITEM_EAN_CODE_AUDIT_SCREEN_NAME = 'Item EAN Code Master';

@Injectable()
export class ItemsEanCodeMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async save(saveItemEanCodeDto: SaveItemEanCodeDto): Promise<ItemEanCodePayload>;
  async save(saveItemEanCodeDto: SaveItemEanCodeDto[]): Promise<ItemEanCodePayload[]>;
  async save(
    saveItemEanCodeDto: SaveItemEanCodeDto | SaveItemEanCodeDto[],
  ): Promise<ItemEanCodePayload | ItemEanCodePayload[]>;
  async save(
    saveItemEanCodeDto: SaveItemEanCodeDto | SaveItemEanCodeDto[],
  ): Promise<ItemEanCodePayload | ItemEanCodePayload[]> {
    const saveItems = Array.isArray(saveItemEanCodeDto) ? saveItemEanCodeDto : [saveItemEanCodeDto];

    try {
      const results = await this.prisma.$transaction(async (tx) => {
        const savedItems: ItemEanCodePayload[] = [];

        for (const saveItem of saveItems) {
          savedItems.push(await this.saveItemEanCode(tx, saveItem));
        }

        return savedItems;
      });

      return Array.isArray(saveItemEanCodeDto) ? results : results[0];
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }
  async getById(eanId: string): Promise<ItemEanCodePayload> {
    const record = await this.prisma.itemEanCode.findFirst({
      where: {
        eanId,
        eanIsDeleted: false,
      },
    });

    if (!record) {
      throwInventoryNotFound<ItemEanCodeErrorDetail>(
        'Item EAN code not found',
        'ean_id',
        `No active item EAN code found with id ${eanId}`,
      );
    }

    return this.toPayload(record);
  }

  async softDelete(eanId: string): Promise<ItemEanCodeDeleteResult>;
  async softDelete(eanId: string[]): Promise<ItemEanCodeDeleteResult[]>;
  async softDelete(
    eanId: string | string[],
  ): Promise<ItemEanCodeDeleteResult | ItemEanCodeDeleteResult[]>;
  async softDelete(
    eanId: string | string[],
  ): Promise<ItemEanCodeDeleteResult | ItemEanCodeDeleteResult[]> {
    const deleteIds = Array.isArray(eanId) ? eanId : [eanId];

    const results = await this.prisma.$transaction(async (tx) => {
      const deletedItems: ItemEanCodeDeleteResult[] = [];

      for (const deleteId of deleteIds) {
        deletedItems.push(await this.softDeleteItemEanCode(tx, deleteId));
      }

      return deletedItems;
    });

    return Array.isArray(eanId) ? results : results[0];
  }

  private async saveItemEanCode(
    tx: Prisma.TransactionClient,
    saveItemEanCodeDto: SaveItemEanCodeDto,
  ): Promise<ItemEanCodePayload> {
    if (saveItemEanCodeDto.ean_id) {
      return this.updateItemEanCode(tx, saveItemEanCodeDto);
    }

    return this.createItemEanCode(tx, saveItemEanCodeDto);
  }

  private async softDeleteItemEanCode(
    tx: Prisma.TransactionClient,
    eanId: string,
  ): Promise<ItemEanCodeDeleteResult> {
    const existing = await tx.itemEanCode.findFirst({
      where: {
        eanId,
        eanIsDeleted: false,
      },
    });
    if (!existing) {
      throwInventoryNotFound<ItemEanCodeErrorDetail>(
        'Item EAN code not found',
        'ean_id',
        `No active item EAN code found with id ${eanId}`,
      );
    }

    const modifiedOn = new Date();
    const modifiedBy = DEFAULT_ACTOR;
    const result = await tx.itemEanCode.updateMany({
      where: {
        eanId,
        eanIsDeleted: false,
      },
      data: {
        eanIsDeleted: true,
        eanModifiedOn: modifiedOn,
        eanModifiedBy: modifiedBy,
      },
    });
    if (result.count === 0) {
      throwInventoryNotFound<ItemEanCodeErrorDetail>(
        'Item EAN code not found',
        'ean_id',
        `No active item EAN code found with id ${eanId}`,
      );
    }

    const originalRecord = this.toPayload(existing);
    const modifiedRecord = this.toPayload({
      ...existing,
      eanIsDeleted: true,
      eanModifiedOn: modifiedOn,
      eanModifiedBy: modifiedBy,
    });
    await this.auditLogService.logEntityChange(
      {
        action: 'cancel',
        tableName: ITEM_EAN_CODE_TABLE_NAME,
        screenName: ITEM_EAN_CODE_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: eanId,
        displayName: existing.eanCode,
        originalRecord,
        modifiedRecord,
        userId: modifiedBy,
        notes: 'Item EAN code soft deleted',
      },
      tx,
    );

    return {
      ean_id: eanId,
      deleted: true,
    };
  }

  private async createItemEanCode(
    tx: Prisma.TransactionClient,
    saveItemEanCodeDto: SaveItemEanCodeDto,
  ): Promise<ItemEanCodePayload> {
    const eanCode = saveItemEanCodeDto.ean_code?.trim();
    if (!eanCode) {
      throwInventoryBadRequest<ItemEanCodeErrorDetail>('Validation failed', [
        {
          field: 'ean_code',
          message: 'ean_code is required',
        },
      ]);
    }

    const now = new Date();
    const createdBy = resolveActor(saveItemEanCodeDto.ean_created_by);
    const modifiedBy = resolveActor(saveItemEanCodeDto.ean_modified_by, createdBy);
    const data: Prisma.ItemEanCodeUncheckedCreateInput = {
      eanItemId: saveItemEanCodeDto.ean_item_id,
      eanUnitId: saveItemEanCodeDto.ean_unit_id,
      eanCode,
      eanCreatedOn: now,
      eanCreatedBy: createdBy,
      eanModifiedOn: now,
      eanModifiedBy: modifiedBy,
    };
    this.applyOptionalFields(data, saveItemEanCodeDto);

    const created = await tx.itemEanCode.create({ data });
    await this.enforceSingleDefaultInScope(tx, created, created.eanModifiedBy ?? modifiedBy);

    const payload = this.toPayload(created);
    await this.auditLogService.logEntityChange(
      {
        action: 'New',
        tableName: ITEM_EAN_CODE_TABLE_NAME,
        screenName: ITEM_EAN_CODE_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: payload.ean_id,
        displayName: payload.ean_code,
        originalRecord: null,
        modifiedRecord: payload,
        userId: createdBy,
        notes: 'Item EAN code created',
      },
      tx,
    );

    return payload;
  }

  private async updateItemEanCode(
    tx: Prisma.TransactionClient,
    saveItemEanCodeDto: SaveItemEanCodeDto,
  ): Promise<ItemEanCodePayload> {
    const eanId = saveItemEanCodeDto.ean_id!;

    const existing = await tx.itemEanCode.findFirst({
      where: {
        eanId,
        eanIsDeleted: false,
      },
    });
    if (!existing) {
      throwInventoryNotFound<ItemEanCodeErrorDetail>(
        'Item EAN code not found',
        'ean_id',
        `No active item EAN code found with id ${eanId}`,
      );
    }

    const eanCode = saveItemEanCodeDto.ean_code?.trim();
    if (!eanCode) {
      throwInventoryBadRequest<ItemEanCodeErrorDetail>('Validation failed', [
        {
          field: 'ean_code',
          message: 'ean_code cannot be empty',
        },
      ]);
    }

    const data: Prisma.ItemEanCodeUncheckedUpdateInput = {
      eanItemId: saveItemEanCodeDto.ean_item_id,
      eanUnitId: saveItemEanCodeDto.ean_unit_id,
      eanCode,
      eanModifiedOn: new Date(),
      eanModifiedBy: resolveActor(saveItemEanCodeDto.ean_modified_by),
    };
    this.applyOptionalFields(data, saveItemEanCodeDto);

    const updated = await tx.itemEanCode.update({
      where: {
        eanId,
      },
      data,
    });

    await this.enforceSingleDefaultInScope(tx, updated, updated.eanModifiedBy ?? DEFAULT_ACTOR);

    const payload = this.toPayload(updated);
    await this.auditLogService.logEntityChange(
      {
        action: 'update',
        tableName: ITEM_EAN_CODE_TABLE_NAME,
        screenName: ITEM_EAN_CODE_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: eanId,
        displayName: payload.ean_code,
        originalRecord: this.toPayload(existing),
        modifiedRecord: payload,
        userId: payload.ean_modified_by ?? DEFAULT_ACTOR,
        notes: 'Item EAN code updated',
      },
      tx,
    );

    return payload;
  }
  private applyOptionalFields(
    data: Prisma.ItemEanCodeUncheckedCreateInput | Prisma.ItemEanCodeUncheckedUpdateInput,
    saveItemEanCodeDto: SaveItemEanCodeDto,
  ): void {
    if (hasOwnProperty(saveItemEanCodeDto, 'ean_godown_id')) {
      data.eanGodownId = saveItemEanCodeDto.ean_godown_id;
    }

    if (hasOwnProperty(saveItemEanCodeDto, 'ean_is_default')) {
      data.eanIsDefault = saveItemEanCodeDto.ean_is_default;
    }

    if (hasOwnProperty(saveItemEanCodeDto, 'ean_is_active')) {
      data.eanIsActive = saveItemEanCodeDto.ean_is_active;
    }

    if (hasOwnProperty(saveItemEanCodeDto, 'ean_remarks')) {
      data.eanRemarks = saveItemEanCodeDto.ean_remarks;
    }
  }

  private async enforceSingleDefaultInScope(
    tx: Prisma.TransactionClient,
    record: ItemEanCode,
    actor: string,
  ): Promise<void> {
    if (!record.eanIsDefault) {
      return;
    }

    await tx.itemEanCode.updateMany({
      where: {
        eanItemId: record.eanItemId,
        eanUnitId: record.eanUnitId,
        eanGodownId: record.eanGodownId,
        eanIsDeleted: false,
        eanIsDefault: true,
        eanId: {
          not: record.eanId,
        },
      },
      data: {
        eanIsDefault: false,
        eanModifiedOn: new Date(),
        eanModifiedBy: actor,
      },
    });
  }

  private toPayload(record: ItemEanCode): ItemEanCodePayload {
    return {
      ean_id: record.eanId,
      ean_item_id: record.eanItemId,
      ean_unit_id: record.eanUnitId,
      ean_code: record.eanCode,
      ean_godown_id: record.eanGodownId,
      ean_is_default: record.eanIsDefault,
      ean_is_active: record.eanIsActive,
      ean_is_deleted: record.eanIsDeleted,
      ean_created_on: record.eanCreatedOn.toISOString(),
      ean_created_by: record.eanCreatedBy,
      ean_modified_on: record.eanModifiedOn.toISOString(),
      ean_modified_by: record.eanModifiedBy,
      ean_remarks: record.eanRemarks,
    };
  }

  private handleWriteError(error: unknown): void {
    throwOnUniqueConstraintError<ItemEanCodeErrorDetail>(error, 'EAN code already exists', [
      { field: 'ean_code', message: 'Duplicate ean_code is not allowed' },
    ]);
    if (isForeignKeyConstraintError(error)) {
      throwInventoryBadRequest<ItemEanCodeErrorDetail>('Invalid relation reference', [
        { field: 'ean_unit_id', message: 'Referenced relation does not exist' },
      ]);
    }
  }
}
