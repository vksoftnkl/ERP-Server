import { Injectable } from '@nestjs/common';
import { AccTenderMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveTenderMasterDto } from './dto/save-tender-master.dto';
import { TenderMasterErrorDetail, TenderMasterPayload } from './types/tender-master-api.types';
import {
  applyPresentFields,
  DEFAULT_ACTOR,
  hasOwnProperty,
  normalizeNullableString,
  normalizeRequiredText,
  throwAccountsBadRequest,
  throwAccountsConflict,
  throwAccountsNotFound,
  throwOnUniqueConstraintError,
} from 'src/common/utils/module-service.utils';
import type {
  AccountsWriteClient,
  PresentFieldTransform,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
const TENDER_MASTER_TABLE_NAME = 'account tender master';
const TENDER_MASTER_AUDIT_SCREEN_NAME = 'Tender Master';
const TENDER_SHORT_NAME_MAX_LENGTH = 30;
type TenderMasterWriteClient = AccountsWriteClient;
// Columns written straight from the payload when the key is present. tndName,
// tndShortName, tndTypeId, tndLedgerId and the tenant/audit columns are resolved
// explicitly instead — they are required, derived, or need a lookup first.
const TENDER_MASTER_OPTIONAL_FIELDS = [
  'tndSettlementLedgerId',
  'tndSettlementDays',
  'tndBankAccountId',
  'tndMaxAmount',
  'tndDailyLimit',
  'tndSurchargePerc',
  'tndSurchargeAmount',
  'tndSurchargeLedgerId',
  'tndEditSurcharge',
  'tndEditLedger',
  'tndUpiVpa',
  'tndUpiQrPayload',
  'tndMerchantId',
  'tndTerminalId',
  'tndConversionRate',
  'tndNeedsRef',
  'tndAllowChange',
  'tndAllowInReturn',
  'tndOpenCashDrawer',
  'tndIsDefault',
  'tndDisplayPosition',
  'tndHotkey',
  'tndColour',
  'tndEffectiveFrom',
  'tndEffectiveTo',
  'tndRemarks',
  'tndIsActive',
  'tndTallyGuid',
] as const;
// NOT NULL columns carrying a DB default: an explicit null is dropped rather
// than written, so the default (or the stored value on update) survives instead
// of the insert failing.
const TENDER_MASTER_DEFAULTED_FIELDS = [
  'tndSettlementDays',
  'tndSurchargePerc',
  'tndSurchargeAmount',
  'tndEditSurcharge',
  'tndEditLedger',
  'tndConversionRate',
  'tndOpenCashDrawer',
  'tndIsDefault',
  'tndDisplayPosition',
  'tndIsActive',
] as const;
// tnd_effective_from / tnd_effective_to are DATE columns; Prisma wants a Date.
const TENDER_MASTER_DATE_FIELDS = ['tndEffectiveFrom', 'tndEffectiveTo'] as const;
// Nullable text columns — a blank string is stored as NULL rather than ''.
const TENDER_MASTER_TEXT_FIELDS = [
  'tndUpiVpa',
  'tndUpiQrPayload',
  'tndMerchantId',
  'tndTerminalId',
  'tndHotkey',
  'tndColour',
  'tndRemarks',
  'tndTallyGuid',
] as const;
function dropNullish(value: unknown): unknown {
  return value === null ? undefined : value;
}
function toDateOrNull(value: unknown, field: string): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) {
    throwAccountsBadRequest<TenderMasterErrorDetail>('Validation failed', [
      {
        field,
        message: `${field} must be a valid ISO date`,
      },
    ]);
  }

  return parsed;
}
const TENDER_MASTER_FIELD_TRANSFORMS: Partial<Record<string, PresentFieldTransform>> = {
  ...Object.fromEntries(TENDER_MASTER_DEFAULTED_FIELDS.map((field) => [field, dropNullish])),
  ...Object.fromEntries(
    TENDER_MASTER_TEXT_FIELDS.map((field) => [
      field,
      (value: unknown) => normalizeNullableString(value as string | null | undefined),
    ]),
  ),
  ...Object.fromEntries(
    TENDER_MASTER_DATE_FIELDS.map((field) => [
      field,
      (value: unknown) => toDateOrNull(value, field),
    ]),
  ),
};

