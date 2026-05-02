import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { BankMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListBankListQueryDto } from './dto/list-bank-list-query.dto';
import { SaveBankListDto } from './dto/save-bank-list.dto';
import {
  BankListErrorDetail,
  BankListErrorResponse,
  BankListItem,
  BankListMeta,
  BankListPayload,
} from './types/bank-list-api.types';
const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const BANK_LIST_TABLE_NAME = 'bank master';
const BANK_LIST_AUDIT_SCREEN_NAME = 'Bank List Master';
type BankListWriteClient = Prisma.TransactionClient | PrismaService;
@Injectable()
export class BankListService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}
  async save(saveBankListDto: SaveBankListDto): Promise<BankListPayload> {
    if (saveBankListDto.bnkId) {
      return this.updateBank(saveBankListDto);
    }
    return this.createBank(saveBankListDto);
  }
  async list(
    queryDto: ListBankListQueryDto,
  ): Promise<ConfiguredGridListResult<BankListItem, BankListMeta>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const hasStructuredFilters = queryDto.bnkIsActive !== undefined;
    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(queryDto.search, page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }
    const where: Prisma.BankMasterWhereInput = {
      bnkIsDeleted: false,
    };
    if (queryDto.bnkIsActive !== undefined) {
      where.bnkIsActive = queryDto.bnkIsActive;
    }
    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { bnkName: { contains: search, mode: 'insensitive' } },
        { bnkShortName: { contains: search, mode: 'insensitive' } },
        { bnkAlias: { contains: search, mode: 'insensitive' } },
        { bnkRbiCode: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [total, records] = await Promise.all([
      this.prisma.bankMaster.count({ where }),
      this.prisma.bankMaster.findMany({
        where,
        orderBy: [{ bnkName: 'asc' }, { bnkId: 'asc' }],
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
    search: string | undefined,
    page: number,
    limit: number,
    skip: number,
  ): Promise<ConfiguredGridListResult<BankListItem, BankListMeta> | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: BANK_LIST_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      BANK_LIST_TABLE_NAME,
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
      tableName: BANK_LIST_TABLE_NAME,
    });
    if (!validation.isValid) {
      this.throwBadRequest('Invalid grid_sql configuration for bank list', [
        {
          field: 'grid_sql',
          message: validation.message,
        },
      ]);
    }
    try {
      const result = await this.configuredGridSqlService.runPagedQuery<BankListItem>({
        baseSql: validation.normalizedSql,
        alias: 'bank_list_grid',
        search,
        limit,
        skip,
          gridId: configuredGrid.gridId,
      });
      return {
        items: result.items,
        meta: {
          page,
          limit,
          total: result.total,
          total_pages: Math.ceil(result.total / limit),
        },
        styles: result.styles,
      };
    } catch {
      this.throwBadRequest('Invalid grid_sql configuration for bank list', [
        {
          field: 'grid_sql',
          message: 'Configured query could not be executed for bank_master',
        },
      ]);
    }
  }
  async getById(bnkId: string): Promise<BankListPayload> {
    const record = await this.prisma.bankMaster.findFirst({
      where: {
        bnkId,
        bnkIsDeleted: false,
      },
    });
    if (!record) {
      this.throwNotFound(bnkId);
    }
    return this.toPayload(record);
  }
  async softDelete(bnkId: string): Promise<{ bnkId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.bankMaster.findFirst({
        where: {
          bnkId,
          bnkIsDeleted: false,
        },
      });
      if (!existing) {
        this.throwNotFound(bnkId);
      }
      const bankUsageCount = await tx.accLedgerBankAccount.count({
        where: {
          lbaBankName: existing.bnkName,
          lbaIsDeleted: false,
        },
      });
      if (bankUsageCount > 0) {
        this.throwBadRequest('Cannot delete bank with active bank-account mappings', [
          {
            field: 'bnkId',
            message: `Bank ${bnkId} is used in ${bankUsageCount} ledger bank account(s).`,
          },
        ]);
      }
      const modifiedOn = new Date();
      const result = await tx.bankMaster.updateMany({
        where: {
          bnkId,
          bnkIsDeleted: false,
        },
        data: {
          bnkIsDeleted: true,
          bnkIsActive: false,
          bnkModifiedOn: modifiedOn,
          bnkModifiedBy: DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        this.throwNotFound(bnkId);
      }
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        bnkIsDeleted: true,
        bnkIsActive: false,
        bnkModifiedOn: modifiedOn,
        bnkModifiedBy: DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: BANK_LIST_TABLE_NAME,
          screenName: BANK_LIST_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: bnkId,
          displayName: existing.bnkName,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'Bank soft deleted',
        },
        tx,
      );
      return {
        bnkId,
        deleted: true,
      };
    });
  }
  private async createBank(saveBankListDto: SaveBankListDto): Promise<BankListPayload> {
    const normalizedName = this.normalizeRequiredName(saveBankListDto.bnkName);
    const now = new Date();
    const createdBy = this.resolveActor(saveBankListDto.bnkCreatedBy);
    const modifiedBy = this.resolveActor(saveBankListDto.bnkModifiedBy, createdBy);
    const data: Prisma.BankMasterUncheckedCreateInput = {
      bnkName: normalizedName,
      bnkCreatedOn: now,
      bnkCreatedBy: createdBy,
      bnkModifiedOn: now,
      bnkModifiedBy: modifiedBy,
    };
    this.applyOptionalFields(data, saveBankListDto);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureNameIsUnique(tx, normalizedName);
        const created = await tx.bankMaster.create({ data });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: BANK_LIST_TABLE_NAME,
            screenName: BANK_LIST_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.bnkId,
            displayName: payload.bnkName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'Bank created',
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
  private async updateBank(saveBankListDto: SaveBankListDto): Promise<BankListPayload> {
    const bnkId = saveBankListDto.bnkId!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.bankMaster.findFirst({
          where: {
            bnkId,
            bnkIsDeleted: false,
          },
        });
        if (!existing) {
          this.throwNotFound(bnkId);
        }
        const normalizedName = this.normalizeRequiredName(saveBankListDto.bnkName);
        await this.ensureNameIsUnique(tx, normalizedName, bnkId);
        const data: Prisma.BankMasterUncheckedUpdateInput = {
          bnkName: normalizedName,
          bnkModifiedOn: new Date(),
          bnkModifiedBy: this.resolveActor(saveBankListDto.bnkModifiedBy),
        };
        this.applyOptionalFields(data, saveBankListDto);
        const updated = await tx.bankMaster.update({
          where: {
            bnkId,
          },
          data,
        });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: BANK_LIST_TABLE_NAME,
            screenName: BANK_LIST_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: bnkId,
            displayName: payload.bnkName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: this.resolveActor(saveBankListDto.bnkModifiedBy),
            notes: 'Bank updated',
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
  private async ensureNameIsUnique(
    tx: BankListWriteClient,
    bankName: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await tx.bankMaster.findFirst({
      where: {
        bnkIsDeleted: false,
        bnkName: {
          equals: bankName,
          mode: 'insensitive',
        },
        ...(excludeId
          ? {
              bnkId: {
                not: excludeId,
              },
            }
          : {}),
      },
      select: {
        bnkId: true,
      },
    });
    if (existing) {
      throw new ConflictException(
        this.buildErrorResponse('Bank name already exists', [
          {
            field: 'bnkName',
            message: 'Duplicate bank name is not allowed',
          },
        ]),
      );
    }
  }
  private applyOptionalFields(
    data: Prisma.BankMasterUncheckedCreateInput | Prisma.BankMasterUncheckedUpdateInput,
    saveBankListDto: SaveBankListDto,
  ): void {
    if (this.hasOwnProperty(saveBankListDto, 'bnkShortName')) {
      data.bnkShortName = saveBankListDto.bnkShortName;
    }
    if (this.hasOwnProperty(saveBankListDto, 'bnkAlias')) {
      data.bnkAlias = saveBankListDto.bnkAlias;
    }
    if (this.hasOwnProperty(saveBankListDto, 'bnkRbiCode')) {
      data.bnkRbiCode = saveBankListDto.bnkRbiCode;
    }
    if (this.hasOwnProperty(saveBankListDto, 'bnkIbanSupported')) {
      data.bnkIbanSupported = saveBankListDto.bnkIbanSupported;
    }
    if (this.hasOwnProperty(saveBankListDto, 'bnkIsActive')) {
      data.bnkIsActive = saveBankListDto.bnkIsActive;
    }
  }
  private normalizeRequiredName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'bnkName',
          message: 'bnkName must not be empty',
        },
      ]);
    }
    return trimmed;
  }
  private toPayload(record: BankMaster): BankListPayload {
    return {
      bnkId: record.bnkId,
      bnkName: record.bnkName,
      bnkShortName: record.bnkShortName,
      bnkAlias: record.bnkAlias,
      bnkRbiCode: record.bnkRbiCode,
      bnkIbanSupported: record.bnkIbanSupported,
      bnkIsActive: record.bnkIsActive,
      bnkIsDeleted: record.bnkIsDeleted,
      bnkSyncDate: record.bnkSyncDate ? record.bnkSyncDate.toISOString() : null,
      bnkCreatedOn: record.bnkCreatedOn.toISOString(),
      bnkCreatedBy: record.bnkCreatedBy,
      bnkModifiedOn: record.bnkModifiedOn.toISOString(),
      bnkModifiedBy: record.bnkModifiedBy,
    };
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
        this.buildErrorResponse('Bank already exists', [
          {
            field: 'bnkName',
            message: 'Duplicate bnkName is not allowed',
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
  private throwNotFound(bnkId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Bank not found', [
        {
          field: 'bnkId',
          message: `No active bank found with id ${bnkId}`,
        },
      ]),
    );
  }
  private throwBadRequest(message: string, errors: BankListErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }
  private buildErrorResponse(
    message: string,
    errors: BankListErrorDetail[] = [],
  ): BankListErrorResponse {
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
