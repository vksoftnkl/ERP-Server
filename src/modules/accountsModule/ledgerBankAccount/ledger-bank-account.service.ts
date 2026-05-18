import { Injectable } from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { AccLedgerBankAccount, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListLedgerBankAccountQueryDto } from './dto/list-ledger-bank-account-query.dto';
import { SaveLedgerBankAccountDto } from './dto/save-ledger-bank-account.dto';
import {
  LedgerBankAccountErrorDetail,
  LedgerBankAccountListItem,
  LedgerBankAccountListMeta,
  LedgerBankAccountPayload,
} from './types/ledger-bank-account-api.types';
import {
  DEFAULT_ACTOR,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  hasOwnProperty,
  isForeignKeyConstraintError,
  normalizeRequiredText,
  throwAccountsBadRequest,
  throwAccountsConflict,
  throwAccountsNotFound,
  throwOnUniqueConstraintError,
} from 'src/common/utils/module-service.utils';
import type { AccountsWriteClient } from 'src/common/utils/module-service.utils';
const LEDGER_BANK_ACCOUNT_TABLE_NAME = 'acc ledger bank accounts';
const LEDGER_BANK_ACCOUNT_AUDIT_SCREEN_NAME = 'Ledger Bank Account';
type LedgerBankAccountWriteClient = AccountsWriteClient;
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
  ): Promise<ConfiguredGridListResult<LedgerBankAccountListItem, LedgerBankAccountListMeta>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const hasStructuredFilters =
      queryDto.lbaCompanyId !== undefined ||
      Boolean(queryDto.lbaLedgerId?.trim()) ||
      queryDto.lbaIsActive !== undefined ||
      queryDto.lbaIsDefault !== undefined;
    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(queryDto.search, page, limit, skip);
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
    const [total, records, styles] = await Promise.all([
      this.prisma.accLedgerBankAccount.count({ where }),
      this.prisma.accLedgerBankAccount.findMany({
        where,
        orderBy: [{ lbaIsDefault: 'desc' }, { lbaAccountHolder: 'asc' }, { lbaId: 'asc' }],
        skip,
        take: limit,
      }),
      this.configuredGridSqlService.loadPrimaryGridStyles(LEDGER_BANK_ACCOUNT_TABLE_NAME),
    ]);
    return {
      items: records.map((record) => this.toPayload(record)),
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
      ...(styles !== undefined && { styles }),
    };
  }
  private async listFromConfiguredGridSql(
    search: string | undefined,
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
      throwAccountsNotFound<LedgerBankAccountErrorDetail>('Ledger bank account not found', 'lbaId', `No active ledger bank account found with id ${lbaId}`);
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
        throwAccountsNotFound<LedgerBankAccountErrorDetail>('Ledger bank account not found', 'lbaId', `No active ledger bank account found with id ${lbaId}`);
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
        throwAccountsNotFound<LedgerBankAccountErrorDetail>('Ledger bank account not found', 'lbaId', `No active ledger bank account found with id ${lbaId}`);
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
        const accountHolder = normalizeRequiredText<LedgerBankAccountErrorDetail>(
          saveLedgerBankAccountDto.lbaAccountHolder,
          'lbaAccountHolder',
        );
        const bankName = normalizeRequiredText<LedgerBankAccountErrorDetail>(
          saveLedgerBankAccountDto.lbaBankName,
          'lbaBankName',
        );
        const accountNo = normalizeRequiredText<LedgerBankAccountErrorDetail>(
          saveLedgerBankAccountDto.lbaAccountNo,
          'lbaAccountNo',
        );
        const ledger = await this.ensureLedgerExists(saveLedgerBankAccountDto.lbaLedgerId, tx);
        const requestedCompanyId = hasOwnProperty(saveLedgerBankAccountDto, 'lbaCompanyId')
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
      throwOnUniqueConstraintError<LedgerBankAccountErrorDetail>(error, 'Ledger bank account already exists', [{ field: 'lbaAccountNo', message: 'Duplicate lbaAccountNo is not allowed' }]);
      if (isForeignKeyConstraintError(error)) {
        throwAccountsBadRequest<LedgerBankAccountErrorDetail>('Invalid reference value provided', [{ field: 'lbaLedgerId', message: 'Referenced ledger or company does not exist' }]);
      }
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
          throwAccountsNotFound<LedgerBankAccountErrorDetail>('Ledger bank account not found', 'lbaId', `No active ledger bank account found with id ${lbaId}`);
        }
        const accountHolder = normalizeRequiredText<LedgerBankAccountErrorDetail>(
          saveLedgerBankAccountDto.lbaAccountHolder,
          'lbaAccountHolder',
        );
        const bankName = normalizeRequiredText<LedgerBankAccountErrorDetail>(
          saveLedgerBankAccountDto.lbaBankName,
          'lbaBankName',
        );
        const accountNo = normalizeRequiredText<LedgerBankAccountErrorDetail>(
          saveLedgerBankAccountDto.lbaAccountNo,
          'lbaAccountNo',
        );
        const ledger = await this.ensureLedgerExists(saveLedgerBankAccountDto.lbaLedgerId, tx);
        const requestedCompanyId = hasOwnProperty(saveLedgerBankAccountDto, 'lbaCompanyId')
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
      throwOnUniqueConstraintError<LedgerBankAccountErrorDetail>(error, 'Ledger bank account already exists', [{ field: 'lbaAccountNo', message: 'Duplicate lbaAccountNo is not allowed' }]);
      if (isForeignKeyConstraintError(error)) {
        throwAccountsBadRequest<LedgerBankAccountErrorDetail>('Invalid reference value provided', [{ field: 'lbaLedgerId', message: 'Referenced ledger or company does not exist' }]);
      }
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
      throwAccountsBadRequest<LedgerBankAccountErrorDetail>('Account ledger does not exist', [
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
      throwAccountsBadRequest<LedgerBankAccountErrorDetail>('Company does not exist', [
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
        throwAccountsBadRequest<LedgerBankAccountErrorDetail>('Ledger company mismatch', [
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
      throwAccountsConflict<LedgerBankAccountErrorDetail>('Ledger bank account already exists for this ledger', [
        { field: 'lbaAccountNo', message: 'Duplicate lbaAccountNo is not allowed for this ledger' },
      ]);
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
    if (hasOwnProperty(saveLedgerBankAccountDto, 'lbaBranchName')) {
      data.lbaBranchName = saveLedgerBankAccountDto.lbaBranchName;
    }

    if (hasOwnProperty(saveLedgerBankAccountDto, 'lbaIfscCode')) {
      data.lbaIfscCode = saveLedgerBankAccountDto.lbaIfscCode;
    }

    if (hasOwnProperty(saveLedgerBankAccountDto, 'lbaMicrCode')) {
      data.lbaMicrCode = saveLedgerBankAccountDto.lbaMicrCode;
    }

    if (hasOwnProperty(saveLedgerBankAccountDto, 'lbaAccountType')) {
      data.lbaAccountType = saveLedgerBankAccountDto.lbaAccountType;
    }

    if (hasOwnProperty(saveLedgerBankAccountDto, 'lbaUpiId')) {
      data.lbaUpiId = saveLedgerBankAccountDto.lbaUpiId;
    }

    if (hasOwnProperty(saveLedgerBankAccountDto, 'lbaChequeName')) {
      data.lbaChequeName = saveLedgerBankAccountDto.lbaChequeName;
    }

    if (hasOwnProperty(saveLedgerBankAccountDto, 'lbaIsDefault')) {
      data.lbaIsDefault = saveLedgerBankAccountDto.lbaIsDefault;
    }

    if (hasOwnProperty(saveLedgerBankAccountDto, 'lbaIsActive')) {
      data.lbaIsActive = saveLedgerBankAccountDto.lbaIsActive;
    }

    if (hasOwnProperty(saveLedgerBankAccountDto, 'lbaRemarks')) {
      data.lbaRemarks = saveLedgerBankAccountDto.lbaRemarks;
    }
  }

}