@Injectable()
export class TenderMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async save(saveTenderMasterDto: SaveTenderMasterDto): Promise<TenderMasterPayload> {
    if (saveTenderMasterDto.tndId) {
      return this.updateTender(saveTenderMasterDto);
    }

    return this.createTender(saveTenderMasterDto);
  }

  async getById(tndId: string): Promise<TenderMasterPayload> {
    const record = await this.prisma.accTenderMaster.findFirst({
      where: {
        tndId,
        tndIsDeleted: false,
      },
    });

    if (!record) {
      throwAccountsNotFound<TenderMasterErrorDetail>(
        'Tender not found',
        'tndId',
        `No active tender found with id ${tndId}`,
      );
    }

    return this.toPayload(record);
  }

  async softDelete(tndId: string): Promise<{ tndId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.accTenderMaster.findFirst({
        where: {
          tndId,
          tndIsDeleted: false,
        },
      });

      if (!existing) {
        throwAccountsNotFound<TenderMasterErrorDetail>(
          'Tender not found',
          'tndId',
          `No active tender found with id ${tndId}`,
        );
      }

      const modifiedOn = new Date();
      const result = await tx.accTenderMaster.updateMany({
        where: {
          tndId,
          tndIsDeleted: false,
        },
        data: {
          tndIsDeleted: true,
          tndIsActive: false,
          tndModifiedOn: modifiedOn,
          tndModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        },
      });

      if (result.count === 0) {
        throwAccountsNotFound<TenderMasterErrorDetail>(
          'Tender not found',
          'tndId',
          `No active tender found with id ${tndId}`,
        );
      }

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        tndIsDeleted: true,
        tndIsActive: false,
        tndModifiedOn: modifiedOn,
        tndModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
      });

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: TENDER_MASTER_TABLE_NAME,
          screenName: TENDER_MASTER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: tndId,
          displayName: existing.tndName,
          originalRecord,
          modifiedRecord,
          userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
          notes: 'Tender soft deleted',
        },
        tx,
      );

      return {
        tndId,
        deleted: true,
      };
    });
  }

  private async createTender(
    saveTenderMasterDto: SaveTenderMasterDto,
  ): Promise<TenderMasterPayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const tndName = normalizeRequiredText<TenderMasterErrorDetail>(
          saveTenderMasterDto.tndName,
          'tndName',
        );
        const tndShortName = this.buildShortName(saveTenderMasterDto, tndName);
        const tndTypeId = this.parseTenderTypeId(saveTenderMasterDto.tndTypeId, 'tndTypeId');
        const tndBranchId = saveTenderMasterDto.tndBranchId ?? null;
        const tndMinAmount = this.toInputNumber(saveTenderMasterDto.tndMinAmount, 'tndMinAmount');
        const tndMaxAmount = this.toInputNullableNumber(
          saveTenderMasterDto.tndMaxAmount,
          'tndMaxAmount',
        );
        this.validateAmountRange(tndMinAmount, tndMaxAmount);
        this.validateEffectiveRange(
          toDateOrNull(saveTenderMasterDto.tndEffectiveFrom, 'tndEffectiveFrom') ?? null,
          toDateOrNull(saveTenderMasterDto.tndEffectiveTo, 'tndEffectiveTo') ?? null,
        );

        const scope = { companyId: saveTenderMasterDto.tndCompanyId, branchId: tndBranchId };
        await this.ensureCompanyExists(tx, scope.companyId);
        await this.ensureBranchExists(tx, tndBranchId);
        await this.ensureTenderTypeExists(tndTypeId, tx);
        await this.ensureLedgerExists(saveTenderMasterDto.tndLedgerId, tx, 'tndLedgerId');
        await this.ensureLedgerExists(
          saveTenderMasterDto.tndSettlementLedgerId,
          tx,
          'tndSettlementLedgerId',
        );
        await this.ensureLedgerExists(
          saveTenderMasterDto.tndSurchargeLedgerId,
          tx,
          'tndSurchargeLedgerId',
        );
        await this.ensureBankAccountExists(tx, saveTenderMasterDto.tndBankAccountId);
        await this.ensureNameIsUnique(tx, tndName, tndShortName, scope);
        await this.ensureHotkeyIsUnique(tx, saveTenderMasterDto.tndHotkey ?? null, scope);
        await this.ensureSingleDefault(
          tx,
          saveTenderMasterDto.tndIsDefault === true,
          saveTenderMasterDto.tndIsActive !== false,
          scope,
        );

        const now = new Date();
        const data: Prisma.AccTenderMasterUncheckedCreateInput = {
          tndCompanyId: scope.companyId,
          tndBranchId,
          tndTypeId,
          tndName,
          tndShortName,
          tndLedgerId: saveTenderMasterDto.tndLedgerId,
          tndMinAmount,
          ...this.buildOptionalData(saveTenderMasterDto),
          tndCreatedOn: now,
          tndCreatedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        };

        const created = await tx.accTenderMaster.create({ data });
        const payload = this.toPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: TENDER_MASTER_TABLE_NAME,
            screenName: TENDER_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.tndId,
            displayName: payload.tndName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Tender created',
          },
          tx,
        );

        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<TenderMasterErrorDetail>(error, 'Tender already exists', [
        { field: 'tndName', message: 'Duplicate tender unique value is not allowed' },
      ]);
      throw error;
    }
  }

  private async updateTender(
    saveTenderMasterDto: SaveTenderMasterDto,
  ): Promise<TenderMasterPayload> {
    const tndId = saveTenderMasterDto.tndId!;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.accTenderMaster.findFirst({
          where: {
            tndId,
            tndIsDeleted: false,
          },
        });

        if (!existing) {
          throwAccountsNotFound<TenderMasterErrorDetail>(
            'Tender not found',
            'tndId',
            `No active tender found with id ${tndId}`,
          );
        }

        const tndName = normalizeRequiredText<TenderMasterErrorDetail>(
          saveTenderMasterDto.tndName,
          'tndName',
        );
        const tndShortName = this.buildShortName(saveTenderMasterDto, tndName);
        const tndTypeId = this.parseTenderTypeId(saveTenderMasterDto.tndTypeId, 'tndTypeId');
        // tndBranchId is only re-scoped when the caller sends the key; omitting
        // it keeps the row on the branch it was created against rather than
        // silently promoting a branch tender to company-wide.
        const tndBranchId = hasOwnProperty(saveTenderMasterDto, 'tndBranchId')
          ? (saveTenderMasterDto.tndBranchId ?? null)
          : existing.tndBranchId;
        const tndMinAmount = this.toInputNumber(saveTenderMasterDto.tndMinAmount, 'tndMinAmount');
        // Omitted keys keep the stored value, so the cross-field checks below
        // compare the merged result rather than the payload alone — otherwise a
        // request that only moves one end of a range could break the DB CHECK.
        const tndMaxAmount = hasOwnProperty(saveTenderMasterDto, 'tndMaxAmount')
          ? this.toInputNullableNumber(saveTenderMasterDto.tndMaxAmount, 'tndMaxAmount')
          : this.toOutputNullableNumber(existing.tndMaxAmount);
        this.validateAmountRange(tndMinAmount, tndMaxAmount);
        this.validateEffectiveRange(
          this.resolveDate(saveTenderMasterDto, 'tndEffectiveFrom', existing.tndEffectiveFrom),
          this.resolveDate(saveTenderMasterDto, 'tndEffectiveTo', existing.tndEffectiveTo),
        );

        const scope = { companyId: saveTenderMasterDto.tndCompanyId, branchId: tndBranchId };
        await this.ensureCompanyExists(tx, scope.companyId);
        await this.ensureBranchExists(tx, tndBranchId);
        await this.ensureTenderTypeExists(tndTypeId, tx);
        await this.ensureLedgerExists(saveTenderMasterDto.tndLedgerId, tx, 'tndLedgerId');
        await this.ensureLedgerExists(
          saveTenderMasterDto.tndSettlementLedgerId,
          tx,
          'tndSettlementLedgerId',
        );
        await this.ensureLedgerExists(
          saveTenderMasterDto.tndSurchargeLedgerId,
          tx,
          'tndSurchargeLedgerId',
        );
        await this.ensureBankAccountExists(tx, saveTenderMasterDto.tndBankAccountId);
        await this.ensureNameIsUnique(tx, tndName, tndShortName, scope, tndId);
        await this.ensureHotkeyIsUnique(
          tx,
          hasOwnProperty(saveTenderMasterDto, 'tndHotkey')
            ? (saveTenderMasterDto.tndHotkey ?? null)
            : existing.tndHotkey,
          scope,
          tndId,
        );
        await this.ensureSingleDefault(
          tx,
          hasOwnProperty(saveTenderMasterDto, 'tndIsDefault')
            ? saveTenderMasterDto.tndIsDefault === true
            : existing.tndIsDefault,
          hasOwnProperty(saveTenderMasterDto, 'tndIsActive')
            ? saveTenderMasterDto.tndIsActive !== false
            : existing.tndIsActive,
          scope,
          tndId,
        );

        const data: Prisma.AccTenderMasterUncheckedUpdateInput = {
          tndCompanyId: scope.companyId,
          tndBranchId,
          tndTypeId,
          tndName,
          tndShortName,
          tndLedgerId: saveTenderMasterDto.tndLedgerId,
          tndMinAmount,
          ...this.buildOptionalData(saveTenderMasterDto),
          tndModifiedOn: new Date(),
          tndModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        };

        const updated = await tx.accTenderMaster.update({
          where: {
            tndId,
          },
          data,
        });
        const payload = this.toPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: TENDER_MASTER_TABLE_NAME,
            screenName: TENDER_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: tndId,
            displayName: payload.tndName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Tender updated',
          },
          tx,
        );

        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<TenderMasterErrorDetail>(error, 'Tender already exists', [
        { field: 'tndName', message: 'Duplicate tender unique value is not allowed' },
      ]);
      throw error;
    }
  }

  private async ensureCompanyExists(tx: TenderMasterWriteClient, companyId: string): Promise<void> {
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
      throwAccountsBadRequest<TenderMasterErrorDetail>('Company does not exist', [
        {
          field: 'tndCompanyId',
          message: `No active company found with id ${companyId}`,
        },
      ]);
    }
  }

  private async ensureBranchExists(
    tx: TenderMasterWriteClient,
    branchId: string | null,
  ): Promise<void> {
    if (branchId === null) {
      return;
    }

    const branch = await tx.branchMaster.findFirst({
      where: {
        brId: branchId,
        brIsDeleted: false,
      },
      select: {
        brId: true,
      },
    });

    if (!branch) {
      throwAccountsBadRequest<TenderMasterErrorDetail>('Branch does not exist', [
        {
          field: 'tndBranchId',
          message: `No active branch found with id ${branchId}`,
        },
      ]);
    }
  }

  private async ensureTenderTypeExists(typeId: number, tx: TenderMasterWriteClient): Promise<void> {
    const tenderType = await tx.accTenderType.findFirst({
      where: {
        ttmTypeId: typeId,
        ttmIsDeleted: false,
      },
      select: {
        ttmTypeId: true,
      },
    });

    if (!tenderType) {
      throwAccountsBadRequest<TenderMasterErrorDetail>('Tender type does not exist', [
        {
          field: 'tndTypeId',
          message: `No active tender type found with id ${typeId.toString()}`,
        },
      ]);
    }
  }

  // Shared by the posting, settlement and surcharge ledgers — the error is
  // reported against whichever field carried the id.
  private async ensureLedgerExists(
    ledgerId: string | null | undefined,
    tx: TenderMasterWriteClient,
    field: string,
  ): Promise<void> {
    if (ledgerId === null || ledgerId === undefined) {
      return;
    }

    const ledger = await tx.accLedgerMaster.findFirst({
      where: {
        ledId: ledgerId,
        ledIsDeleted: false,
      },
      select: {
        ledId: true,
      },
    });

    if (!ledger) {
      throwAccountsBadRequest<TenderMasterErrorDetail>('Ledger does not exist', [
        {
          field,
          message: `No active account ledger found with id ${ledgerId}`,
        },
      ]);
    }
  }

  private async ensureBankAccountExists(
    tx: TenderMasterWriteClient,
    bankAccountId: string | null | undefined,
  ): Promise<void> {
    if (bankAccountId === null || bankAccountId === undefined) {
      return;
    }

    const bankAccount = await tx.accLedgerBankAccount.findFirst({
      where: {
        lbaId: bankAccountId,
        lbaIsDeleted: false,
      },
      select: {
        lbaId: true,
      },
    });

    if (!bankAccount) {
      throwAccountsBadRequest<TenderMasterErrorDetail>('Bank account does not exist', [
        {
          field: 'tndBankAccountId',
          message: `No active ledger bank account found with id ${bankAccountId}`,
        },
      ]);
    }
  }

  // Mirrors the DB-only partial unique indexes ux_tnd_name and ux_tnd_short_name,
  // which are scoped to (company, branch, lower(value)) over non-deleted rows —
  // NOT to the tender type. Prisma cannot express partial indexes, so a duplicate
  // that slips past this check surfaces as a raw unique-constraint error instead
  // of a field-level message.
  private async ensureNameIsUnique(
    tx: TenderMasterWriteClient,
    tndName: string,
    tndShortName: string,
    scope: { companyId: string; branchId: string | null },
    excludeTndId?: string,
  ): Promise<void> {
    const scopeWhere = {
      tndIsDeleted: false,
      tndCompanyId: scope.companyId,
      tndBranchId: scope.branchId,
      ...(excludeTndId
        ? {
            tndId: {
              not: excludeTndId,
            },
          }
        : {}),
    };

    const existingName = await tx.accTenderMaster.findFirst({
      where: {
        ...scopeWhere,
        tndName: {
          equals: tndName,
          mode: 'insensitive',
        },
      },
      select: {
        tndId: true,
      },
    });

    if (existingName) {
      throwAccountsConflict<TenderMasterErrorDetail>(
        'Tender name already exists for this company and branch',
        [{ field: 'tndName', message: 'Duplicate tndName is not allowed for this company/branch' }],
      );
    }

    const existingShortName = await tx.accTenderMaster.findFirst({
      where: {
        ...scopeWhere,
        tndShortName: {
          equals: tndShortName,
          mode: 'insensitive',
        },
      },
      select: {
        tndId: true,
      },
    });

    if (existingShortName) {
      throwAccountsConflict<TenderMasterErrorDetail>(
        'Tender short name already exists for this company and branch',
        [
          {
            field: 'tndShortName',
            message: 'Duplicate tndShortName is not allowed for this company/branch',
          },
        ],
      );
    }
  }

  // Mirrors the DB-only partial unique index ux_tnd_hotkey — one hotkey per
  // (company, branch) over non-deleted rows.
  private async ensureHotkeyIsUnique(
    tx: TenderMasterWriteClient,
    tndHotkey: string | null,
    scope: { companyId: string; branchId: string | null },
    excludeTndId?: string,
  ): Promise<void> {
    if (tndHotkey === null) {
      return;
    }

    const existing = await tx.accTenderMaster.findFirst({
      where: {
        tndIsDeleted: false,
        tndCompanyId: scope.companyId,
        tndBranchId: scope.branchId,
        tndHotkey,
        ...(excludeTndId ? { tndId: { not: excludeTndId } } : {}),
      },
      select: {
        tndId: true,
      },
    });

    if (existing) {
      throwAccountsConflict<TenderMasterErrorDetail>(
        'Tender hotkey already exists for this company and branch',
        [
          {
            field: 'tndHotkey',
            message: 'Duplicate tndHotkey is not allowed for this company/branch',
          },
        ],
      );
    }
  }

  // Mirrors the DB-only partial unique index ux_tnd_default — at most one active
  // default tender per (company, branch).
  private async ensureSingleDefault(
    tx: TenderMasterWriteClient,
    tndIsDefault: boolean,
    tndIsActive: boolean,
    scope: { companyId: string; branchId: string | null },
    excludeTndId?: string,
  ): Promise<void> {
    if (!tndIsDefault || !tndIsActive) {
      return;
    }

    const existing = await tx.accTenderMaster.findFirst({
      where: {
        tndIsDeleted: false,
        tndIsActive: true,
        tndIsDefault: true,
        tndCompanyId: scope.companyId,
        tndBranchId: scope.branchId,
        ...(excludeTndId ? { tndId: { not: excludeTndId } } : {}),
      },
      select: {
        tndId: true,
        tndName: true,
      },
    });

    if (existing) {
      throwAccountsConflict<TenderMasterErrorDetail>(
        'A default tender already exists for this company and branch',
        [
          {
            field: 'tndIsDefault',
            message: `${existing.tndName} is already the default tender for this company/branch`,
          },
        ],
      );
    }
  }

  private validateAmountRange(tndMinAmount: number, tndMaxAmount: number | null | undefined): void {
    if (tndMaxAmount === null || tndMaxAmount === undefined) {
      return;
    }

    if (tndMaxAmount < tndMinAmount) {
      throwAccountsBadRequest<TenderMasterErrorDetail>('Validation failed', [
        {
          field: 'tndMaxAmount',
          message: 'tndMaxAmount must be greater than or equal to tndMinAmount',
        },
      ]);
    }
  }

  private validateEffectiveRange(tndEffectiveFrom: Date | null, tndEffectiveTo: Date | null): void {
    if (tndEffectiveFrom === null || tndEffectiveTo === null) {
      return;
    }

    if (tndEffectiveTo.getTime() < tndEffectiveFrom.getTime()) {
      throwAccountsBadRequest<TenderMasterErrorDetail>('Validation failed', [
        {
          field: 'tndEffectiveTo',
          message: 'tndEffectiveTo must be on or after tndEffectiveFrom',
        },
      ]);
    }
  }

  // An absent key keeps the stored date; an explicit null clears it.
  private resolveDate(
    saveTenderMasterDto: SaveTenderMasterDto,
    field: 'tndEffectiveFrom' | 'tndEffectiveTo',
    current: Date | null,
  ): Date | null {
    if (!hasOwnProperty(saveTenderMasterDto, field)) {
      return current;
    }

    return toDateOrNull(saveTenderMasterDto[field], field) ?? null;
  }

  private buildOptionalData(
    saveTenderMasterDto: SaveTenderMasterDto,
  ): Partial<Prisma.AccTenderMasterUncheckedCreateInput> {
    const data: Partial<Prisma.AccTenderMasterUncheckedCreateInput> = {};
    applyPresentFields(
      data,
      saveTenderMasterDto,
      TENDER_MASTER_OPTIONAL_FIELDS,
      TENDER_MASTER_FIELD_TRANSFORMS,
    );

    return data;
  }

  private parseTenderTypeId(value: string, field: string): number {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) {
      throwAccountsBadRequest<TenderMasterErrorDetail>('Validation failed', [
        {
          field,
          message: `${field} must be a valid numeric identifier`,
        },
      ]);
    }

    const parsed = Number(normalized);
    // tnd_type_id is a 32-bit integer column; anything wider is a client error
    // rather than a lookup that simply misses.
    if (!Number.isSafeInteger(parsed) || parsed > 2147483647) {
      throwAccountsBadRequest<TenderMasterErrorDetail>('Validation failed', [
        {
          field,
          message: `${field} must be a valid numeric identifier`,
        },
      ]);
    }

    return parsed;
  }

  private toInputNumber(value: number, field: string): number {
    if (!Number.isFinite(value)) {
      throwAccountsBadRequest<TenderMasterErrorDetail>('Validation failed', [
        {
          field,
          message: `${field} must be a finite number`,
        },
      ]);
    }

    return value;
  }

  private toInputNullableNumber(
    value: number | null | undefined,
    field: string,
  ): number | null | undefined {
    if (value === null || value === undefined) {
      return value;
    }

    return this.toInputNumber(value, field);
  }

  // tnd_short_name is VARCHAR(30) while tnd_name is VARCHAR(100), so a derived
  // short name has to be clipped or the insert fails on a long tender name.
  private buildShortName(saveTenderMasterDto: SaveTenderMasterDto, tndName: string): string {
    const provided = saveTenderMasterDto.tndShortName?.trim();
    return (provided || tndName).slice(0, TENDER_SHORT_NAME_MAX_LENGTH);
  }

  private toOutputNumber(value: Prisma.Decimal | number): number {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value.toString());
  }

  private toOutputNullableNumber(value: Prisma.Decimal | number | null): number | null {
    return value === null ? null : this.toOutputNumber(value);
  }

  // tnd_effective_from / tnd_effective_to are DATE columns — emitting the full
  // ISO timestamp would hand clients a UTC midnight they have to strip again.
  private toOutputDateOnly(value: Date | null): string | null {
    return value === null ? null : value.toISOString().slice(0, 10);
  }

  private toPayload(record: AccTenderMaster): TenderMasterPayload {
    return {
      tndId: record.tndId,
      tndCompanyId: record.tndCompanyId,
      tndBranchId: record.tndBranchId,
      tndTypeId: record.tndTypeId.toString(),
      tndName: record.tndName,
      tndShortName: record.tndShortName,
      tndLedgerId: record.tndLedgerId,
      tndSettlementLedgerId: record.tndSettlementLedgerId,
      tndSettlementDays: record.tndSettlementDays,
      tndBankAccountId: record.tndBankAccountId,
      tndMinAmount: this.toOutputNumber(record.tndMinAmount),
      tndMaxAmount: this.toOutputNullableNumber(record.tndMaxAmount),
      tndDailyLimit: this.toOutputNullableNumber(record.tndDailyLimit),
      tndSurchargePerc: this.toOutputNumber(record.tndSurchargePerc),
      tndSurchargeAmount: this.toOutputNumber(record.tndSurchargeAmount),
      tndSurchargeLedgerId: record.tndSurchargeLedgerId,
      tndEditSurcharge: record.tndEditSurcharge,
      tndEditLedger: record.tndEditLedger,
      tndUpiVpa: record.tndUpiVpa,
      tndUpiQrPayload: record.tndUpiQrPayload,
      tndMerchantId: record.tndMerchantId,
      tndTerminalId: record.tndTerminalId,
      tndConversionRate: this.toOutputNumber(record.tndConversionRate),
      tndNeedsRef: record.tndNeedsRef,
      tndAllowChange: record.tndAllowChange,
      tndAllowInReturn: record.tndAllowInReturn,
      tndOpenCashDrawer: record.tndOpenCashDrawer,
      tndIsDefault: record.tndIsDefault,
      tndDisplayPosition: record.tndDisplayPosition,
      tndHotkey: record.tndHotkey,
      tndColour: record.tndColour,
      tndEffectiveFrom: this.toOutputDateOnly(record.tndEffectiveFrom),
      tndEffectiveTo: this.toOutputDateOnly(record.tndEffectiveTo),
      tndRemarks: record.tndRemarks,
      tndIsActive: record.tndIsActive,
      tndIsDeleted: record.tndIsDeleted,
      tndTallyGuid: record.tndTallyGuid,
      tndSyncDate: record.tndSyncDate ? record.tndSyncDate.toISOString() : null,
      tndCreatedOn: record.tndCreatedOn.toISOString(),
      tndCreatedBy: record.tndCreatedBy,
      tndModifiedOn: record.tndModifiedOn ? record.tndModifiedOn.toISOString() : null,
      tndModifiedBy: record.tndModifiedBy,
    };
  }
}
