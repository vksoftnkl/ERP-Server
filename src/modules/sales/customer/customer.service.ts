import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { Customer, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListCustomerQueryDto } from './dto/list-customer-query.dto';
import { SaveCustomerDto } from './dto/save-customer.dto';
import {
  CustomerErrorDetail,
  CustomerErrorResponse,
  CustomerListItem,
  CustomerListMeta,
  CustomerPayload,
} from './types/customer-api.types';

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const CUSTOMER_TABLE_NAME = 'customers';
const CUSTOMER_AUDIT_SCREEN_NAME = 'Customer Master';

type CustomerWriteClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class CustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}

  async save(saveCustomerDto: SaveCustomerDto): Promise<CustomerPayload> {
    if (saveCustomerDto.cusId) {
      return this.updateCustomer(saveCustomerDto);
    }

    return this.createCustomer(saveCustomerDto);
  }

  async list(
    queryDto: ListCustomerQueryDto,
  ): Promise<{ items: CustomerListItem[]; meta: CustomerListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const hasStructuredFilters =
      queryDto.cusAreaId !== undefined ||
      queryDto.cusGroupId !== undefined ||
      queryDto.cusIsActive !== undefined ||
      Boolean(queryDto.search?.trim());

    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }

    const where: Prisma.CustomerWhereInput = {
      cusIsDeleted: false,
    };

    if (queryDto.cusAreaId !== undefined) {
      where.cusAreaId = queryDto.cusAreaId;
    }

    if (queryDto.cusGroupId !== undefined) {
      where.cusGroupId = queryDto.cusGroupId;
    }

    if (queryDto.cusIsActive !== undefined) {
      where.cusIsActive = queryDto.cusIsActive;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { cusName: { contains: search, mode: 'insensitive' } },
        { cusShort: { contains: search, mode: 'insensitive' } },
        { cusCode: { contains: search, mode: 'insensitive' } },
        { cusCity: { contains: search, mode: 'insensitive' } },
        { cusDistrict: { contains: search, mode: 'insensitive' } },
        { cusPhone1: { contains: search, mode: 'insensitive' } },
        { cusEmail: { contains: search, mode: 'insensitive' } },
        { cusGstNo: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        orderBy: [{ cusName: 'asc' }, { cusId: 'asc' }],
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
  ): Promise<{ items: CustomerListItem[]; meta: CustomerListMeta } | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: CUSTOMER_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      CUSTOMER_TABLE_NAME,
    );
    if (primaryConfiguredGrids.length === 0) {
      return null;
    }

    for (const configuredGrid of primaryConfiguredGrids) {
      const rawGridSql = configuredGrid.gridSql?.trim();
      if (!rawGridSql) {
        continue;
      }

      const validation = this.configuredGridSqlService.validateBaseSql({
        sql: rawGridSql,
        tableName: CUSTOMER_TABLE_NAME,
      });
      if (!validation.isValid) {
        continue;
      }

      try {
        const result = await this.configuredGridSqlService.runPagedQuery<CustomerListItem>({
          baseSql: validation.normalizedSql,
          alias: 'customer_grid',
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
        continue;
      }
    }

    return null;
  }

  async getById(cusId: string): Promise<CustomerPayload> {
    const record = await this.prisma.customer.findFirst({
      where: {
        cusId,
        cusIsDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(cusId);
    }

    return this.toPayload(record);
  }

  async softDelete(cusId: string): Promise<{ cusId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.customer.findFirst({
        where: {
          cusId,
          cusIsDeleted: false,
        },
      });

      if (!existing) {
        this.throwNotFound(cusId);
      }

      const modifiedOn = new Date();
      const result = await tx.customer.updateMany({
        where: {
          cusId,
          cusIsDeleted: false,
        },
        data: {
          cusIsDeleted: true,
          cusIsActive: false,
          cusModifiedOn: modifiedOn,
          cusModifiedBy: DEFAULT_ACTOR,
        },
      });

      if (result.count === 0) {
        this.throwNotFound(cusId);
      }

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        cusIsDeleted: true,
        cusIsActive: false,
        cusModifiedOn: modifiedOn,
        cusModifiedBy: DEFAULT_ACTOR,
      });

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: CUSTOMER_TABLE_NAME,
          screenName: CUSTOMER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: cusId,
          displayName: existing.cusName || cusId,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'Customer soft deleted',
        },
        tx,
      );

      return {
        cusId,
        deleted: true,
      };
    });
  }

  private async createCustomer(saveCustomerDto: SaveCustomerDto): Promise<CustomerPayload> {
    const normalizedStateName = this.normalizeRequiredText(
      saveCustomerDto.cusStateName,
      'cusStateName',
    );
    const normalizedStateCode = this.normalizeStateCode(saveCustomerDto.cusStateCode);
    const now = new Date();
    const createdBy = this.resolveActor(saveCustomerDto.cusCreatedBy);
    const modifiedBy = this.resolveActor(saveCustomerDto.cusModifiedBy, createdBy);

    const data: Prisma.CustomerUncheckedCreateInput = {
      cusStateName: normalizedStateName,
      cusStateCode: normalizedStateCode,
      cusAreaId: saveCustomerDto.cusAreaId,
      cusGroupId: saveCustomerDto.cusGroupId,
      cusPriceLevelId: saveCustomerDto.cusPriceLevelId,
      cusCollectionDays: this.hasOwnProperty(saveCustomerDto, 'cusCollectionDays')
        ? (saveCustomerDto.cusCollectionDays ?? [])
        : [],
      cusCreatedOn: now,
      cusCreatedBy: createdBy,
      cusModifiedOn: now,
      cusModifiedBy: modifiedBy,
    };
    this.applyOptionalFields(data, saveCustomerDto);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureAreaExists(tx, data.cusAreaId);
        await this.ensureCustomerGroupExists(tx, data.cusGroupId);

        const created = await tx.customer.create({ data });
        const payload = this.toPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: CUSTOMER_TABLE_NAME,
            screenName: CUSTOMER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.cusId,
            displayName: payload.cusName || payload.cusId,
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'Customer created',
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

  private async updateCustomer(saveCustomerDto: SaveCustomerDto): Promise<CustomerPayload> {
    const cusId = saveCustomerDto.cusId!;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.customer.findFirst({
          where: {
            cusId,
            cusIsDeleted: false,
          },
        });

        if (!existing) {
          this.throwNotFound(cusId);
        }

        const normalizedStateName = this.normalizeRequiredText(
          saveCustomerDto.cusStateName,
          'cusStateName',
        );
        const normalizedStateCode = this.normalizeStateCode(saveCustomerDto.cusStateCode);
        const nextAreaId = this.hasOwnProperty(saveCustomerDto, 'cusAreaId')
          ? saveCustomerDto.cusAreaId
          : existing.cusAreaId;
        const nextGroupId = this.hasOwnProperty(saveCustomerDto, 'cusGroupId')
          ? saveCustomerDto.cusGroupId
          : existing.cusGroupId;
        const nextPriceLevelId = this.hasOwnProperty(saveCustomerDto, 'cusPriceLevelId')
          ? saveCustomerDto.cusPriceLevelId
          : existing.cusPriceLevelId;

        await this.ensureAreaExists(tx, nextAreaId);
        await this.ensureCustomerGroupExists(tx, nextGroupId);

        const data: Prisma.CustomerUncheckedUpdateInput = {
          cusStateName: normalizedStateName,
          cusStateCode: normalizedStateCode,
          cusAreaId: nextAreaId,
          cusGroupId: nextGroupId,
          cusPriceLevelId: nextPriceLevelId,
          cusModifiedOn: new Date(),
          cusModifiedBy: this.resolveActor(saveCustomerDto.cusModifiedBy),
        };
        this.applyOptionalFields(data, saveCustomerDto);

        const updated = await tx.customer.update({
          where: {
            cusId,
          },
          data,
        });
        const payload = this.toPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: CUSTOMER_TABLE_NAME,
            screenName: CUSTOMER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: cusId,
            displayName: payload.cusName || payload.cusId,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.cusModifiedBy,
            notes: 'Customer updated',
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

  private async ensureAreaExists(tx: CustomerWriteClient, areaId: string): Promise<void> {
    const area = await tx.areaMaster.findFirst({
      where: {
        armId: areaId,
        armIsDeleted: false,
      },
      select: {
        armId: true,
      },
    });

    if (!area) {
      this.throwBadRequest('Area does not exist', [
        {
          field: 'cusAreaId',
          message: `No active area found with id ${areaId}`,
        },
      ]);
    }
  }

  private async ensureCustomerGroupExists(tx: CustomerWriteClient, groupId: string): Promise<void> {
    const group = await tx.custGroup.findFirst({
      where: {
        cgrId: groupId,
        cgrIsDeleted: false,
      },
      select: {
        cgrId: true,
      },
    });

    if (!group) {
      this.throwBadRequest('Customer group does not exist', [
        {
          field: 'cusGroupId',
          message: `No active customer group found with id ${groupId}`,
        },
      ]);
    }
  }

  private applyOptionalFields(
    data: Prisma.CustomerUncheckedCreateInput | Prisma.CustomerUncheckedUpdateInput,
    saveCustomerDto: SaveCustomerDto,
  ): void {
    if (this.hasOwnProperty(saveCustomerDto, 'cusTitle')) {
      data.cusTitle = saveCustomerDto.cusTitle;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusShort')) {
      data.cusShort = saveCustomerDto.cusShort;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusCode')) {
      data.cusCode = saveCustomerDto.cusCode;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusName')) {
      data.cusName = saveCustomerDto.cusName;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusAddr1')) {
      data.cusAddr1 = saveCustomerDto.cusAddr1;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusAddr2')) {
      data.cusAddr2 = saveCustomerDto.cusAddr2;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusAddr3')) {
      data.cusAddr3 = saveCustomerDto.cusAddr3;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusCity')) {
      data.cusCity = saveCustomerDto.cusCity;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusDistrict')) {
      data.cusDistrict = saveCustomerDto.cusDistrict;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusCountry')) {
      data.cusCountry = saveCustomerDto.cusCountry;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusLandmark')) {
      data.cusLandmark = saveCustomerDto.cusLandmark;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusPin')) {
      data.cusPin = saveCustomerDto.cusPin;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusTel')) {
      data.cusTel = saveCustomerDto.cusTel;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusPhone1')) {
      data.cusPhone1 = saveCustomerDto.cusPhone1;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusPhone2')) {
      data.cusPhone2 = saveCustomerDto.cusPhone2;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusWhatsappNo')) {
      data.cusWhatsappNo = saveCustomerDto.cusWhatsappNo;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusEmail')) {
      data.cusEmail = saveCustomerDto.cusEmail;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusAadharNo')) {
      data.cusAadharNo = saveCustomerDto.cusAadharNo;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusContactPerson')) {
      data.cusContactPerson = saveCustomerDto.cusContactPerson;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusDistanceKm')) {
      data.cusDistanceKm = saveCustomerDto.cusDistanceKm;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusCreditAllowed')) {
      data.cusCreditAllowed = saveCustomerDto.cusCreditAllowed;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusCreditBillLimit')) {
      data.cusCreditBillLimit = saveCustomerDto.cusCreditBillLimit;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusCreditAmtLimit')) {
      data.cusCreditAmtLimit = saveCustomerDto.cusCreditAmtLimit;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusCreditDays')) {
      data.cusCreditDays = saveCustomerDto.cusCreditDays;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusDebitBalance')) {
      data.cusDebitBalance = saveCustomerDto.cusDebitBalance;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusDiscPerc')) {
      data.cusDiscPerc = saveCustomerDto.cusDiscPerc;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusDebitGraceDays')) {
      data.cusDebitGraceDays = saveCustomerDto.cusDebitGraceDays;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusEnableSms')) {
      data.cusEnableSms = saveCustomerDto.cusEnableSms;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusOverdueSms')) {
      data.cusOverdueSms = saveCustomerDto.cusOverdueSms;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusOverdueBilling')) {
      data.cusOverdueBilling = saveCustomerDto.cusOverdueBilling;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusAllowPromotion')) {
      data.cusAllowPromotion = saveCustomerDto.cusAllowPromotion;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusAllowLoyalty')) {
      data.cusAllowLoyalty = saveCustomerDto.cusAllowLoyalty;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusAllowDiscount')) {
      data.cusAllowDiscount = saveCustomerDto.cusAllowDiscount;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusSortOrder')) {
      data.cusSortOrder = saveCustomerDto.cusSortOrder;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusRegionName')) {
      data.cusRegionName = saveCustomerDto.cusRegionName;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusRegionAddr1')) {
      data.cusRegionAddr1 = saveCustomerDto.cusRegionAddr1;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusRegionAddr2')) {
      data.cusRegionAddr2 = saveCustomerDto.cusRegionAddr2;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusRegionAddr3')) {
      data.cusRegionAddr3 = saveCustomerDto.cusRegionAddr3;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusRegionCity')) {
      data.cusRegionCity = saveCustomerDto.cusRegionCity;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusRegionDistrict')) {
      data.cusRegionDistrict = saveCustomerDto.cusRegionDistrict;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusRegionStateName')) {
      data.cusRegionStateName = saveCustomerDto.cusRegionStateName;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusRegionCountry')) {
      data.cusRegionCountry = saveCustomerDto.cusRegionCountry;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusBirthDate')) {
      data.cusBirthDate = this.toDateOrNull(saveCustomerDto.cusBirthDate, 'cusBirthDate');
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusMarriageDate')) {
      data.cusMarriageDate = this.toDateOrNull(saveCustomerDto.cusMarriageDate, 'cusMarriageDate');
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusTransportName')) {
      data.cusTransportName = saveCustomerDto.cusTransportName;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusFreightCharge')) {
      data.cusFreightCharge = saveCustomerDto.cusFreightCharge;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusLoadingCharge')) {
      data.cusLoadingCharge = saveCustomerDto.cusLoadingCharge;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusUnloadingCharge')) {
      data.cusUnloadingCharge = saveCustomerDto.cusUnloadingCharge;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusGstNo')) {
      data.cusGstNo = saveCustomerDto.cusGstNo;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusPanNo')) {
      data.cusPanNo = saveCustomerDto.cusPanNo;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusGstType')) {
      data.cusGstType = saveCustomerDto.cusGstType;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusEcommerceGstin')) {
      data.cusEcommerceGstin = saveCustomerDto.cusEcommerceGstin;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusTcsApplicable')) {
      data.cusTcsApplicable = saveCustomerDto.cusTcsApplicable;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusItcollExempted')) {
      data.cusItcollExempted = saveCustomerDto.cusItcollExempted;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusItcollType')) {
      data.cusItcollType = saveCustomerDto.cusItcollType;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusGeoLocation')) {
      data.cusGeoLocation = saveCustomerDto.cusGeoLocation;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusCollectionDays')) {
      data.cusCollectionDays = saveCustomerDto.cusCollectionDays ?? [];
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusDefaultSalesman')) {
      data.cusDefaultSalesman = saveCustomerDto.cusDefaultSalesman;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusBilledDate')) {
      data.cusBilledDate = this.toDateOrNull(saveCustomerDto.cusBilledDate, 'cusBilledDate');
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusBilledCount')) {
      data.cusBilledCount = saveCustomerDto.cusBilledCount;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusNotes')) {
      data.cusNotes = saveCustomerDto.cusNotes;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusBranchId')) {
      data.cusBranchId = saveCustomerDto.cusBranchId;
    }

    if (this.hasOwnProperty(saveCustomerDto, 'cusIsActive')) {
      data.cusIsActive = saveCustomerDto.cusIsActive;
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
          field: 'cusStateCode',
          message: 'cusStateCode must be exactly 2 characters',
        },
      ]);
    }

    return normalized;
  }

  private toDateOrNull(value: string | null | undefined, field: string): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const dateValue = new Date(value);
    if (Number.isNaN(dateValue.getTime())) {
      this.throwBadRequest('Validation failed', [
        {
          field,
          message: `${field} must be a valid ISO date`,
        },
      ]);
    }

    return dateValue;
  }

  private toPayload(record: Customer): CustomerPayload {
    return {
      cusId: record.cusId,
      cusTitle: record.cusTitle,
      cusShort: record.cusShort,
      cusCode: record.cusCode,
      cusName: record.cusName,
      cusAddr1: record.cusAddr1,
      cusAddr2: record.cusAddr2,
      cusAddr3: record.cusAddr3,
      cusCity: record.cusCity,
      cusDistrict: record.cusDistrict,
      cusStateName: record.cusStateName,
      cusCountry: record.cusCountry,
      cusStateCode: record.cusStateCode,
      cusLandmark: record.cusLandmark,
      cusPin: record.cusPin,
      cusTel: record.cusTel,
      cusPhone1: record.cusPhone1,
      cusPhone2: record.cusPhone2,
      cusWhatsappNo: record.cusWhatsappNo,
      cusEmail: record.cusEmail,
      cusAadharNo: record.cusAadharNo,
      cusContactPerson: record.cusContactPerson,
      cusDistanceKm: record.cusDistanceKm,
      cusCreditAllowed: record.cusCreditAllowed,
      cusCreditBillLimit: record.cusCreditBillLimit,
      cusCreditAmtLimit: this.toNumber(record.cusCreditAmtLimit),
      cusCreditDays: record.cusCreditDays,
      cusDebitBalance: this.toNumber(record.cusDebitBalance),
      cusDiscPerc: this.toNumber(record.cusDiscPerc),
      cusDebitGraceDays: record.cusDebitGraceDays,
      cusEnableSms: record.cusEnableSms,
      cusOverdueSms: record.cusOverdueSms,
      cusOverdueBilling: record.cusOverdueBilling,
      cusAllowPromotion: record.cusAllowPromotion,
      cusAllowLoyalty: record.cusAllowLoyalty,
      cusAllowDiscount: record.cusAllowDiscount,
      cusSortOrder: record.cusSortOrder,
      cusRegionName: record.cusRegionName,
      cusRegionAddr1: record.cusRegionAddr1,
      cusRegionAddr2: record.cusRegionAddr2,
      cusRegionAddr3: record.cusRegionAddr3,
      cusRegionCity: record.cusRegionCity,
      cusRegionDistrict: record.cusRegionDistrict,
      cusRegionStateName: record.cusRegionStateName,
      cusRegionCountry: record.cusRegionCountry,
      cusBirthDate: record.cusBirthDate ? record.cusBirthDate.toISOString() : null,
      cusMarriageDate: record.cusMarriageDate ? record.cusMarriageDate.toISOString() : null,
      cusTransportName: record.cusTransportName,
      cusFreightCharge: record.cusFreightCharge,
      cusLoadingCharge: record.cusLoadingCharge,
      cusUnloadingCharge: record.cusUnloadingCharge,
      cusGstNo: record.cusGstNo,
      cusPanNo: record.cusPanNo,
      cusGstType: record.cusGstType,
      cusEcommerceGstin: record.cusEcommerceGstin,
      cusTcsApplicable: record.cusTcsApplicable,
      cusItcollExempted: record.cusItcollExempted,
      cusItcollType: record.cusItcollType,
      cusGeoLocation: record.cusGeoLocation,
      cusCollectionDays: record.cusCollectionDays,
      cusDefaultSalesman: record.cusDefaultSalesman,
      cusPriceLevelId: record.cusPriceLevelId,
      cusBilledDate: record.cusBilledDate ? record.cusBilledDate.toISOString() : null,
      cusBilledCount: record.cusBilledCount,
      cusNotes: record.cusNotes,
      cusBranchId: record.cusBranchId,
      cusAreaId: record.cusAreaId,
      cusGroupId: record.cusGroupId,
      cusIsActive: record.cusIsActive,
      cusIsDeleted: record.cusIsDeleted,
      cusSyncDate: record.cusSyncDate ? record.cusSyncDate.toISOString() : null,
      cusCreatedOn: record.cusCreatedOn.toISOString(),
      cusCreatedBy: record.cusCreatedBy,
      cusModifiedOn: record.cusModifiedOn.toISOString(),
      cusModifiedBy: record.cusModifiedBy,
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
        this.buildErrorResponse('Customer already exists', [
          {
            field: 'cusName',
            message: 'Duplicate customer details are not allowed',
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

  private throwNotFound(cusId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Customer not found', [
        {
          field: 'cusId',
          message: `No active customer found with id ${cusId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: CustomerErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: CustomerErrorDetail[] = [],
  ): CustomerErrorResponse {
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
