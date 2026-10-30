import { Injectable } from '@nestjs/common';
import { AccLedgerBankAccount, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveLedgerBankAccountDto } from './dto/save-ledger-bank-account.dto';
import {
  LedgerBankAccountErrorDetail,
  LedgerBankAccountPayload,
} from './types/ledger-bank-account-api.types';
import { LedgerBankErrorCode } from './types/ledger-bank-account-error-codes';
import {
  DEFAULT_ACTOR,
  isPresentField,
  isForeignKeyConstraintError,
  normalizeRequiredText,
  throwAccountsBadRequest,
  throwAccountsConflict,
  throwAccountsNotFound,
  throwOnUniqueConstraintError,
} from 'src/common/utils/module-service.utils';
import type { AccountsWriteClient } from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
const LEDGER_BANK_ACCOUNT_TABLE_NAME = 'acc ledger bank accounts';
const LEDGER_BANK_ACCOUNT_AUDIT_SCREEN_NAME = 'Ledger Bank Account';
type LedgerBankAccountWriteClient = AccountsWriteClient;
@Injectable()
export class LedgerBankAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async save(
    saveLedgerBankAccountDto: SaveLedgerBankAccountDto,
  ): Promise<LedgerBankAccountPayload> {
    if (saveLedgerBankAccountDto.lbaId) {
      return this.updateLedgerBankAccount(saveLedgerBankAccountDto);
    }
    return this.createLedgerBankAccount(saveLedgerBankAccountDto);
  }
  async getById(lbaId: string): Promise<LedgerBankAccountPayload> {
    const record = await this.prisma.accLedgerBankAccount.findFirst({
      where: {
        lbaId,
        lbaIsDeleted: false,
      },
    });
    if (!record) {
      throwAccountsNotFound<LedgerBankAccountErrorDetail>(
        'Ledger bank account not found',
        'lbaId',
        `No active ledger bank account found with id ${lbaId}`,
        LedgerBankErrorCode.NOT_FOUND,
      );
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
        throwAccountsNotFound<LedgerBankAccountErrorDetail>(
          'Ledger bank account not found',
          'lbaId',
          `No active ledger bank account found with id ${lbaId}`,
          LedgerBankErrorCode.NOT_FOUND,
        );
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
          lbaModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        throwAccountsNotFound<LedgerBankAccountErrorDetail>(
          'Ledger bank account not found',
          'lbaId',
          `No active ledger bank account found with id ${lbaId}`,
          LedgerBankErrorCode.NOT_FOUND,
        );
      }
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        lbaIsDeleted: true,
        lbaIsActive: false,
        lbaModifiedOn: modifiedOn,
        lbaModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
          userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
          undefined,
          LedgerBankErrorCode.FIELD_EMPTY,
        );
        const bankName = normalizeRequiredText<LedgerBankAccountErrorDetail>(
          saveLedgerBankAccountDto.lbaBankName,
          'lbaBankName',
          undefined,
          LedgerBankErrorCode.FIELD_EMPTY,
        );
        const accountNo = normalizeRequiredText<LedgerBankAccountErrorDetail>(
          saveLedgerBankAccountDto.lbaAccountNo,
          'lbaAccountNo',
          undefined,
          LedgerBankErrorCode.FIELD_EMPTY,
        );
        const ledger = await this.ensureLedgerExists(saveLedgerBankAccountDto.lbaLedgerId, tx);
        const requestedCompanyId = isPresentField(saveLedgerBankAccountDto, 'lbaCompanyId')
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
          lbaCreatedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Ledger bank account created',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<LedgerBankAccountErrorDetail>(
        error,
        'Ledger bank account already exists',
        [
          {
            field: 'lbaAccountNo',
            message: 'Duplicate lbaAccountNo is not allowed',
            code: LedgerBankErrorCode.DUPLICATE_ACCOUNT_NO,
          },
        ],
      );
      if (isForeignKeyConstraintError(error)) {
        throwAccountsBadRequest<LedgerBankAccountErrorDetail>('Invalid reference value provided', [
          {
            field: 'lbaLedgerId',
            message: 'Referenced ledger or company does not exist',
            code: LedgerBankErrorCode.INVALID_REFERENCE,
          },
        ]);
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
          throwAccountsNotFound<LedgerBankAccountErrorDetail>(
            'Ledger bank account not found',
            'lbaId',
            `No active ledger bank account found with id ${lbaId}`,
            LedgerBankErrorCode.NOT_FOUND,
          );
        }
        const accountHolder = normalizeRequiredText<LedgerBankAccountErrorDetail>(
          saveLedgerBankAccountDto.lbaAccountHolder,
          'lbaAccountHolder',
          undefined,
          LedgerBankErrorCode.FIELD_EMPTY,
        );
        const bankName = normalizeRequiredText<LedgerBankAccountErrorDetail>(
          saveLedgerBankAccountDto.lbaBankName,
          'lbaBankName',
          undefined,
          LedgerBankErrorCode.FIELD_EMPTY,
        );
        const accountNo = normalizeRequiredText<LedgerBankAccountErrorDetail>(
          saveLedgerBankAccountDto.lbaAccountNo,
          'lbaAccountNo',
          undefined,
          LedgerBankErrorCode.FIELD_EMPTY,
        );
        const ledger = await this.ensureLedgerExists(saveLedgerBankAccountDto.lbaLedgerId, tx);
        const requestedCompanyId = isPresentField(saveLedgerBankAccountDto, 'lbaCompanyId')
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
          lbaModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Ledger bank account updated',
          },
          tx,
        );

        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<LedgerBankAccountErrorDetail>(
        error,
        'Ledger bank account already exists',
        [
          {
            field: 'lbaAccountNo',
            message: 'Duplicate lbaAccountNo is not allowed',
            code: LedgerBankErrorCode.DUPLICATE_ACCOUNT_NO,
          },
        ],
      );
      if (isForeignKeyConstraintError(error)) {
        throwAccountsBadRequest<LedgerBankAccountErrorDetail>('Invalid reference value provided', [
          {
            field: 'lbaLedgerId',
            message: 'Referenced ledger or company does not exist',
            code: LedgerBankErrorCode.INVALID_REFERENCE,
          },
        ]);
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
          code: LedgerBankErrorCode.LEDGER_NOT_FOUND,
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
          code: LedgerBankErrorCode.COMPANY_NOT_FOUND,
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
            code: LedgerBankErrorCode.COMPANY_MISMATCH,
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
      throwAccountsConflict<LedgerBankAccountErrorDetail>(
        'Ledger bank account already exists for this ledger',
        [
          {
            field: 'lbaAccountNo',
            message: 'Duplicate lbaAccountNo is not allowed for this ledger',
            code: LedgerBankErrorCode.DUPLICATE_ACCOUNT_NO,
          },
        ],
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
        lbaModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
      },
    });
  }

  private applyOptionalFields(
    data:
      | Prisma.AccLedgerBankAccountUncheckedCreateInput
      | Prisma.AccLedgerBankAccountUncheckedUpdateInput,
    saveLedgerBankAccountDto: SaveLedgerBankAccountDto,
  ): void {
    if (isPresentField(saveLedgerBankAccountDto, 'lbaBranchName')) {
      data.lbaBranchName = saveLedgerBankAccountDto.lbaBranchName;
    }

    if (isPresentField(saveLedgerBankAccountDto, 'lbaIfscCode')) {
      data.lbaIfscCode = saveLedgerBankAccountDto.lbaIfscCode;
    }

    if (isPresentField(saveLedgerBankAccountDto, 'lbaMicrCode')) {
      data.lbaMicrCode = saveLedgerBankAccountDto.lbaMicrCode;
    }

    if (isPresentField(saveLedgerBankAccountDto, 'lbaAccountType')) {
      data.lbaAccountType = saveLedgerBankAccountDto.lbaAccountType;
    }

    if (isPresentField(saveLedgerBankAccountDto, 'lbaUpiId')) {
      data.lbaUpiId = saveLedgerBankAccountDto.lbaUpiId;
    }

    if (isPresentField(saveLedgerBankAccountDto, 'lbaChequeName')) {
      data.lbaChequeName = saveLedgerBankAccountDto.lbaChequeName;
    }

    if (isPresentField(saveLedgerBankAccountDto, 'lbaIsDefault')) {
      data.lbaIsDefault = saveLedgerBankAccountDto.lbaIsDefault;
    }

    if (isPresentField(saveLedgerBankAccountDto, 'lbaIsActive')) {
      data.lbaIsActive = saveLedgerBankAccountDto.lbaIsActive;
    }

    if (isPresentField(saveLedgerBankAccountDto, 'lbaRemarks')) {
      data.lbaRemarks = saveLedgerBankAccountDto.lbaRemarks;
    }
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
}
