import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { AccLedgerBankAccount, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListLedgerBankAccountQueryDto } from './dto/list-ledger-bank-account-query.dto';
import { SaveLedgerBankAccountDto } from './dto/save-ledger-bank-account.dto';
import {
  LedgerBankAccountErrorDetail,
  LedgerBankAccountErrorResponse,
  LedgerBankAccountListItem,
  LedgerBankAccountListMeta,
  LedgerBankAccountPayload,
} from './types/ledger-bank-account-api.types';

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const LEDGER_BANK_ACCOUNT_TABLE_NAME = 'acc_ledger_bank_accounts';
const LEDGER_BANK_ACCOUNT_AUDIT_SCREEN_NAME = 'Ledger Bank Account';

type LedgerBankAccountWriteClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class LedgerBankAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) { }

  async save(
    saveLedgerBankAccountDto: SaveLedgerBankAccountDto,
  ): Promise<LedgerBankAccountPayload> {
    if (saveLedgerBankAccountDto.lbaId) {
      return this.updateLedgerBankAccount(saveLedgerBankAccountDto);
    }

    return this.createLedgerBankAccount(saveLedgerBankAccountDto);
  }

  async list(
    queryDto: ListLedgerBankAccountQueryDto,
  ): Promise<{ items: LedgerBankAccountListItem[]; meta: LedgerBankAccountListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const hasStructuredFilters =
      queryDto.lbaCompanyId !== undefined ||
      Boolean(queryDto.lbaLedgerId?.trim()) ||
      queryDto.lbaIsActive !== undefined ||
      queryDto.lbaIsDefault !== undefined ||
      Boolean(queryDto.search?.trim());

    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }

    const where: Prisma.AccLedgerBankAccountWhereInput = {
      lbaIsDeleted: false,
    };

    if (queryDto.lbaCompanyId !== undefined) {
      where.lbaCompanyId = queryDto.lbaCompanyId as string | "";
    }

    if (queryDto.lbaLedgerId?.trim()) {
      where.lbaLedgerId = queryDto.lbaLedgerId.trim();
    }

    if (queryDto.lbaIsActive !== undefined) {
      where.lbaIsActive = queryDto.lbaIsActive;
    }

    if (queryDto.lbaIsDefault !== undefined) {
      where.lbaIsDefault = queryDto.lbaIsDefault;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { lbaAccountHolder: { contains: search, mode: 'insensitive' } },
        { lbaBankName: { contains: search, mode: 'insensitive' } },
        { lbaBranchName: { contains: search, mode: 'insensitive' } },
        { lbaAccountNo: { contains: search, mode: 'insensitive' } },
        { lbaIfscCode: { contains: search, mode: 'insensitive' } },
        { lbaMicrCode: { contains: search, mode: 'insensitive' } },
        { lbaAccountType: { contains: search, mode: 'insensitive' } },
        { lbaUpiId: { contains: search, mode: 'insensitive' } },
        { lbaChequeName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.accLedgerBankAccount.count({ where }),
      this.prisma.accLedgerBankAccount.findMany({
        where,
        orderBy: [{ lbaIsDefault: 'desc' }, { lbaAccountHolder: 'asc' }, { lbaId: 'asc' }],
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
  ): Promise<ConfiguredGridListResult<LedgerBankAccountListItem, LedgerBankAccountListMeta> | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: LEDGER_BANK_ACCOUNT_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      LEDGER_BANK_ACCOUNT_TABLE_NAME,
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
        tableName: LEDGER_BANK_ACCOUNT_TABLE_NAME,
      });
      if (!validation.isValid) {
        continue;
      }

      try {
        const result = await this.configuredGridSqlService.runPagedQuery<LedgerBankAccountListItem>({
          baseSql: validation.normalizedSql,
          alias: 'ledger_bank_account_grid',
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
        continue;
      }
    }

    return null;
  }

  async getById(lbaId: string): Promise<LedgerBankAccountPayload> {
    const record = await this.prisma.accLedgerBankAccount.findFirst({
      where: {
        lbaId,
        lbaIsDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(lbaId);
    }

    return this.toPayload(record);
  }

  async softDelete(lbaId: string): Promise<{ lbaId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.accLedgerBankAccount.findFirst({
        where: {
          lbaId,
          lbaIsDeleted: false,
        },
      });

      if (!existing) {
        this.throwNotFound(lbaId);
      }

      const modifiedOn = new Date();
      const result = await tx.accLedgerBankAccount.updateMany({
        where: {
          lbaId,
          lbaIsDeleted: false,
        },
        data: {
          lbaIsDeleted: true,
          lbaIsActive: false,
          lbaModifiedOn: modifiedOn,
          lbaModifiedBy: DEFAULT_ACTOR,
        },
      });

      if (result.count === 0) {
        this.throwNotFound(lbaId);
      }

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        lbaIsDeleted: true,
        lbaIsActive: false,
        lbaModifiedOn: modifiedOn,
        lbaModifiedBy: DEFAULT_ACTOR,
      });

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: LEDGER_BANK_ACCOUNT_TABLE_NAME,
          screenName: LEDGER_BANK_ACCOUNT_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: lbaId,
          displayName: existing.lbaAccountHolder,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'Ledger bank account soft deleted',
        },
        tx,
      );

      return {
        lbaId,
        deleted: true,
      };
    });
  }

  private async createLedgerBankAccount(
    saveLedgerBankAccountDto: SaveLedgerBankAccountDto,
  ): Promise<LedgerBankAccountPayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const accountHolder = this.normalizeRequiredString(
          saveLedgerBankAccountDto.lbaAccountHolder,
          'lbaAccountHolder',
        );
        const bankName = this.normalizeRequiredString(
          saveLedgerBankAccountDto.lbaBankName,
          'lbaBankName',
        );
        const accountNo = this.normalizeRequiredString(
          saveLedgerBankAccountDto.lbaAccountNo,
          'lbaAccountNo',
        );

        const ledger = await this.ensureLedgerExists(saveLedgerBankAccountDto.lbaLedgerId, tx);
        const requestedCompanyId = this.hasOwnProperty(saveLedgerBankAccountDto, 'lbaCompanyId')
          ? (saveLedgerBankAccountDto.lbaCompanyId ?? null)
          : undefined;
        const companyId = await this.resolveCompanyId(
          requestedCompanyId,
          null,
          ledger.ledCompanyId,
          tx,
        );

        await this.ensureAccountNumberIsUnique(tx, saveLedgerBankAccountDto.lbaLedgerId, accountNo);

        if (saveLedgerBankAccountDto.lbaIsDefault === true) {
          await this.clearDefaultAccount(tx, saveLedgerBankAccountDto.lbaLedgerId);
        }

        const now = new Date();
        const data: Prisma.AccLedgerBankAccountUncheckedCreateInput = {
          lbaCompanyId: companyId,
          lbaLedgerId: saveLedgerBankAccountDto.lbaLedgerId,
          lbaAccountHolder: accountHolder,
          lbaBankName: bankName,
          lbaAccountNo: accountNo,
          lbaCreatedOn: now,
          lbaCreatedBy: DEFAULT_ACTOR,
          lbaModifiedOn: now,
          lbaModifiedBy: DEFAULT_ACTOR,
        };

        this.applyOptionalFields(data, saveLedgerBankAccountDto);

        const created = await tx.accLedgerBankAccount.create({ data });
        const payload = this.toPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: LEDGER_BANK_ACCOUNT_TABLE_NAME,
            screenName: LEDGER_BANK_ACCOUNT_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.lbaId,
            displayName: payload.lbaAccountHolder,
            originalRecord: null,
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Ledger bank account created',
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

  private async updateLedgerBankAccount(
    saveLedgerBankAccountDto: SaveLedgerBankAccountDto,
  ): Promise<LedgerBankAccountPayload> {
    const lbaId = saveLedgerBankAccountDto.lbaId!;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.accLedgerBankAccount.findFirst({
          where: {
            lbaId,
            lbaIsDeleted: false,
          },
        });

        if (!existing) {
          this.throwNotFound(lbaId);
        }

        const accountHolder = this.normalizeRequiredString(
          saveLedgerBankAccountDto.lbaAccountHolder,
          'lbaAccountHolder',
        );
        const bankName = this.normalizeRequiredString(
          saveLedgerBankAccountDto.lbaBankName,
          'lbaBankName',
        );
        const accountNo = this.normalizeRequiredString(
          saveLedgerBankAccountDto.lbaAccountNo,
          'lbaAccountNo',
        );

        const ledger = await this.ensureLedgerExists(saveLedgerBankAccountDto.lbaLedgerId, tx);
        const requestedCompanyId = this.hasOwnProperty(saveLedgerBankAccountDto, 'lbaCompanyId')
          ? (saveLedgerBankAccountDto.lbaCompanyId ?? null)
          : undefined;
        const companyId = await this.resolveCompanyId(
          requestedCompanyId,
          existing.lbaCompanyId,
          ledger.ledCompanyId,
          tx,
        );

        await this.ensureAccountNumberIsUnique(
          tx,
          saveLedgerBankAccountDto.lbaLedgerId,
          accountNo,
          lbaId,
        );

        if (saveLedgerBankAccountDto.lbaIsDefault === true) {
          await this.clearDefaultAccount(tx, saveLedgerBankAccountDto.lbaLedgerId, lbaId);
        }

        const data: Prisma.AccLedgerBankAccountUncheckedUpdateInput = {
          lbaCompanyId: companyId,
          lbaLedgerId: saveLedgerBankAccountDto.lbaLedgerId,
          lbaAccountHolder: accountHolder,
          lbaBankName: bankName,
          lbaAccountNo: accountNo,
          lbaModifiedOn: new Date(),
          lbaModifiedBy: DEFAULT_ACTOR,
        };

        this.applyOptionalFields(data, saveLedgerBankAccountDto);

        const updated = await tx.accLedgerBankAccount.update({
          where: {
            lbaId,
          },
          data,
        });

        const payload = this.toPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: LEDGER_BANK_ACCOUNT_TABLE_NAME,
            screenName: LEDGER_BANK_ACCOUNT_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: lbaId,
            displayName: payload.lbaAccountHolder,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Ledger bank account updated',
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

  private async ensureLedgerExists(
    lbaLedgerId: string,
    tx: LedgerBankAccountWriteClient,
  ): Promise<{ ledId: string; ledCompanyId: string | null }> {
    const ledger = await tx.accLedgerMaster.findFirst({
      where: {
        ledId: lbaLedgerId,
        ledIsDeleted: false,
      },
      select: {
        ledId: true,
        ledCompanyId: true,
      },
    });

    if (!ledger) {
      this.throwBadRequest('Account ledger does not exist', [
        {
          field: 'lbaLedgerId',
          message: `No active account ledger found with id ${lbaLedgerId}`,
        },
      ]);
    }

    return ledger;
  }

  private async ensureCompanyExists(
    compId: string,
    tx: LedgerBankAccountWriteClient,
  ): Promise<void> {
    const company = await tx.company.findFirst({
      where: {
        compId,
        compIsDeleted: false,
      },
      select: {
        compId: true,
      },
    });

    if (!company) {
      this.throwBadRequest('Company does not exist', [
        {
          field: 'lbaCompanyId',
          message: `No active company found with id ${compId}`,
        },
      ]);
    }
  }

  private async resolveCompanyId(
    requestedCompanyId: string | null | undefined,
    fallbackCompanyId: string | null,
    ledgerCompanyId: string | null,
    tx: LedgerBankAccountWriteClient,
  ): Promise<string | null> {
    let companyId = requestedCompanyId === undefined ? fallbackCompanyId : requestedCompanyId;

    if (ledgerCompanyId !== null) {
      if (companyId === null) {
        companyId = ledgerCompanyId;
      } else if (companyId !== ledgerCompanyId) {
        this.throwBadRequest('Ledger company mismatch', [
          {
            field: 'lbaCompanyId',
            message: `lbaCompanyId ${companyId} must match ledger company id ${ledgerCompanyId}`,
          },
        ]);
      }
    }

    if (companyId !== null) {
      await this.ensureCompanyExists(companyId, tx);
    }

    return companyId;
  }

  private async ensureAccountNumberIsUnique(
    tx: LedgerBankAccountWriteClient,
    lbaLedgerId: string,
    lbaAccountNo: string,
    excludeLbaId?: string,
  ): Promise<void> {
    const existing = await tx.accLedgerBankAccount.findFirst({
      where: {
        lbaIsDeleted: false,
        lbaLedgerId,
        lbaAccountNo: {
          equals: lbaAccountNo,
          mode: 'insensitive',
        },
        ...(excludeLbaId
          ? {
            lbaId: {
              not: excludeLbaId,
            },
          }
          : {}),
      },
      select: {
        lbaId: true,
      },
    });

    if (existing) {
      throw new ConflictException(
        this.buildErrorResponse('Ledger bank account already exists for this ledger', [
          {
            field: 'lbaAccountNo',
            message: 'Duplicate lbaAccountNo is not allowed for this ledger',
          },
        ]),
      );
    }
  }

  private async clearDefaultAccount(
    tx: LedgerBankAccountWriteClient,
    lbaLedgerId: string,
    excludeLbaId?: string,
  ): Promise<void> {
    await tx.accLedgerBankAccount.updateMany({
      where: {
        lbaLedgerId,
        lbaIsDeleted: false,
        lbaIsDefault: true,
        ...(excludeLbaId
          ? {
            lbaId: {
              not: excludeLbaId,
            },
          }
          : {}),
      },
      data: {
        lbaIsDefault: false,
        lbaModifiedOn: new Date(),
        lbaModifiedBy: DEFAULT_ACTOR,
      },
    });
  }

  private applyOptionalFields(
    data:
      | Prisma.AccLedgerBankAccountUncheckedCreateInput
      | Prisma.AccLedgerBankAccountUncheckedUpdateInput,
    saveLedgerBankAccountDto: SaveLedgerBankAccountDto,
  ): void {
    if (this.hasOwnProperty(saveLedgerBankAccountDto, 'lbaBranchName')) {
      data.lbaBranchName = saveLedgerBankAccountDto.lbaBranchName;
    }

    if (this.hasOwnProperty(saveLedgerBankAccountDto, 'lbaIfscCode')) {
      data.lbaIfscCode = saveLedgerBankAccountDto.lbaIfscCode;
    }

    if (this.hasOwnProperty(saveLedgerBankAccountDto, 'lbaMicrCode')) {
      data.lbaMicrCode = saveLedgerBankAccountDto.lbaMicrCode;
    }

    if (this.hasOwnProperty(saveLedgerBankAccountDto, 'lbaAccountType')) {
      data.lbaAccountType = saveLedgerBankAccountDto.lbaAccountType;
    }

    if (this.hasOwnProperty(saveLedgerBankAccountDto, 'lbaUpiId')) {
      data.lbaUpiId = saveLedgerBankAccountDto.lbaUpiId;
    }

    if (this.hasOwnProperty(saveLedgerBankAccountDto, 'lbaChequeName')) {
      data.lbaChequeName = saveLedgerBankAccountDto.lbaChequeName;
    }

    if (this.hasOwnProperty(saveLedgerBankAccountDto, 'lbaIsDefault')) {
      data.lbaIsDefault = saveLedgerBankAccountDto.lbaIsDefault;
    }

    if (this.hasOwnProperty(saveLedgerBankAccountDto, 'lbaIsActive')) {
      data.lbaIsActive = saveLedgerBankAccountDto.lbaIsActive;
    }

    if (this.hasOwnProperty(saveLedgerBankAccountDto, 'lbaRemarks')) {
      data.lbaRemarks = saveLedgerBankAccountDto.lbaRemarks;
    }
  }

  private normalizeRequiredString(value: string, field: string): string {
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

  private toPayload(record: AccLedgerBankAccount): LedgerBankAccountPayload {
    return {
      lbaId: record.lbaId,
      lbaCompanyId: record.lbaCompanyId,
      lbaLedgerId: record.lbaLedgerId,
      lbaAccountHolder: record.lbaAccountHolder,
      lbaBankName: record.lbaBankName,
      lbaBranchName: record.lbaBranchName,
      lbaAccountNo: record.lbaAccountNo,
      lbaIfscCode: record.lbaIfscCode,
      lbaMicrCode: record.lbaMicrCode,
      lbaAccountType: record.lbaAccountType,
      lbaUpiId: record.lbaUpiId,
      lbaChequeName: record.lbaChequeName,
      lbaIsDefault: record.lbaIsDefault,
      lbaIsActive: record.lbaIsActive,
      lbaIsDeleted: record.lbaIsDeleted,
      lbaSyncDate: record.lbaSyncDate ? record.lbaSyncDate.toISOString() : null,
      lbaCreatedOn: record.lbaCreatedOn.toISOString(),
      lbaCreatedBy: record.lbaCreatedBy,
      lbaModifiedOn: record.lbaModifiedOn.toISOString(),
      lbaModifiedBy: record.lbaModifiedBy,
      lbaRemarks: record.lbaRemarks,
    };
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Ledger bank account already exists', [
          {
            field: 'lbaAccountNo',
            message: 'Duplicate lbaAccountNo is not allowed',
          },
        ]),
      );
    }

    if (this.isForeignKeyConstraintError(error)) {
      this.throwBadRequest('Invalid reference value provided', [
        {
          field: 'lbaLedgerId',
          message: 'Referenced ledger or company does not exist',
        },
      ]);
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

  private throwNotFound(lbaId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Ledger bank account not found', [
        {
          field: 'lbaId',
          message: `No active ledger bank account found with id ${lbaId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: LedgerBankAccountErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: LedgerBankAccountErrorDetail[] = [],
  ): LedgerBankAccountErrorResponse {
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
