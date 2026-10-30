import { Injectable } from '@nestjs/common';
import { Prisma, Unit } from '@prisma/client';
import { SaveUnitDto } from './dto/save-unit.dto';
import { UnitDetailPayload, UnitErrorDetail, UnitPayload } from './types/unit-api.types';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import {
  DEFAULT_ACTOR,
  hasOwnProperty,
  resolveActor,
  throwInventoryBadRequest,
  throwInventoryConflict,
  throwInventoryNotFound,
  throwOnUniqueConstraintError,
  toNullableNumber,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import {
  assertDeleteState,
  assertNoLiveReferences,
  type LiveReference,
} from '../utils/master-tree.helper';
import { UnitErrorCode } from './types/unit-error-codes';

const UNIT_TABLE_NAME = 'item_unit_master';
const UNIT_AUDIT_SCREEN_NAME = 'Units Master';
/**
 * What keeps a unit from being deleted (notes 70 C2): a pack unit built on it,
 * an item conversion using it (as the unit or as its base), an item whose base
 * unit it is. A deleted base unit used to leave its pack unit resolving the
 * deleted name on GET while dropdown 15 no longer listed it.
 */
const UNIT_REFERENCES: readonly LiveReference[] = [
  {
    table: 'inventory.item_unit_master',
    column: 'unit_base_unit_id',
    live: 'unit_is_deleted = false',
    label: 'pack units built on it',
  },
  {
    table: 'inventory.item_unit_conversion',
    column: 'iuc_unit_id',
    live: 'iuc_is_deleted = false',
    label: 'item unit conversions',
  },
  {
    table: 'inventory.item_unit_conversion',
    column: 'iuc_base_unit_id',
    live: 'iuc_is_deleted = false',
    label: 'item unit conversions (as their base unit)',
  },
  {
    table: 'inventory.item_master',
    column: 'item_base_unit_id',
    live: 'item_is_deleted = false',
    label: 'items (as their base unit)',
  },
  // A new item takes its group's / category's default unit (notes 70 D3).
  {
    table: 'inventory.item_group_master',
    column: 'itg_default_uom_id',
    live: 'itg_is_deleted = false',
    label: 'item groups (as their default unit)',
  },
  {
    table: 'inventory.item_category_master',
    column: 'category_default_uom_id',
    live: 'category_is_deleted = false',
    label: 'item categories (as their default unit)',
  },
];
const UNIT_DELETE_STATE = {
  label: 'unit',
  idField: 'unit_id',
  restoreRoute: '/units/restore',
  alreadyDeletedCode: UnitErrorCode.ALREADY_DELETED,
  notDeletedCode: UnitErrorCode.NOT_DELETED,
  inUseCode: UnitErrorCode.IN_USE,
};
/** A GST Unit Quantity Code: three capital letters (ck_unit_uqc). */
const UQC_PATTERN = /^[A-Z]{3}$/;

@Injectable()
export class UnitsMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async save(saveUnitDto: SaveUnitDto): Promise<UnitPayload> {
    if (saveUnitDto.unit_id) {
      return this.updateUnit(saveUnitDto);
    }
    return this.createUnit(saveUnitDto);
  }
  async getById(unitId: string): Promise<UnitDetailPayload> {
    const record = await this.prisma.unit.findFirst({
      where: { unit_id: unitId, unit_is_deleted: false },
      include: {
        baseUnit: { select: { unit_name: true } },
        gstUnit: { select: { itemGstUnitName: true } },
      },
    });
    if (!record) {
      throwInventoryNotFound<UnitErrorDetail>(
        'Unit not found',
        'unit_id',
        `No active unit found with id ${unitId}`,
        UnitErrorCode.NOT_FOUND,
      );
    }
    const payload = this.toPayload(
      record,
      record.baseUnit?.unit_name ?? null,
      record.gstUnit?.itemGstUnitName ?? null,
    );
    // Soft-delete/sync/audit columns are persisted but intentionally not exposed on GET.
    return {
      unit_id: payload.unit_id,
      unit_name: payload.unit_name,
      unit_alias: payload.unit_alias,
      unit_code: payload.unit_code,
      unit_code_name: payload.unit_code_name,
      unit_description: payload.unit_description,
      unit_decimal_count: payload.unit_decimal_count,
      unit_weight: payload.unit_weight,
      unit_loading: payload.unit_loading,
      unit_unloading: payload.unit_unloading,
      unit_attach_charge: payload.unit_attach_charge,
      unit_is_pack_unit: payload.unit_is_pack_unit,
      unit_base_unit_id: payload.unit_base_unit_id,
      unit_base_unit_name: payload.unit_base_unit_name,
      unit_conversion: payload.unit_conversion,
      unit_is_active: payload.unit_is_active,
    };
  }
  /**
   * DELETE deletes — it is no longer a toggle (notes 70 C1): an already
   * deleted unit is a 409, and POST /units/restore brings one back. Refused
   * (409) while a pack unit, an item conversion or an item still uses it (C2).
   */
  async softDelete(unitId: string): Promise<{ unit_id: string; deleted: boolean }> {
    return this.setDeleted(unitId, true);
  }
  /** Restore a deleted unit. Refused (409) when it is not deleted, or its base unit is. */
  async restore(unitId: string): Promise<{ unit_id: string; deleted: boolean }> {
    return this.setDeleted(unitId, false);
  }
  private async setDeleted(
    unitId: string,
    wantDeleted: boolean,
  ): Promise<{ unit_id: string; deleted: boolean }> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Find regardless of current deleted state
        const existing = await tx.unit.findFirst({
          where: { unit_id: unitId },
        });
        if (!existing) {
          throwInventoryNotFound<UnitErrorDetail>(
            'Unit not found',
            'unit_id',
            `No unit found with id ${unitId}`,
            UnitErrorCode.NOT_FOUND,
          );
        }
        assertDeleteState(existing.unit_is_deleted, wantDeleted, UNIT_DELETE_STATE);
        if (wantDeleted) {
          await assertNoLiveReferences(tx, UNIT_REFERENCES, unitId, UNIT_DELETE_STATE);
        } else {
          await this.assertNameFree(tx, existing.unit_name, unitId);
        }
        if (!wantDeleted && existing.unit_base_unit_id) {
          const base = await tx.unit.findFirst({
            where: { unit_id: existing.unit_base_unit_id, unit_is_deleted: false },
            select: { unit_id: true },
          });
          if (!base) {
            throwInventoryConflict<UnitErrorDetail>('The base unit is deleted', [
              {
                field: 'unit_base_unit_id',
                code: UnitErrorCode.BASE_DELETED,
                message: `Restore base unit ${existing.unit_base_unit_id} first.`,
              },
            ]);
          }
        }
        const wasDeleted = existing.unit_is_deleted;
        const nextDeleted = wantDeleted;
        const modifiedOn = new Date();
        const userId = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
        // Guarded update: only flips if state hasn't changed since the read
        const result = await tx.unit.updateMany({
          where: { unit_id: unitId, unit_is_deleted: wasDeleted },
          data: {
            unit_is_deleted: nextDeleted,
            unit_modified_on: modifiedOn,
            unit_modified_by: userId,
          },
        });
        if (result.count === 0) {
          throwInventoryNotFound<UnitErrorDetail>(
            'Unit not found',
            'unit_id',
            `No unit found with id ${unitId}`,
            UnitErrorCode.NOT_FOUND,
          );
        }
        const originalRecord = this.toPayload(existing);
        const modifiedRecord = this.toPayload({
          ...existing,
          unit_is_deleted: nextDeleted,
          unit_modified_on: modifiedOn,
          unit_modified_by: userId,
        });
        await this.auditLogService.logEntityChange(
          {
            action: nextDeleted ? 'cancel' : 'update',
            tableName: UNIT_TABLE_NAME,
            screenName: UNIT_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: unitId,
            displayName: existing.unit_name,
            originalRecord,
            modifiedRecord,
            userId,
            notes: nextDeleted ? 'Unit soft deleted' : 'Unit restored',
          },
          tx,
        );
        return { unit_id: unitId, deleted: nextDeleted };
      });
    } catch (error: unknown) {
      // A restore whose name a live unit took meanwhile (names of deleted units
      // are free since notes 139 A2).
      this.handleWriteError(error);
      throw error;
    }
  }
  private async createUnit(saveUnitDto: SaveUnitDto): Promise<UnitPayload> {
    const baseUnitId = saveUnitDto.unit_base_unit_id ?? null;
    const conversion = saveUnitDto.unit_conversion ?? null;
    this.validateConversionRules(baseUnitId, conversion);
    this.validatePackRule(saveUnitDto.unit_is_pack_unit ?? false, baseUnitId);
    const now = new Date();
    const createdBy = resolveActor(
      saveUnitDto.unit_created_by,
      this.requestContextService.getUserId(),
    );
    const data: Prisma.UnitUncheckedCreateInput = {
      unit_name: saveUnitDto.unit_name.trim(),
      unit_created_on: now,
      unit_created_by: createdBy,
    };
    this.applyOptionalFields(data, saveUnitDto);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertReferences(tx, saveUnitDto, null);
        await this.assertNameFree(tx, data.unit_name, null);
        const created = await tx.unit.create({ data });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: UNIT_TABLE_NAME,
            screenName: UNIT_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.unit_id,
            displayName: payload.unit_name,
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'Unit created',
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
  private async updateUnit(saveUnitDto: SaveUnitDto): Promise<UnitPayload> {
    const unitId = saveUnitDto.unit_id!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.unit.findFirst({
          where: { unit_id: unitId, unit_is_deleted: false },
        });
        if (!existing) {
          throwInventoryNotFound<UnitErrorDetail>(
            'Unit not found',
            'unit_id',
            `No active unit found with id ${unitId}`,
            UnitErrorCode.NOT_FOUND,
          );
        }
        // `!== undefined`, not hasOwnProperty: every declared DTO field is an
        // own property (ES2022 class fields), so an omitted base unit or
        // conversion was validated as a cleared one. An explicit null clears.
        const baseUnitId =
          saveUnitDto.unit_base_unit_id !== undefined
            ? (saveUnitDto.unit_base_unit_id ?? null)
            : existing.unit_base_unit_id;
        const conversion =
          saveUnitDto.unit_conversion !== undefined
            ? (saveUnitDto.unit_conversion ?? null)
            : toNullableNumber(existing.unit_conversion);
        if (baseUnitId !== null && baseUnitId === unitId) {
          throwInventoryBadRequest<UnitErrorDetail>('Validation error', [
            {
              field: 'unit_base_unit_id',
              code: UnitErrorCode.SELF_BASE,
              message: 'unit_base_unit_id cannot be same as unit_id',
            },
          ]);
        }
        this.validateConversionRules(baseUnitId, conversion);
        this.validatePackRule(
          saveUnitDto.unit_is_pack_unit ?? existing.unit_is_pack_unit,
          baseUnitId,
        );
        await this.assertReferences(tx, saveUnitDto, existing);
        const unitName = saveUnitDto.unit_name.trim();
        // Only a new spelling is checked: the box holds "Box" and "BOX" as two
        // live units, and either must stay editable until they are merged.
        if (unitName.toLowerCase() !== existing.unit_name.toLowerCase()) {
          await this.assertNameFree(tx, unitName, unitId);
        }
        const data: Prisma.UnitUncheckedUpdateInput = {
          unit_name: unitName,
          unit_modified_on: new Date(),
          unit_modified_by: resolveActor(
            saveUnitDto.unit_modified_by,
            this.requestContextService.getUserId(),
          ),
        };
        this.applyOptionalFields(data, saveUnitDto);
        const updated = await tx.unit.update({ where: { unit_id: unitId }, data });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: UNIT_TABLE_NAME,
            screenName: UNIT_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: unitId,
            displayName: payload.unit_name,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.unit_modified_by,
            notes: 'Unit updated',
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
  private validateConversionRules(baseUnitId: string | null, conversion: number | null): void {
    if (baseUnitId !== null) {
      if (conversion === null || conversion === undefined) {
        throwInventoryBadRequest<UnitErrorDetail>('Validation error', [
          {
            field: 'unit_conversion',
            code: UnitErrorCode.TO_BASE_REQUIRED,
            message: 'unit_conversion is required when unit_base_unit_id is set',
          },
        ]);
      }
      if (Number(conversion) <= 0) {
        throwInventoryBadRequest<UnitErrorDetail>('Validation error', [
          {
            field: 'unit_conversion',
            code: UnitErrorCode.TO_BASE_NOT_POSITIVE,
            message: 'unit_conversion must be greater than 0',
          },
        ]);
      }
    }
  }
  /** Notes 139 B5 — a pack unit is a count of its base unit, so it needs one. */
  private validatePackRule(isPackUnit: boolean, baseUnitId: string | null): void {
    if (isPackUnit && baseUnitId === null) {
      throwInventoryBadRequest<UnitErrorDetail>('Validation error', [
        {
          field: 'unit_is_pack_unit',
          code: UnitErrorCode.PACK_BASE_REQUIRED,
          message: 'A pack unit needs unit_base_unit_id and unit_conversion.',
        },
      ]);
    }
  }
  /**
   * Notes 139 A3 — the GST unit code and the base unit named must exist; their
   * foreign keys used to answer an unknown one with a 500. A value the row
   * already holds is not re-checked.
   */
  private async assertReferences(
    tx: Prisma.TransactionClient,
    saveUnitDto: SaveUnitDto,
    existing: Unit | null,
  ): Promise<void> {
    const code = saveUnitDto.unit_code;
    if (code && code !== existing?.unit_code) {
      const gstUnit = await tx.itemGstUnits.findUnique({
        where: { itemGstUnitCode: code },
        select: { itemGstUnitId: true },
      });
      if (!gstUnit) {
        throwInventoryBadRequest<UnitErrorDetail>('Validation error', [
          {
            field: 'unit_code',
            code: UnitErrorCode.CODE_NOT_FOUND,
            message: `No GST unit has the code "${code}".`,
          },
        ]);
      }
    }
    const baseUnitId = saveUnitDto.unit_base_unit_id;
    if (baseUnitId && baseUnitId !== existing?.unit_base_unit_id) {
      const base = await tx.unit.findFirst({
        where: { unit_id: baseUnitId, unit_is_deleted: false },
        select: { unit_id: true },
      });
      if (!base) {
        throwInventoryBadRequest<UnitErrorDetail>('Validation error', [
          {
            field: 'unit_base_unit_id',
            code: UnitErrorCode.BASE_NOT_FOUND,
            message: `No live unit has the id ${baseUnitId}.`,
          },
        ]);
      }
    }
  }
  /**
   * Notes 139 B6 — a unit name is unique among live units ignoring case.
   * uq_unit_name only covers the exact spelling until the box's "Box" / "BOX"
   * pair is merged, so the rest is checked here, under a lock on the folded
   * name so two saves of "Kg" and "KG" cannot both pass.
   */
  private async assertNameFree(
    tx: Prisma.TransactionClient,
    unitName: string,
    unitId: string | null,
  ): Promise<void> {
    const folded = unitName.toLowerCase();
    await tx.$queryRaw`
      SELECT count(pg_advisory_xact_lock(hashtext('inventory.item_unit_master.unit_name'), hashtext(${folded})))::int AS locked
    `;
    const [clash] = await tx.$queryRaw<Array<{ unit_id: string; unit_name: string }>>`
      SELECT unit_id::text, unit_name
        FROM inventory.item_unit_master
       WHERE lower(unit_name) = ${folded}
         AND unit_is_deleted = false
         AND (${unitId}::uuid IS NULL OR unit_id <> ${unitId}::uuid)
       LIMIT 1
    `;
    if (clash) {
      throwInventoryConflict<UnitErrorDetail>('Unit name already exists', [
        {
          field: 'unit_name',
          code: UnitErrorCode.NAME_TAKEN,
          message: `Unit "${clash.unit_name}" (${clash.unit_id}) already has this name.`,
        },
      ]);
    }
  }
  private applyOptionalFields(
    data: Prisma.UnitUncheckedCreateInput | Prisma.UnitUncheckedUpdateInput,
    saveUnitDto: SaveUnitDto,
  ): void {
    if (hasOwnProperty(saveUnitDto, 'unit_alias')) data.unit_alias = saveUnitDto.unit_alias;
    if (hasOwnProperty(saveUnitDto, 'unit_code')) {
      data.unit_code = saveUnitDto.unit_code;
      // D1 — unit_code IS the UQC (an FK to item_gst_units). unit_uqc is kept as
      // its derived copy for the e-invoice / GSTR-1 readers that name it, never
      // set on its own, so the two columns cannot disagree.
      if (saveUnitDto.unit_code !== undefined) {
        const code = saveUnitDto.unit_code?.trim().toUpperCase() ?? '';
        data.unitUqc = UQC_PATTERN.test(code) ? code : null;
      }
    }
    if (hasOwnProperty(saveUnitDto, 'unit_description'))
      data.unit_description = saveUnitDto.unit_description;
    if (hasOwnProperty(saveUnitDto, 'unit_decimal_count'))
      data.unit_decimal_count = saveUnitDto.unit_decimal_count;
    if (hasOwnProperty(saveUnitDto, 'unit_weight')) data.unit_weight = saveUnitDto.unit_weight;
    if (hasOwnProperty(saveUnitDto, 'unit_loading')) data.unit_loading = saveUnitDto.unit_loading;
    if (hasOwnProperty(saveUnitDto, 'unit_unloading'))
      data.unit_unloading = saveUnitDto.unit_unloading;
    if (hasOwnProperty(saveUnitDto, 'unit_attach_charge'))
      data.unit_attach_charge = saveUnitDto.unit_attach_charge;
    if (hasOwnProperty(saveUnitDto, 'unit_is_pack_unit'))
      data.unit_is_pack_unit = saveUnitDto.unit_is_pack_unit;
    if (hasOwnProperty(saveUnitDto, 'unit_base_unit_id'))
      data.unit_base_unit_id = saveUnitDto.unit_base_unit_id;
    if (hasOwnProperty(saveUnitDto, 'unit_conversion'))
      data.unit_conversion = saveUnitDto.unit_conversion;
    if (hasOwnProperty(saveUnitDto, 'unit_is_active'))
      data.unit_is_active = saveUnitDto.unit_is_active;
  }

  private toPayload(
    record: Unit,
    baseUnitName: string | null = null,
    unitCodeName: string | null = null,
  ): UnitPayload {
    return {
      unit_id: record.unit_id,
      unit_name: record.unit_name,
      unit_alias: record.unit_alias,
      unit_code: record.unit_code,
      unit_code_name: unitCodeName,
      unit_description: record.unit_description,
      unit_decimal_count: record.unit_decimal_count,
      unit_weight: toNullableNumber(record.unit_weight),
      unit_loading: toNullableNumber(record.unit_loading),
      unit_unloading: toNullableNumber(record.unit_unloading),
      unit_attach_charge: toNullableNumber(record.unit_attach_charge),
      unit_is_pack_unit: record.unit_is_pack_unit,
      unit_base_unit_id: record.unit_base_unit_id,
      unit_base_unit_name: baseUnitName,
      unit_conversion: toNullableNumber(record.unit_conversion),
      unit_is_active: record.unit_is_active,
      unit_is_deleted: record.unit_is_deleted,
      unit_sync_date: record.unit_sync_date ? record.unit_sync_date.toISOString() : null,
      unit_created_on: record.unit_created_on.toISOString(),
      unit_created_by: record.unit_created_by,
      unit_modified_on: record.unit_modified_on.toISOString(),
      unit_modified_by: record.unit_modified_by,
    };
  }

  private handleWriteError(error: unknown): void {
    throwOnUniqueConstraintError<UnitErrorDetail>(error, 'Unit name already exists', [
      {
        field: 'unit_name',
        code: UnitErrorCode.NAME_TAKEN,
        message: 'Duplicate unit_name is not allowed',
      },
    ]);
  }
}
