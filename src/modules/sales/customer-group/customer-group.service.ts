import { Injectable } from '@nestjs/common';
import {
  ConfiguredGridListResult,
  ConfiguredGridSqlService,
} from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { CustGroup, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListCustomerGroupQueryDto } from './dto/list-customer-group-query.dto';
import { SaveCustomerGroupDto } from './dto/save-customer-group.dto';
import {
  CustomerGroupErrorDetail,
  CustomerGroupErrorResponse,
  CustomerGroupListItem,
  CustomerGroupListMeta,
  CustomerGroupPayload,
} from './types/customer-group-api.types';
import {
  DEFAULT_ACTOR,
  SalesWriteClient,
  applyPresentFields,
  hasOwnProperty,
  normalizeRequiredText,
  throwOnUniqueConstraintError,
  throwSalesBadRequest,
  throwSalesConflict,
  throwSalesNotFound,
  toNumber,
} from 'src/common/utils/module-service.utils';
import { resolvePagination, runConfiguredGridQuery, runSalesListQuery } from 'src/common/utils/module-list.utils';
const CUSTOMER_GROUP_TABLE_NAME = 'cust groups';
const CUSTOMER_GROUP_AUDIT_SCREEN_NAME = 'Customer Group Master';
const CUSTOMER_GROUP_OPTIONAL_FIELDS = [
  'cgrCompanyId',
  'cgrBranchId',
  'cgrAlias',
  'cgrShort',
  'cgrNarration',
  'cgrOrder',
  'cgrDiscPerc',
  'cgrCollectionDays',
  'cgrDebitAllowed',
  'cgrDebitDays',
  'cgrDebitLimit',
  'cgrBillsLimit',
  'cgrOverdueBilling',
  'cgrIsActive',
];
type CustomerGroupWriteClient = SalesWriteClient;
@Injectable()
export class CustomerGroupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}
  async save(saveCustomerGroupDto: SaveCustomerGroupDto): Promise<CustomerGroupPayload> {
    if (saveCustomerGroupDto.cgrId) {
      return this.updateCustomerGroup(saveCustomerGroupDto);
    }
    return this.createCustomerGroup(saveCustomerGroupDto);
  }
  async list(
    queryDto: ListCustomerGroupQueryDto,
  ): Promise<ConfiguredGridListResult<CustomerGroupListItem, CustomerGroupListMeta>> {
    const { page, limit, skip } = resolvePagination(queryDto);
    const hasStructuredFilters =
      queryDto.cgrCompanyId !== undefined || queryDto.cgrIsActive !== undefined;
    const where: Prisma.CustGroupWhereInput = { cgrIsDeleted: false };
    if (queryDto.cgrCompanyId !== undefined) where.cgrCompanyId = queryDto.cgrCompanyId as string | null;
    if (queryDto.cgrIsActive !== undefined) where.cgrIsActive = queryDto.cgrIsActive;
    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { cgrName: { contains: search, mode: 'insensitive' } },
        { cgrAlias: { contains: search, mode: 'insensitive' } },
        { cgrShort: { contains: search, mode: 'insensitive' } },
        { cgrNarration: { contains: search, mode: 'insensitive' } },
      ];
    }
    return runSalesListQuery({ page, limit }, {
      hasStructuredFilters,
      configuredGridFn: () => runConfiguredGridQuery<CustomerGroupListItem>(
        this.configuredGridSqlService,
        { tableName: CUSTOMER_GROUP_TABLE_NAME, alias: 'customer_group_grid', search: queryDto.search, page, limit, skip },
      ),
      countFn: () => this.prisma.custGroup.count({ where }),
      findManyFn: () => this.prisma.custGroup.findMany({ where, orderBy: [{ cgrName: 'asc' }, { cgrId: 'asc' }], skip, take: limit }),
      toItemFn: (record) => this.toPayload(record),
      loadStylesFn: () => this.configuredGridSqlService.loadPrimaryGridStyles(CUSTOMER_GROUP_TABLE_NAME),
    });
  }

  async getById(cgrId: string): Promise<CustomerGroupPayload> {
    const record = await this.prisma.custGroup.findFirst({
      where: {
        cgrId,
        cgrIsDeleted: false,
      },
    });

    if (!record) {
      throwSalesNotFound<CustomerGroupErrorDetail, CustomerGroupErrorResponse>(
        'Customer group not found',
        'cgrId',
        `No active customer group found with id ${cgrId}`,
      );
    }

    return this.toPayload(record);
  }

  async softDelete(cgrId: string): Promise<{ cgrId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.custGroup.findFirst({
        where: {
          cgrId,
          cgrIsDeleted: false,
        },
      });

      if (!existing) {
        throwSalesNotFound<CustomerGroupErrorDetail, CustomerGroupErrorResponse>(
          'Customer group not found',
          'cgrId',
          `No active customer group found with id ${cgrId}`,
        );
      }

      const customerCount = await tx.customer.count({
        where: {
          cusGroupId: cgrId,
          cusIsDeleted: false,
        },
      });

      if (customerCount > 0) {
        throwSalesBadRequest<CustomerGroupErrorDetail, CustomerGroupErrorResponse>(
          'Cannot delete customer group with active customers',
          [
            {
              field: 'cgrId',
              message: `Customer group ${cgrId} is used by ${customerCount} customer(s).`,
            },
          ],
        );
      }

      const modifiedOn = new Date();
      const result = await tx.custGroup.updateMany({
        where: {
          cgrId,
          cgrIsDeleted: false,
        },
        data: {
          cgrIsDeleted: true,
          cgrIsActive: false,
          cgrModifiedOn: modifiedOn,
        },
      });

      if (result.count === 0) {
        throwSalesNotFound<CustomerGroupErrorDetail, CustomerGroupErrorResponse>(
          'Customer group not found',
          'cgrId',
          `No active customer group found with id ${cgrId}`,
        );
      }

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        cgrIsDeleted: true,
        cgrIsActive: false,
        cgrModifiedOn: modifiedOn,
      });

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: CUSTOMER_GROUP_TABLE_NAME,
          screenName: CUSTOMER_GROUP_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: cgrId,
          displayName: existing.cgrName,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'Customer group soft deleted',
        },
        tx,
      );

      return {
        cgrId,
        deleted: true,
      };
    });
  }

  private async createCustomerGroup(
    saveCustomerGroupDto: SaveCustomerGroupDto,
  ): Promise<CustomerGroupPayload> {
    const now = new Date();
    const normalizedName = normalizeRequiredText<
      CustomerGroupErrorDetail,
      CustomerGroupErrorResponse
    >(saveCustomerGroupDto.cgrName, 'cgrName');
    const companyId = hasOwnProperty(saveCustomerGroupDto, 'cgrCompanyId')
      ? (saveCustomerGroupDto.cgrCompanyId ?? null)
      : null;

    const data: Prisma.CustGroupUncheckedCreateInput = {
      cgrName: normalizedName,
      cgrCompanyId: companyId,
      cgrCollectionDays: hasOwnProperty(saveCustomerGroupDto, 'cgrCollectionDays')
        ? (saveCustomerGroupDto.cgrCollectionDays ?? [])
        : [],
      cgrCreatedOn: now,
      cgrModifiedOn: now,
    };
    this.applyOptionalFields(data, saveCustomerGroupDto);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureCompanyExists(tx, companyId);
        await this.ensureNameIsUnique(tx, normalizedName, companyId);

        const created = await tx.custGroup.create({ data });
        const payload = this.toPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: CUSTOMER_GROUP_TABLE_NAME,
            screenName: CUSTOMER_GROUP_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.cgrId,
            displayName: payload.cgrName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Customer group created',
          },
          tx,
        );

        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<CustomerGroupErrorDetail, CustomerGroupErrorResponse>(
        error,
        'Customer group name already exists',
        [
          {
            field: 'cgrName',
            message: 'Duplicate customer group name is not allowed',
          },
        ],
      );
      throw error;
    }
  }

  private async updateCustomerGroup(
    saveCustomerGroupDto: SaveCustomerGroupDto,
  ): Promise<CustomerGroupPayload> {
    const cgrId = saveCustomerGroupDto.cgrId!;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.custGroup.findFirst({
          where: {
            cgrId,
            cgrIsDeleted: false,
          },
        });

        if (!existing) {
          throwSalesNotFound<CustomerGroupErrorDetail, CustomerGroupErrorResponse>(
            'Customer group not found',
            'cgrId',
            `No active customer group found with id ${cgrId}`,
          );
        }

        const normalizedName = normalizeRequiredText<
          CustomerGroupErrorDetail,
          CustomerGroupErrorResponse
        >(saveCustomerGroupDto.cgrName, 'cgrName');
        const nextCompanyId = hasOwnProperty(saveCustomerGroupDto, 'cgrCompanyId')
          ? (saveCustomerGroupDto.cgrCompanyId ?? null)
          : existing.cgrCompanyId;

        await this.ensureCompanyExists(tx, nextCompanyId);
        await this.ensureNameIsUnique(tx, normalizedName, nextCompanyId, cgrId);

        const data: Prisma.CustGroupUncheckedUpdateInput = {
          cgrName: normalizedName,
          cgrCompanyId: nextCompanyId,
          cgrModifiedOn: new Date(),
        };
        this.applyOptionalFields(data, saveCustomerGroupDto);

        const updated = await tx.custGroup.update({
          where: {
            cgrId,
          },
          data,
        });
        const payload = this.toPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: CUSTOMER_GROUP_TABLE_NAME,
            screenName: CUSTOMER_GROUP_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: cgrId,
            displayName: payload.cgrName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Customer group updated',
          },
          tx,
        );

        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<CustomerGroupErrorDetail, CustomerGroupErrorResponse>(
        error,
        'Customer group name already exists',
        [
          {
            field: 'cgrName',
            message: 'Duplicate customer group name is not allowed',
          },
        ],
      );
      throw error;
    }
  }

  private async ensureCompanyExists(
    tx: CustomerGroupWriteClient,
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
      throwSalesBadRequest<CustomerGroupErrorDetail, CustomerGroupErrorResponse>(
        'Company does not exist',
        [
          {
            field: 'cgrCompanyId',
            message: `No active company found with id ${companyId}`,
          },
        ],
      );
    }
  }

  private async ensureNameIsUnique(
    tx: CustomerGroupWriteClient,
    groupName: string,
    companyId: string | null,
    excludeId?: string,
  ): Promise<void> {
    const existing = await tx.custGroup.findFirst({
      where: {
        cgrIsDeleted: false,
        cgrCompanyId: companyId,
        cgrName: {
          equals: groupName,
          mode: 'insensitive',
        },
        ...(excludeId
          ? {
              cgrId: {
                not: excludeId,
              },
            }
          : {}),
      },
      select: {
        cgrId: true,
      },
    });

    if (existing) {
      throwSalesConflict<CustomerGroupErrorDetail, CustomerGroupErrorResponse>(
        'Customer group name already exists for this company',
        [
          {
            field: 'cgrName',
            message: 'Duplicate customer group name is not allowed for this company',
          },
        ],
      );
    }
  }

  private applyOptionalFields(
    data: Prisma.CustGroupUncheckedCreateInput | Prisma.CustGroupUncheckedUpdateInput,
    saveCustomerGroupDto: SaveCustomerGroupDto,
  ): void {
    applyPresentFields(data, saveCustomerGroupDto, CUSTOMER_GROUP_OPTIONAL_FIELDS, {
      cgrCollectionDays: (value) => value ?? [],
    });
  }

  private toPayload(record: CustGroup): CustomerGroupPayload {
    return {
      cgrId: record.cgrId,
      cgrCompanyId: record.cgrCompanyId,
      cgrBranchId: record.cgrBranchId,
      cgrName: record.cgrName,
      cgrAlias: record.cgrAlias,
      cgrShort: record.cgrShort,
      cgrNarration: record.cgrNarration,
      cgrOrder: toNumber(record.cgrOrder),
      cgrDiscPerc: toNumber(record.cgrDiscPerc),
      cgrCollectionDays: record.cgrCollectionDays,
      cgrDebitAllowed: record.cgrDebitAllowed,
      cgrDebitDays: record.cgrDebitDays,
      cgrDebitLimit: toNumber(record.cgrDebitLimit),
      cgrBillsLimit: record.cgrBillsLimit,
      cgrOverdueBilling: record.cgrOverdueBilling,
      cgrIsActive: record.cgrIsActive,
      cgrIsDeleted: record.cgrIsDeleted,
      cgrCreatedOn: record.cgrCreatedOn.toISOString(),
      cgrModifiedOn: record.cgrModifiedOn.toISOString(),
    };
  }
}
