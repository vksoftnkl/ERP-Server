import { Injectable } from '@nestjs/common';
import {
  ConfiguredGridListResult,
  ConfiguredGridSqlService,
} from '../../../common/configured-grid-sql/configured-grid-sql.service';
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
import {
  DEFAULT_ACTOR,
  SalesWriteClient,
  applyPresentFields,
  hasOwnProperty,
  normalizeRequiredText,
  resolveActor,
  throwOnUniqueConstraintError,
  throwSalesBadRequest,
  throwSalesNotFound,
  toNumber,
} from 'src/common/utils/module-service.utils';
import { buildListMeta, resolvePagination, runSalesListQuery } from 'src/common/utils/module-list.utils';
const CUSTOMER_TABLE_NAME = 'customers';
const CUSTOMER_AUDIT_SCREEN_NAME = 'Customer Master';
const CUSTOMER_OPTIONAL_FIELDS = [
  'cusTitle',
  'cusShort',
  'cusCode',
  'cusName',
  'cusAddr1',
  'cusAddr2',
  'cusAddr3',
  'cusCity',
  'cusDistrict',
  'cusCountry',
  'cusLandmark',
  'cusPin',
  'cusTel',
  'cusPhone1',
  'cusPhone2',
  'cusWhatsappNo',
  'cusEmail',
  'cusAadharNo',
  'cusContactPerson',
  'cusDistanceKm',
  'cusCreditAllowed',
  'cusCreditBillLimit',
  'cusCreditAmtLimit',
  'cusCreditDays',
  'cusDebitBalance',
  'cusDiscPerc',
  'cusDebitGraceDays',
  'cusEnableSms',
  'cusOverdueSms',
  'cusOverdueBilling',
  'cusAllowPromotion',
  'cusAllowLoyalty',
  'cusAllowDiscount',
  'cusSortOrder',
  'cusRegionName',
  'cusRegionAddr1',
  'cusRegionAddr2',
  'cusRegionAddr3',
  'cusRegionCity',
  'cusRegionDistrict',
  'cusRegionStateName',
  'cusRegionCountry',
  'cusBirthDate',
  'cusMarriageDate',
  'cusTransportName',
  'cusFreightCharge',
  'cusLoadingCharge',
  'cusUnloadingCharge',
  'cusGstNo',
  'cusPanNo',
  'cusGstType',
  'cusEcommerceGstin',
  'cusTcsApplicable',
  'cusItcollExempted',
  'cusItcollType',
  'cusGeoLocation',
  'cusCollectionDays',
  'cusDefaultSalesman',
  'cusNotes',
  'cusBranchId',
  'cusCompanyId',
  'cusIsActive',
];

