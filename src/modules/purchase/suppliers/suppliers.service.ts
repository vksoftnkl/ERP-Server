import { Injectable } from '@nestjs/common';
import { Prisma, Supplier } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveSupplierDto } from './dto/save-supplier.dto';
import {
  SupplierPayload,
} from './types/supplier-api.types';
import {
  DEFAULT_ACTOR,
  PurchaseWriteClient,
  hasOwnProperty,
  normalizeRequiredText,
  resolveActor,
  throwOnUniqueConstraintError,
  throwPurchaseBadRequest,
  throwPurchaseConflict,
  throwPurchaseNotFound,
  toNumber,
} from 'src/common/utils/module-service.utils';

const SUPPLIER_TABLE_NAME = 'suppliers';
const SUPPLIER_AUDIT_SCREEN_NAME = 'Supplier Master';

type SupplierWriteClient = PurchaseWriteClient;

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async save(saveSupplierDto: SaveSupplierDto): Promise<SupplierPayload> {
    if (saveSupplierDto.supId) {
      return this.updateSupplier(saveSupplierDto);
    }
    return this.createSupplier(saveSupplierDto);
  }

  async getById(supId: string): Promise<SupplierPayload> {
    const record = await this.prisma.supplier.findFirst({
      where: { supId, supIsDeleted: false },
    });
    if (!record) {
      throwPurchaseNotFound('Supplier not found', 'supId', `No active supplier found with id ${supId}`);
    }
    return this.toPayload(record);
  }

  async softDelete(supId: string): Promise<{ supId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.supplier.findFirst({
        where: { supId, supIsDeleted: false },
      });
      if (!existing) {
        throwPurchaseNotFound('Supplier not found', 'supId', `No active supplier found with id ${supId}`);
      }
      const modifiedOn = new Date();
      const result = await tx.supplier.updateMany({
        where: { supId, supIsDeleted: false },
        data: { supIsDeleted: true, supIsActive: false, supModifiedOn: modifiedOn, supModifiedBy: DEFAULT_ACTOR },
      });
      if (result.count === 0) {
        throwPurchaseNotFound('Supplier not found', 'supId', `No active supplier found with id ${supId}`);
      }
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        supIsDeleted: true,
        supIsActive: false,
        supModifiedOn: modifiedOn,
        supModifiedBy: DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: SUPPLIER_TABLE_NAME,
          screenName: SUPPLIER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: supId,
          displayName: existing.supName,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'Supplier soft deleted',
        },
        tx,
      );
      return { supId, deleted: true };
    });
  }

  private async createSupplier(saveSupplierDto: SaveSupplierDto): Promise<SupplierPayload> {
    const normalizedName = normalizeRequiredText(saveSupplierDto.supName, 'supName');
    const normalizedPurchaseType = normalizeRequiredText(saveSupplierDto.supPurchaseType, 'supPurchaseType');
    const normalizedStateName = normalizeRequiredText(saveSupplierDto.supStateName, 'supStateName');
    const normalizedStateCode = this.normalizeStateCode(saveSupplierDto.supStateCode);
    const normalizedGstType = normalizeRequiredText(saveSupplierDto.supGstType, 'supGstType');
    const now = new Date();
    const createdBy = resolveActor(saveSupplierDto.supCreatedBy);
    const modifiedBy = resolveActor(saveSupplierDto.supModifiedBy, createdBy);
    const data: Prisma.SupplierUncheckedCreateInput = {
      supGroupId: saveSupplierDto.supGroupId,
      supPurchaseType: normalizedPurchaseType,
      supName: normalizedName,
      supStateName: normalizedStateName,
      supStateCode: normalizedStateCode,
      supGstType: normalizedGstType,
      supBilledDate: now,
      supCreatedOn: now,
      supCreatedBy: createdBy,
    };
    this.applyOptionalFields(data, saveSupplierDto);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureSupplierGroupExists(tx, data.supGroupId);
        const companyId = hasOwnProperty(saveSupplierDto, 'supCompanyId')
          ? (saveSupplierDto.supCompanyId ?? null)
          : null;
        await this.ensureNameIsUnique(tx, normalizedName, companyId);
        const created = await tx.supplier.create({ data });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: SUPPLIER_TABLE_NAME,
            screenName: SUPPLIER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.supId,
            displayName: payload.supName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'Supplier created',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError(error, 'Supplier already exists', [
        { field: 'supName', message: 'Duplicate supplier name is not allowed' },
      ]);
      throw error;
    }
  }

  private async updateSupplier(saveSupplierDto: SaveSupplierDto): Promise<SupplierPayload> {
    const supId = saveSupplierDto.supId!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.supplier.findFirst({
          where: { supId, supIsDeleted: false },
        });
        if (!existing) {
          throwPurchaseNotFound('Supplier not found', 'supId', `No active supplier found with id ${supId}`);
        }
        const normalizedName = normalizeRequiredText(saveSupplierDto.supName, 'supName');
        const normalizedPurchaseType = normalizeRequiredText(saveSupplierDto.supPurchaseType, 'supPurchaseType');
        const normalizedStateName = normalizeRequiredText(saveSupplierDto.supStateName, 'supStateName');
        const normalizedStateCode = this.normalizeStateCode(saveSupplierDto.supStateCode);
        const normalizedGstType = normalizeRequiredText(saveSupplierDto.supGstType, 'supGstType');
        await this.ensureSupplierGroupExists(tx, saveSupplierDto.supGroupId);
        const nextCompanyId = hasOwnProperty(saveSupplierDto, 'supCompanyId')
          ? (saveSupplierDto.supCompanyId ?? null)
          : existing.supCompanyId;
        await this.ensureNameIsUnique(tx, normalizedName, nextCompanyId, supId);
        const now = new Date();
        const data: Prisma.SupplierUncheckedUpdateInput = {
          supGroupId: saveSupplierDto.supGroupId,
          supPurchaseType: normalizedPurchaseType,
          supName: normalizedName,
          supStateName: normalizedStateName,
          supStateCode: normalizedStateCode,
          supGstType: normalizedGstType,
          supBilledDate: now,
          supModifiedOn: now,
          supModifiedBy: resolveActor(saveSupplierDto.supModifiedBy),
        };
        this.applyOptionalFields(data, saveSupplierDto);
        const updated = await tx.supplier.update({ where: { supId }, data });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: SUPPLIER_TABLE_NAME,
            screenName: SUPPLIER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: supId,
            displayName: payload.supName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.supModifiedBy,
            notes: 'Supplier updated',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError(error, 'Supplier already exists', [
        { field: 'supName', message: 'Duplicate supplier name is not allowed' },
      ]);
      throw error;
    }
  }

  private async ensureSupplierGroupExists(tx: SupplierWriteClient, supGroupId: string): Promise<void> {
    const record = await tx.supplierGroup.findFirst({
      where: { spgId: supGroupId, spgIsDeleted: false },
      select: { spgId: true },
    });
    if (!record) {
      throwPurchaseBadRequest('Supplier group does not exist', [
        { field: 'supGroupId', message: `No active supplier group found with id ${supGroupId}` },
      ]);
    }
  }

  private async ensureNameIsUnique(
    tx: SupplierWriteClient,
    supName: string,
    companyId: string | null,
    excludeId?: string,
  ): Promise<void> {
    const existing = await tx.supplier.findFirst({
      where: {
        supIsDeleted: false,
        supCompanyId: companyId,
        supName: { equals: supName, mode: 'insensitive' },
        ...(excludeId ? { supId: { not: excludeId } } : {}),
      },
      select: { supId: true },
    });
    if (existing) {
      throwPurchaseConflict('Supplier name already exists for this company', [
        { field: 'supName', message: 'Duplicate supplier name is not allowed for this company' },
      ]);
    }
  }

  private applyOptionalFields(
    data: Prisma.SupplierUncheckedCreateInput | Prisma.SupplierUncheckedUpdateInput,
    saveSupplierDto: SaveSupplierDto,
  ): void {
    const optionalFields = [
      'supCompanyId', 'supBranchId', 'supShort', 'supAddr1', 'supAddr2', 'supAddr3',
      'supCity', 'supDistrict', 'supCountry', 'supPincode', 'supTel', 'supPhone',
      'supMailId', 'supWhatsappNo', 'supWebsiteAddress', 'supChequePreName', 'supNotes',
      'supCreditDays', 'supCashDiscPerc', 'supGstNo', 'supPanNo', 'supSupCst',
      'supDrugLiscenceNo', 'supRegionName', 'supRegionAddr1', 'supRegionAddr2',
      'supRegionAddr3', 'supRegionCity', 'supRegionDistrict', 'supRegionStateName',
      'supRegionCountry', 'supSortOrder', 'supIsActive', 'supStateId',
    ];
    for (const field of optionalFields) {
      if (hasOwnProperty(saveSupplierDto, field)) {
        (data as Record<string, unknown>)[field] = (saveSupplierDto as unknown as Record<string, unknown>)[field];
      }
    }
    if (hasOwnProperty(saveSupplierDto, 'supCollectionDays')) {
      data.supCollectionDays = saveSupplierDto.supCollectionDays ?? [];
    }
  }

  private normalizeStateCode(value: string): string {
    const normalized = value.trim().toUpperCase();
    if (normalized.length !== 2) {
      throwPurchaseBadRequest('Validation failed', [
        { field: 'supStateCode', message: 'supStateCode must be exactly 2 characters' },
      ]);
    }
    return normalized;
  }

  private toPayload(record: Supplier): SupplierPayload {
    return {
      supId: record.supId,
      supCompanyId: record.supCompanyId,
      supBranchId: record.supBranchId,
      supGroupId: record.supGroupId,
      supPurchaseType: record.supPurchaseType,
      supName: record.supName,
      supShort: record.supShort,
      supAddr1: record.supAddr1,
      supAddr2: record.supAddr2,
      supAddr3: record.supAddr3,
      supCity: record.supCity,
      supDistrict: record.supDistrict,
      supStateName: record.supStateName,
      supCountry: record.supCountry,
      supPincode: record.supPincode,
      supTel: record.supTel,
      supPhone: record.supPhone,
      supMailId: record.supMailId,
      supWhatsappNo: record.supWhatsappNo,
      supWebsiteAddress: record.supWebsiteAddress,
      supChequePreName: record.supChequePreName,
      supNotes: record.supNotes,
      supCreditDays: record.supCreditDays,
      supCashDiscPerc: toNumber(record.supCashDiscPerc),
      supCollectionDays: record.supCollectionDays,
      supGstNo: record.supGstNo,
      supStateCode: record.supStateCode,
      supPanNo: record.supPanNo,
      supGstType: record.supGstType,
      supSupCst: record.supSupCst,
      supDrugLiscenceNo: record.supDrugLiscenceNo,
      supRegionName: record.supRegionName,
      supRegionAddr1: record.supRegionAddr1,
      supRegionAddr2: record.supRegionAddr2,
      supRegionAddr3: record.supRegionAddr3,
      supRegionCity: record.supRegionCity,
      supRegionDistrict: record.supRegionDistrict,
      supRegionStateName: record.supRegionStateName,
      supRegionCountry: record.supRegionCountry,
      supBilledDate: record.supBilledDate ? record.supBilledDate.toISOString() : null,
      supSortOrder: record.supSortOrder,
      supIsActive: record.supIsActive,
      supIsDeleted: record.supIsDeleted,
      supSyncDate: record.supSyncDate ? record.supSyncDate.toISOString() : null,
      supCreatedOn: record.supCreatedOn.toISOString(),
      supCreatedBy: record.supCreatedBy,
      supModifiedOn: record.supModifiedOn.toISOString(),
      supModifiedBy: record.supModifiedBy,
      supStateId: record.supStateId,
    };
  }
}
