import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { Prisma, Supplier } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListSupplierQueryDto } from './dto/list-supplier-query.dto';
import { SaveSupplierDto } from './dto/save-supplier.dto';
import {
  SupplierErrorDetail,
  SupplierErrorResponse,
  SupplierListItem,
  SupplierListMeta,
  SupplierPayload,
} from './types/supplier-api.types';

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const SUPPLIER_TABLE_NAME = 'suppliers';
const SUPPLIER_AUDIT_SCREEN_NAME = 'Supplier Master';

type SupplierWriteClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}

  async save(saveSupplierDto: SaveSupplierDto): Promise<SupplierPayload> {
    if (saveSupplierDto.supId) {
      return this.updateSupplier(saveSupplierDto);
    }

    return this.createSupplier(saveSupplierDto);
  }

  async list(
    queryDto: ListSupplierQueryDto,
  ): Promise<{ items: SupplierListItem[]; meta: SupplierListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const hasStructuredFilters =
      queryDto.supCompanyId !== undefined ||
      queryDto.supGroupId !== undefined ||
      queryDto.supIsActive !== undefined ||
      Boolean(queryDto.search?.trim());

    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }

    const where: Prisma.SupplierWhereInput = {
      supIsDeleted: false,
    };

    if (queryDto.supCompanyId !== undefined) {
      where.supCompanyId = queryDto.supCompanyId;
    }

    if (queryDto.supGroupId !== undefined) {
      where.supGroupId = queryDto.supGroupId;
    }

    if (queryDto.supIsActive !== undefined) {
      where.supIsActive = queryDto.supIsActive;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { supName: { contains: search, mode: 'insensitive' } },
        { supShort: { contains: search, mode: 'insensitive' } },
        { supPurchaseType: { contains: search, mode: 'insensitive' } },
        { supCity: { contains: search, mode: 'insensitive' } },
        { supDistrict: { contains: search, mode: 'insensitive' } },
        { supPhone: { contains: search, mode: 'insensitive' } },
        { supMailId: { contains: search, mode: 'insensitive' } },
        { supGstNo: { contains: search, mode: 'insensitive' } },
        { supPanNo: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        orderBy: [{ supName: 'asc' }, { supId: 'asc' }],
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

  private async listFromConfiguredGridSql(
    page: number,
    limit: number,
    skip: number,
  ): Promise<{ items: SupplierListItem[]; meta: SupplierListMeta } | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: SUPPLIER_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      SUPPLIER_TABLE_NAME,
    );
    const configuredGrid = primaryConfiguredGrids[0];
    if (!configuredGrid) {
      return null;
    }
    const rawGridSql = configuredGrid.gridSql?.trim();
    if (!rawGridSql) {
      return null;
    }

    const validation = this.configuredGridSqlService.validateBaseSql({
      sql: rawGridSql,
      tableName: SUPPLIER_TABLE_NAME,
    });
    if (!validation.isValid) {
      this.throwBadRequest('Invalid grid_sql configuration for supplier list', [
        {
          field: 'grid_sql',
          message: validation.message,
        },
      ]);
    }

    try {
      const result = await this.configuredGridSqlService.runPagedQuery<SupplierListItem>({
        baseSql: validation.normalizedSql,
        alias: 'supplier_grid',
        limit,
        skip,
      });

      return {
        items: result.items,
        meta: {
          page,
          limit,
          total: result.total,
          total_pages: Math.ceil(result.total / limit),
        },
      };
    } catch {
      this.throwBadRequest('Invalid grid_sql configuration for supplier list', [
        {
          field: 'grid_sql',
          message: 'Configured query could not be executed for suppliers',
        },
      ]);
    }
  }

  async getById(supId: string): Promise<SupplierPayload> {
    const record = await this.prisma.supplier.findFirst({
      where: {
        supId,
        supIsDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(supId);
    }

    return this.toPayload(record);
  }

  async softDelete(supId: string): Promise<{ supId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.supplier.findFirst({
        where: {
          supId,
          supIsDeleted: false,
        },
      });

      if (!existing) {
        this.throwNotFound(supId);
      }

      const modifiedOn = new Date();
      const result = await tx.supplier.updateMany({
        where: {
          supId,
          supIsDeleted: false,
        },
        data: {
          supIsDeleted: true,
          supIsActive: false,
          supModifiedOn: modifiedOn,
          supModifiedBy: DEFAULT_ACTOR,
        },
      });

      if (result.count === 0) {
        this.throwNotFound(supId);
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

      return {
        supId,
        deleted: true,
      };
    });
  }

  private async createSupplier(saveSupplierDto: SaveSupplierDto): Promise<SupplierPayload> {
    const normalizedName = this.normalizeRequiredText(saveSupplierDto.supName, 'supName');
    const normalizedPurchaseType = this.normalizeRequiredText(
      saveSupplierDto.supPurchaseType,
      'supPurchaseType',
    );
    const normalizedStateName = this.normalizeRequiredText(
      saveSupplierDto.supStateName,
      'supStateName',
    );
    const normalizedStateCode = this.normalizeStateCode(saveSupplierDto.supStateCode);
    const normalizedGstType = this.normalizeRequiredText(saveSupplierDto.supGstType, 'supGstType');
    const now = new Date();
    const createdBy = this.resolveActor(saveSupplierDto.supCreatedBy);
    const modifiedBy = this.resolveActor(saveSupplierDto.supModifiedBy, createdBy);
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
      supModifiedOn: now,
      supModifiedBy: modifiedBy,
    };
    this.applyOptionalFields(data, saveSupplierDto);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureSupplierGroupExists(tx, data.supGroupId);

        const companyId = this.hasOwnProperty(saveSupplierDto, 'supCompanyId')
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
      this.handleWriteError(error);
      throw error;
    }
  }

  private async updateSupplier(saveSupplierDto: SaveSupplierDto): Promise<SupplierPayload> {
    const supId = saveSupplierDto.supId!;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.supplier.findFirst({
          where: {
            supId,
            supIsDeleted: false,
          },
        });

        if (!existing) {
          this.throwNotFound(supId);
        }

        const normalizedName = this.normalizeRequiredText(saveSupplierDto.supName, 'supName');
        const normalizedPurchaseType = this.normalizeRequiredText(
          saveSupplierDto.supPurchaseType,
          'supPurchaseType',
        );
        const normalizedStateName = this.normalizeRequiredText(
          saveSupplierDto.supStateName,
          'supStateName',
        );
        const normalizedStateCode = this.normalizeStateCode(saveSupplierDto.supStateCode);
        const normalizedGstType = this.normalizeRequiredText(
          saveSupplierDto.supGstType,
          'supGstType',
        );

        await this.ensureSupplierGroupExists(tx, saveSupplierDto.supGroupId);

        const nextCompanyId = this.hasOwnProperty(saveSupplierDto, 'supCompanyId')
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
          supModifiedBy: this.resolveActor(saveSupplierDto.supModifiedBy),
        };
        this.applyOptionalFields(data, saveSupplierDto);

        const updated = await tx.supplier.update({
          where: {
            supId,
          },
          data,
        });
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
      this.handleWriteError(error);
      throw error;
    }
  }

  private async ensureSupplierGroupExists(
    tx: SupplierWriteClient,
    supGroupId: string,
  ): Promise<void> {
    const record = await tx.supplierGroup.findFirst({
      where: {
        spgId: supGroupId,
        spgIsDeleted: false,
      },
      select: {
        spgId: true,
      },
    });

    if (!record) {
      this.throwBadRequest('Supplier group does not exist', [
        {
          field: 'supGroupId',
          message: `No active supplier group found with id ${supGroupId}`,
        },
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
        supName: {
          equals: supName,
          mode: 'insensitive',
        },
        ...(excludeId
          ? {
              supId: {
                not: excludeId,
              },
            }
          : {}),
      },
      select: {
        supId: true,
      },
    });

    if (existing) {
      throw new ConflictException(
        this.buildErrorResponse('Supplier name already exists for this company', [
          {
            field: 'supName',
            message: 'Duplicate supplier name is not allowed for this company',
          },
        ]),
      );
    }
  }

  private applyOptionalFields(
    data: Prisma.SupplierUncheckedCreateInput | Prisma.SupplierUncheckedUpdateInput,
    saveSupplierDto: SaveSupplierDto,
  ): void {
    if (this.hasOwnProperty(saveSupplierDto, 'supCompanyId')) {
      data.supCompanyId = saveSupplierDto.supCompanyId;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supBranchId')) {
      data.supBranchId = saveSupplierDto.supBranchId;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supShort')) {
      data.supShort = saveSupplierDto.supShort;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supAddr1')) {
      data.supAddr1 = saveSupplierDto.supAddr1;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supAddr2')) {
      data.supAddr2 = saveSupplierDto.supAddr2;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supAddr3')) {
      data.supAddr3 = saveSupplierDto.supAddr3;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supCity')) {
      data.supCity = saveSupplierDto.supCity;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supDistrict')) {
      data.supDistrict = saveSupplierDto.supDistrict;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supCountry')) {
      data.supCountry = saveSupplierDto.supCountry;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supPincode')) {
      data.supPincode = saveSupplierDto.supPincode;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supTel')) {
      data.supTel = saveSupplierDto.supTel;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supPhone')) {
      data.supPhone = saveSupplierDto.supPhone;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supMailId')) {
      data.supMailId = saveSupplierDto.supMailId;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supWhatsappNo')) {
      data.supWhatsappNo = saveSupplierDto.supWhatsappNo;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supWebsiteAddress')) {
      data.supWebsiteAddress = saveSupplierDto.supWebsiteAddress;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supChequePreName')) {
      data.supChequePreName = saveSupplierDto.supChequePreName;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supNotes')) {
      data.supNotes = saveSupplierDto.supNotes;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supCreditDays')) {
      data.supCreditDays = saveSupplierDto.supCreditDays;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supCashDiscPerc')) {
      data.supCashDiscPerc = saveSupplierDto.supCashDiscPerc;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supCollectionDays')) {
      data.supCollectionDays = saveSupplierDto.supCollectionDays ?? [];
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supGstNo')) {
      data.supGstNo = saveSupplierDto.supGstNo;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supPanNo')) {
      data.supPanNo = saveSupplierDto.supPanNo;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supSupCst')) {
      data.supSupCst = saveSupplierDto.supSupCst;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supDrugLiscenceNo')) {
      data.supDrugLiscenceNo = saveSupplierDto.supDrugLiscenceNo;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supRegionName')) {
      data.supRegionName = saveSupplierDto.supRegionName;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supRegionAddr1')) {
      data.supRegionAddr1 = saveSupplierDto.supRegionAddr1;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supRegionAddr2')) {
      data.supRegionAddr2 = saveSupplierDto.supRegionAddr2;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supRegionAddr3')) {
      data.supRegionAddr3 = saveSupplierDto.supRegionAddr3;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supRegionCity')) {
      data.supRegionCity = saveSupplierDto.supRegionCity;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supRegionDistrict')) {
      data.supRegionDistrict = saveSupplierDto.supRegionDistrict;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supRegionStateName')) {
      data.supRegionStateName = saveSupplierDto.supRegionStateName;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supRegionCountry')) {
      data.supRegionCountry = saveSupplierDto.supRegionCountry;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supSortOrder')) {
      data.supSortOrder = saveSupplierDto.supSortOrder;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supIsActive')) {
      data.supIsActive = saveSupplierDto.supIsActive;
    }

    if (this.hasOwnProperty(saveSupplierDto, 'supStateId')) {
      data.supStateId = saveSupplierDto.supStateId;
    }
  }

  private normalizeRequiredText(value: string, field: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      this.throwBadRequest('Validation failed', [
        {
          field,
          message: `${field} must not be empty`,
        },
      ]);
    }

    return trimmed;
  }

  private normalizeStateCode(value: string): string {
    const normalized = value.trim().toUpperCase();
    if (normalized.length !== 2) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'supStateCode',
          message: 'supStateCode must be exactly 2 characters',
        },
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
      supCashDiscPerc: this.toNumber(record.supCashDiscPerc),
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

  private toNumber(value: Prisma.Decimal | number): number {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value.toString());
  }

  private resolveActor(value: string | null | undefined, fallback = DEFAULT_ACTOR): string {
    if (!value) {
      return fallback;
    }

    const trimmed = value.trim();
    return trimmed || fallback;
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Supplier already exists', [
          {
            field: 'supName',
            message: 'Duplicate supplier name is not allowed',
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

  private throwNotFound(supId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Supplier not found', [
        {
          field: 'supId',
          message: `No active supplier found with id ${supId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: SupplierErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: SupplierErrorDetail[] = [],
  ): SupplierErrorResponse {
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