type CustomerWriteClient = SalesWriteClient;

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
  ): Promise<ConfiguredGridListResult<CustomerListItem, CustomerListMeta>> {
    const { page, limit, skip } = resolvePagination(queryDto);
    const hasStructuredFilters =
      queryDto.cusCompanyId !== undefined ||
      queryDto.cusAreaId !== undefined ||
      queryDto.cusGroupId !== undefined ||
      queryDto.cusIsActive !== undefined;
    const where: Prisma.CustomerWhereInput = { cusIsDeleted: false };
    if (queryDto.cusCompanyId !== undefined) where.cusCompanyId = queryDto.cusCompanyId;
    if (queryDto.cusAreaId !== undefined) where.cusAreaId = queryDto.cusAreaId;
    if (queryDto.cusGroupId !== undefined) where.cusGroupId = queryDto.cusGroupId;
    if (queryDto.cusIsActive !== undefined) where.cusIsActive = queryDto.cusIsActive;
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
    return runSalesListQuery({ page, limit }, {
      hasStructuredFilters,
      configuredGridFn: () => this.listFromConfiguredGridSql(queryDto, page, limit, skip),
      countFn: () => this.prisma.customer.count({ where }),
      findManyFn: () => this.prisma.customer.findMany({ where, orderBy: [{ cusName: 'asc' }, { cusId: 'asc' }], skip, take: limit }),
      toItemFn: (record) => this.toPayload(record),
    });
  }

  private async listFromConfiguredGridSql(
    queryDto: ListCustomerQueryDto,
    page: number,
    limit: number,
    skip: number,
  ): Promise<ConfiguredGridListResult<CustomerListItem, CustomerListMeta> | null> {
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
        const baseSql = validation.normalizedSql;
        const searchableFieldNames = queryDto.search?.trim()
          ? await this.configuredGridSqlService.getSearchableFieldNames(
              configuredGrid.gridId,
              baseSql,
            )
          : [];
        const { sql: filteredSql, params } = this.configuredGridSqlService.buildSearchSql({
          baseSql,
          alias: 'customer_grid',
          search: queryDto.search ?? '',
          searchableFieldNames,
        });
        const result = await this.configuredGridSqlService.runPagedQuery<CustomerListItem>({
          baseSql: filteredSql,
          alias: 'customer_grid',
          params,
          limit,
          skip,
          gridId: configuredGrid.gridId,
        });
        return {
          items: result.items,
          meta: buildListMeta(page, limit, result.total),
          styles: result.styles,
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
      throwSalesNotFound<CustomerErrorDetail, CustomerErrorResponse>(
        'Customer not found',
        'cusId',
        `No active customer found with id ${cusId}`,
      );
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
        throwSalesNotFound<CustomerErrorDetail, CustomerErrorResponse>(
          'Customer not found',
          'cusId',
          `No active customer found with id ${cusId}`,
        );
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
        throwSalesNotFound<CustomerErrorDetail, CustomerErrorResponse>(
          'Customer not found',
          'cusId',
          `No active customer found with id ${cusId}`,
        );
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
    const normalizedStateName = normalizeRequiredText<CustomerErrorDetail, CustomerErrorResponse>(
      saveCustomerDto.cusStateName,
      'cusStateName',
    );
    const normalizedStateCode = this.normalizeStateCode(saveCustomerDto.cusStateCode);
    const now = new Date();
    const createdBy = resolveActor(saveCustomerDto.cusCreatedBy);
    const modifiedBy = resolveActor(saveCustomerDto.cusModifiedBy, createdBy);

    const data: Prisma.CustomerUncheckedCreateInput = {
      cusStateName: normalizedStateName,
      cusStateCode: normalizedStateCode,
      cusCompanyId: hasOwnProperty(saveCustomerDto, 'cusCompanyId')
        ? (saveCustomerDto.cusCompanyId ?? null)
        : null,
      cusAreaId: saveCustomerDto.cusAreaId,
      cusGroupId: saveCustomerDto.cusGroupId,
      cusPriceLevelId: saveCustomerDto.cusPriceLevelId,
      cusCollectionDays: hasOwnProperty(saveCustomerDto, 'cusCollectionDays')
        ? (saveCustomerDto.cusCollectionDays ?? [])
        : [],
      cusBilledDate: now,
      cusBilledCount: 1,
      cusCreatedOn: now,
      cusCreatedBy: createdBy,
      cusModifiedOn: now,
      cusModifiedBy: modifiedBy,
    };
    this.applyOptionalFields(data, saveCustomerDto);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureCompanyExists(tx, data.cusCompanyId ?? null);
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
      throwOnUniqueConstraintError<CustomerErrorDetail, CustomerErrorResponse>(
        error,
        'Customer already exists',
        [
          {
            field: 'cusName',
            message: 'Duplicate customer details are not allowed',
          },
        ],
      );
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
          throwSalesNotFound<CustomerErrorDetail, CustomerErrorResponse>(
            'Customer not found',
            'cusId',
            `No active customer found with id ${cusId}`,
          );
        }

        const normalizedStateName = normalizeRequiredText<
          CustomerErrorDetail,
          CustomerErrorResponse
        >(saveCustomerDto.cusStateName, 'cusStateName');
        const normalizedStateCode = this.normalizeStateCode(saveCustomerDto.cusStateCode);
        const nextAreaId = hasOwnProperty(saveCustomerDto, 'cusAreaId')
          ? saveCustomerDto.cusAreaId
          : existing.cusAreaId;
        const nextGroupId = hasOwnProperty(saveCustomerDto, 'cusGroupId')
          ? saveCustomerDto.cusGroupId
          : existing.cusGroupId;
        const nextCompanyId = hasOwnProperty(saveCustomerDto, 'cusCompanyId')
          ? (saveCustomerDto.cusCompanyId ?? null)
          : existing.cusCompanyId;
        const nextPriceLevelId = hasOwnProperty(saveCustomerDto, 'cusPriceLevelId')
          ? saveCustomerDto.cusPriceLevelId
          : existing.cusPriceLevelId;

        await this.ensureCompanyExists(tx, nextCompanyId);
        await this.ensureAreaExists(tx, nextAreaId);
        await this.ensureCustomerGroupExists(tx, nextGroupId);
        const now = new Date();

        const data: Prisma.CustomerUncheckedUpdateInput = {
          cusStateName: normalizedStateName,
          cusStateCode: normalizedStateCode,
          cusCompanyId: nextCompanyId,
          cusAreaId: nextAreaId,
          cusGroupId: nextGroupId,
          cusPriceLevelId: nextPriceLevelId,
          cusBilledDate: now,
          cusBilledCount: {
            increment: 1,
          },
          cusModifiedOn: now,
          cusModifiedBy: resolveActor(saveCustomerDto.cusModifiedBy),
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
      throwOnUniqueConstraintError<CustomerErrorDetail, CustomerErrorResponse>(
        error,
        'Customer already exists',
        [
          {
            field: 'cusName',
            message: 'Duplicate customer details are not allowed',
          },
        ],
      );
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
      throwSalesBadRequest<CustomerErrorDetail, CustomerErrorResponse>('Area does not exist', [
        {
          field: 'cusAreaId',
          message: `No active area found with id ${areaId}`,
        },
      ]);
    }
  }

  private async ensureCompanyExists(
    tx: CustomerWriteClient,
    companyId: string | null,
  ): Promise<void> {
    if (companyId === null) {
      return;
    }

    const company = await tx.company.findFirst({
      where: {
        compId: companyId,
        compIsDeleted: false,
      },
      select: {
        compId: true,
      },
    });

    if (!company) {
      throwSalesBadRequest<CustomerErrorDetail, CustomerErrorResponse>('Company does not exist', [
        {
          field: 'cusCompanyId',
          message: `No active company found with id ${companyId}`,
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
      throwSalesBadRequest<CustomerErrorDetail, CustomerErrorResponse>(
        'Customer group does not exist',
        [
          {
            field: 'cusGroupId',
            message: `No active customer group found with id ${groupId}`,
          },
        ],
      );
    }
  }

  private applyOptionalFields(
    data: Prisma.CustomerUncheckedCreateInput | Prisma.CustomerUncheckedUpdateInput,
    saveCustomerDto: SaveCustomerDto,
  ): void {
    applyPresentFields(data, saveCustomerDto, CUSTOMER_OPTIONAL_FIELDS, {
      cusBirthDate: (value) =>
        this.toDateOrNull(value as string | null | undefined, 'cusBirthDate'),
      cusMarriageDate: (value) =>
        this.toDateOrNull(value as string | null | undefined, 'cusMarriageDate'),
      cusCollectionDays: (value) => value ?? [],
    });
  }

  private normalizeStateCode(value: string): string {
    const normalized = value.trim().toUpperCase();
    if (normalized.length !== 2) {
      throwSalesBadRequest<CustomerErrorDetail, CustomerErrorResponse>('Validation failed', [
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
      throwSalesBadRequest<CustomerErrorDetail, CustomerErrorResponse>('Validation failed', [
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
      cusCreditAmtLimit: toNumber(record.cusCreditAmtLimit),
      cusCreditDays: record.cusCreditDays,
      cusDebitBalance: toNumber(record.cusDebitBalance),
      cusDiscPerc: toNumber(record.cusDiscPerc),
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
      cusCompanyId: record.cusCompanyId,
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
}
