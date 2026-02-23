import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const CUSTOMER_GROUP_TABLE_NAME = 'cust_groups';
const CUSTOMER_GROUP_AUDIT_SCREEN_NAME = 'Customer Group Master';
const GRID_SQL_FORBIDDEN_TOKENS =
  /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke)\b/i;
const GRID_SQL_COMMENT_PATTERN = /(--|\/\*)/;

type CustomerGroupWriteClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class CustomerGroupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async save(saveCustomerGroupDto: SaveCustomerGroupDto): Promise<CustomerGroupPayload> {
    if (saveCustomerGroupDto.cgrId) {
      return this.updateCustomerGroup(saveCustomerGroupDto);
    }

    return this.createCustomerGroup(saveCustomerGroupDto);
  }

  async list(
    queryDto: ListCustomerGroupQueryDto,
  ): Promise<{ items: CustomerGroupListItem[]; meta: CustomerGroupListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const hasStructuredFilters =
      queryDto.cgrCompanyId !== undefined ||
      queryDto.cgrIsActive !== undefined ||
      Boolean(queryDto.search?.trim());

    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }

    const where: Prisma.CustGroupWhereInput = {
      cgrIsDeleted: false,
    };

    if (queryDto.cgrCompanyId !== undefined) {
      where.cgrCompanyId = queryDto.cgrCompanyId as string | null;
    }

    if (queryDto.cgrIsActive !== undefined) {
      where.cgrIsActive = queryDto.cgrIsActive;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { cgrName: { contains: search, mode: 'insensitive' } },
        { cgrAlias: { contains: search, mode: 'insensitive' } },
        { cgrShort: { contains: search, mode: 'insensitive' } },
        { cgrNarration: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.custGroup.count({ where }),
      this.prisma.custGroup.findMany({
        where,
        orderBy: [{ cgrName: 'asc' }, { cgrId: 'asc' }],
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
  ): Promise<{ items: CustomerGroupListItem[]; meta: CustomerGroupListMeta } | null> {
    const configuredGrid = await this.prisma.gridDetails.findFirst({
      where: {
        gridIsDeleted: false,
        gridStatus: true,
        gridSql: {
          not: null,
          contains: CUSTOMER_GROUP_TABLE_NAME,
          mode: 'insensitive',
        },
      },
      orderBy: [{ gridSortOrder: 'asc' }, { gridId: 'desc' }],
      select: {
        gridSql: true,
      },
    });

    const rawGridSql = configuredGrid?.gridSql?.trim();
    if (!rawGridSql) {
      return null;
    }

    try {
      const baseSql = this.validateConfiguredGridSql(rawGridSql);
      const countSql = `SELECT COUNT(*)::bigint AS total FROM (${baseSql}) AS customer_group_grid`;
      const rowsSql = `SELECT * FROM (${baseSql}) AS customer_group_grid LIMIT $1 OFFSET $2`;
      const [countResult, rows] = await Promise.all([
        this.prisma.$queryRawUnsafe<Array<{ total: bigint | number | string }>>(countSql),
        this.prisma.$queryRawUnsafe<CustomerGroupListItem[]>(rowsSql, limit, skip),
      ]);
      const total = this.parseCountValue(countResult[0]?.total);

      return {
        items: rows,
        meta: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      };
    } catch {
      return null;
    }
  }

  private validateConfiguredGridSql(sql: string): string {
    const normalized = sql.trim().replace(/;+\s*$/g, '');
    if (!/^select\b/i.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for customer group list', [
        {
          field: 'grid_sql',
          message: 'Only SELECT query is allowed',
        },
      ]);
    }

    if (normalized.includes(';')) {
      this.throwBadRequest('Invalid grid_sql configuration for customer group list', [
        {
          field: 'grid_sql',
          message: 'Multiple statements are not allowed',
        },
      ]);
    }

    if (GRID_SQL_COMMENT_PATTERN.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for customer group list', [
        {
          field: 'grid_sql',
          message: 'Comments are not allowed in configured query',
        },
      ]);
    }

    if (GRID_SQL_FORBIDDEN_TOKENS.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for customer group list', [
        {
          field: 'grid_sql',
          message: 'Write/DDL statements are not allowed',
        },
      ]);
    }

    if (!/\bcust_groups\b/i.test(normalized)) {
      this.throwBadRequest('Invalid grid_sql configuration for customer group list', [
        {
          field: 'grid_sql',
          message: 'Configured query must reference cust_groups table',
        },
      ]);
    }

    return normalized;
  }

  private parseCountValue(value: bigint | number | string | undefined): number {
    if (typeof value === 'bigint') {
      return Number(value);
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }

  async getById(cgrId: string): Promise<CustomerGroupPayload> {
    const record = await this.prisma.custGroup.findFirst({
      where: {
        cgrId,
        cgrIsDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(cgrId);
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
        this.throwNotFound(cgrId);
      }

      const customerCount = await tx.customer.count({
        where: {
          cusGroupId: cgrId,
          cusIsDeleted: false,
        },
      });

      if (customerCount > 0) {
        this.throwBadRequest('Cannot delete customer group with active customers', [
          {
            field: 'cgrId',
            message: `Customer group ${cgrId} is used by ${customerCount} customer(s).`,
          },
        ]);
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
        this.throwNotFound(cgrId);
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
    const normalizedName = this.normalizeRequiredName(saveCustomerGroupDto.cgrName);
    const companyId = this.hasOwnProperty(saveCustomerGroupDto, 'cgrCompanyId')
      ? (saveCustomerGroupDto.cgrCompanyId ?? null)
      : null;

    const data: Prisma.CustGroupUncheckedCreateInput = {
      cgrName: normalizedName,
      cgrCompanyId: companyId,
      cgrCollectionDays: this.hasOwnProperty(saveCustomerGroupDto, 'cgrCollectionDays')
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
      this.handleWriteError(error);
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
          this.throwNotFound(cgrId);
        }

        const normalizedName = this.normalizeRequiredName(saveCustomerGroupDto.cgrName);
        const nextCompanyId = this.hasOwnProperty(saveCustomerGroupDto, 'cgrCompanyId')
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
      this.handleWriteError(error);
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
      this.throwBadRequest('Company does not exist', [
        {
          field: 'cgrCompanyId',
          message: `No active company found with id ${companyId}`,
        },
      ]);
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
      throw new ConflictException(
        this.buildErrorResponse('Customer group name already exists for this company', [
          {
            field: 'cgrName',
            message: 'Duplicate customer group name is not allowed for this company',
          },
        ]),
      );
    }
  }

  private applyOptionalFields(
    data: Prisma.CustGroupUncheckedCreateInput | Prisma.CustGroupUncheckedUpdateInput,
    saveCustomerGroupDto: SaveCustomerGroupDto,
  ): void {
    if (this.hasOwnProperty(saveCustomerGroupDto, 'cgrCompanyId')) {
      data.cgrCompanyId = saveCustomerGroupDto.cgrCompanyId;
    }

    if (this.hasOwnProperty(saveCustomerGroupDto, 'cgrBranchId')) {
      data.cgrBranchId = saveCustomerGroupDto.cgrBranchId;
    }

    if (this.hasOwnProperty(saveCustomerGroupDto, 'cgrAlias')) {
      data.cgrAlias = saveCustomerGroupDto.cgrAlias;
    }

    if (this.hasOwnProperty(saveCustomerGroupDto, 'cgrShort')) {
      data.cgrShort = saveCustomerGroupDto.cgrShort;
    }

    if (this.hasOwnProperty(saveCustomerGroupDto, 'cgrNarration')) {
      data.cgrNarration = saveCustomerGroupDto.cgrNarration;
    }

    if (this.hasOwnProperty(saveCustomerGroupDto, 'cgrOrder')) {
      data.cgrOrder = saveCustomerGroupDto.cgrOrder;
    }

    if (this.hasOwnProperty(saveCustomerGroupDto, 'cgrDiscPerc')) {
      data.cgrDiscPerc = saveCustomerGroupDto.cgrDiscPerc;
    }

    if (this.hasOwnProperty(saveCustomerGroupDto, 'cgrCollectionDays')) {
      data.cgrCollectionDays = saveCustomerGroupDto.cgrCollectionDays ?? [];
    }

    if (this.hasOwnProperty(saveCustomerGroupDto, 'cgrDebitAllowed')) {
      data.cgrDebitAllowed = saveCustomerGroupDto.cgrDebitAllowed;
    }

    if (this.hasOwnProperty(saveCustomerGroupDto, 'cgrDebitDays')) {
      data.cgrDebitDays = saveCustomerGroupDto.cgrDebitDays;
    }

    if (this.hasOwnProperty(saveCustomerGroupDto, 'cgrDebitLimit')) {
      data.cgrDebitLimit = saveCustomerGroupDto.cgrDebitLimit;
    }

    if (this.hasOwnProperty(saveCustomerGroupDto, 'cgrBillsLimit')) {
      data.cgrBillsLimit = saveCustomerGroupDto.cgrBillsLimit;
    }

    if (this.hasOwnProperty(saveCustomerGroupDto, 'cgrOverdueBilling')) {
      data.cgrOverdueBilling = saveCustomerGroupDto.cgrOverdueBilling;
    }

    if (this.hasOwnProperty(saveCustomerGroupDto, 'cgrIsActive')) {
      data.cgrIsActive = saveCustomerGroupDto.cgrIsActive;
    }
  }

  private normalizeRequiredName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'cgrName',
          message: 'cgrName must not be empty',
        },
      ]);
    }

    return trimmed;
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
      cgrOrder: this.toNumber(record.cgrOrder),
      cgrDiscPerc: this.toNumber(record.cgrDiscPerc),
      cgrCollectionDays: record.cgrCollectionDays,
      cgrDebitAllowed: record.cgrDebitAllowed,
      cgrDebitDays: record.cgrDebitDays,
      cgrDebitLimit: this.toNumber(record.cgrDebitLimit),
      cgrBillsLimit: record.cgrBillsLimit,
      cgrOverdueBilling: record.cgrOverdueBilling,
      cgrIsActive: record.cgrIsActive,
      cgrIsDeleted: record.cgrIsDeleted,
      cgrCreatedOn: record.cgrCreatedOn.toISOString(),
      cgrModifiedOn: record.cgrModifiedOn.toISOString(),
    };
  }

  private toNumber(value: Prisma.Decimal | number): number {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value.toString());
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Customer group name already exists', [
          {
            field: 'cgrName',
            message: 'Duplicate customer group name is not allowed',
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

  private throwNotFound(cgrId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Customer group not found', [
        {
          field: 'cgrId',
          message: `No active customer group found with id ${cgrId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: CustomerGroupErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: CustomerGroupErrorDetail[] = [],
  ): CustomerGroupErrorResponse {
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
