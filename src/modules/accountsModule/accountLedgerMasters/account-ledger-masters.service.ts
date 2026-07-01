import { Injectable } from '@nestjs/common';
import { AccLedgerBankAccount, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveAccountLedgerMasterDto } from './dto/save-account-ledger-master.dto';
import { LedgerBankAccountItemDto } from './dto/ledger-bank-account-item.dto';
import {
  AccountLedgerMasterErrorDetail,
  AccountLedgerMasterPayload,
  LedgerBankAccountPayload,
  LedGstPartyRegType,
  LedObType,
} from './types/account-ledger-master-api.types';
import {
  DEFAULT_ACTOR,
  hasOwnProperty,
  normalizeRequiredText,
  throwAccountsBadRequest,
  throwAccountsConflict,
  throwAccountsNotFound,
  throwOnUniqueConstraintError,
  toNullableNumber,
  toNumber,
} from 'src/common/utils/module-service.utils';
import type { AccountsWriteClient } from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AccLedgerProfile } from '../accountsGroup/types/account-group-enum';
const ACCOUNT_LEDGER_MASTER_TABLE_NAME = 'acc_ledger_master';
const ACCOUNT_LEDGER_MASTER_AUDIT_SCREEN_NAME = 'Account Ledger Master';
const LEDGER_BANK_ACCOUNT_TABLE_NAME = 'acc_ledger_bank_accounts';
const LEDGER_BANK_ACCOUNT_AUDIT_SCREEN_NAME = 'Ledger Bank Account';
// Default-first, then oldest-first, so the response order is stable.
const LEDGER_BANK_ACCOUNT_ORDER_BY: Prisma.AccLedgerBankAccountOrderByWithRelationInput[] = [
  { lbaIsDefault: 'desc' },
  { lbaCreatedOn: 'asc' },
];
// Related master names + nested bank accounts resolved alongside the ledger payload.
const ACCOUNT_LEDGER_MASTER_RELATIONS = {
  company: { select: { compName: true } },
  branches: { select: { brName: true } },
  accountGroup: { select: { accGroupName: true, accLedgerProfile: true } },
  bankAccounts: {
    where: { lbaIsDeleted: false },
    orderBy: LEDGER_BANK_ACCOUNT_ORDER_BY,
  },
} satisfies Prisma.AccLedgerMasterInclude;
type AccLedgerMasterWithRelations = Prisma.AccLedgerMasterGetPayload<{
  include: typeof ACCOUNT_LEDGER_MASTER_RELATIONS;
}>;
type AccountLedgerWriteClient = AccountsWriteClient;
@Injectable()
export class AccountLedgerMastersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async save(
    saveAccountLedgerMasterDto: SaveAccountLedgerMasterDto,
  ): Promise<AccountLedgerMasterPayload> {
    if (saveAccountLedgerMasterDto.ledId) {
      return this.updateLedger(saveAccountLedgerMasterDto);
    }
    return this.createLedger(saveAccountLedgerMasterDto);
  }
  // Bulk upsert: every item creates (no ledId) or updates (has ledId) inside a
  // single transaction, so the whole batch is all-or-nothing.
  async saveMany(
    saveAccountLedgerMasterDtos: SaveAccountLedgerMasterDto[],
  ): Promise<AccountLedgerMasterPayload[]> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const results: AccountLedgerMasterPayload[] = [];
        for (const dto of saveAccountLedgerMasterDtos) {
          const payload = dto.ledId
            ? await this.updateLedgerWithinTx(dto, tx)
            : await this.createLedgerWithinTx(dto, tx);
          results.push(payload);
        }
        return results;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<AccountLedgerMasterErrorDetail>(
        error,
        'Account ledger already exists',
        [{ field: 'ledName', message: 'Duplicate ledName is not allowed' }],
      );
      throw error;
    }
  }
  // Fetch a single ledger by id
  async get(params: { ledId: string }): Promise<AccountLedgerMasterPayload>;
  // Fetch the full list
  async get(): Promise<{ data: AccountLedgerMasterPayload[]; total: number }>;
  // Implementation
  async get(
    params: { ledId?: string } = {},
  ): Promise<AccountLedgerMasterPayload | { data: AccountLedgerMasterPayload[]; total: number }> {
    const { ledId } = params;
    // --- getById branch ---
    if (ledId) {
      const record = await this.prisma.accLedgerMaster.findFirst({
        where: { ledId, ledIsDeleted: false },
        include: ACCOUNT_LEDGER_MASTER_RELATIONS,
      });
      if (!record) {
        throwAccountsNotFound<AccountLedgerMasterErrorDetail>(
          'Account ledger not found',
          'ledId',
          `No active account ledger found with id ${ledId}`,
        );
      }
      return this.toPayload(record);
    }
    // --- list branch ---
    const where: Prisma.AccLedgerMasterWhereInput = { ledIsDeleted: false };
    const [records, total] = await Promise.all([
      this.prisma.accLedgerMaster.findMany({
        where,
        orderBy: { ledName: 'asc' },
        include: ACCOUNT_LEDGER_MASTER_RELATIONS,
      }),
      this.prisma.accLedgerMaster.count({ where }),
    ]);
    return { data: records.map((r) => this.toPayload(r)), total };
  }
  async softDelete(ledId: string): Promise<{ ledId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.accLedgerMaster.findFirst({
        where: {
          ledId,
          ledIsDeleted: false,
        },
        include: ACCOUNT_LEDGER_MASTER_RELATIONS,
      });
      if (!existing) {
        throwAccountsNotFound<AccountLedgerMasterErrorDetail>(
          'Account ledger not found',
          'ledId',
          `No active account ledger found with id ${ledId}`,
        );
      }
      const modifiedOn = new Date();
      const result = await tx.accLedgerMaster.updateMany({
        where: {
          ledId,
          ledIsDeleted: false,
        },
        data: {
          ledIsDeleted: true,
          ledIsActive: false,
          ledModifiedOn: modifiedOn,
          ledModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        throwAccountsNotFound<AccountLedgerMasterErrorDetail>(
          'Account ledger not found',
          'ledId',
          `No active account ledger found with id ${ledId}`,
        );
      }
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        ledIsDeleted: true,
        ledIsActive: false,
        ledModifiedOn: modifiedOn,
        ledModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: ACCOUNT_LEDGER_MASTER_TABLE_NAME,
          screenName: ACCOUNT_LEDGER_MASTER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: ledId,
          displayName: existing.ledName,
          originalRecord,
          modifiedRecord,
          userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
          notes: 'Account ledger soft deleted',
        },
        tx,
      );
      return {
        ledId,
        deleted: true,
      };
    });
  }
  private async createLedger(
    saveAccountLedgerMasterDto: SaveAccountLedgerMasterDto,
  ): Promise<AccountLedgerMasterPayload> {
    try {
      return await this.prisma.$transaction((tx) =>
        this.createLedgerWithinTx(saveAccountLedgerMasterDto, tx),
      );
    } catch (error: unknown) {
      throwOnUniqueConstraintError<AccountLedgerMasterErrorDetail>(
        error,
        'Account ledger already exists',
        [{ field: 'ledName', message: 'Duplicate ledName is not allowed' }],
      );
      throw error;
    }
  }
  // Create a ledger inside an existing transaction. Exposed (not private) so other
  // modules — e.g. supplier creation, which provisions a linked ledger first — can
  // compose ledger creation into their own transaction and reuse the returned ledId.
  async createLedgerWithinTx(
    saveAccountLedgerMasterDto: SaveAccountLedgerMasterDto,
    tx: AccountLedgerWriteClient,
  ): Promise<AccountLedgerMasterPayload> {
    const normalizedName = normalizeRequiredText<AccountLedgerMasterErrorDetail>(
      saveAccountLedgerMasterDto.ledName,
      'ledName',
    );
    await this.ensureGroupExists(saveAccountLedgerMasterDto.ledGroupId, tx);
    const companyId = saveAccountLedgerMasterDto.ledCompanyId ?? null;
    const branchId = saveAccountLedgerMasterDto.ledBranchId ?? null;
    const groupId = saveAccountLedgerMasterDto.ledGroupId;
    await this.ensureNameIsUnique(tx, normalizedName, companyId);
    const now = new Date();
    const createdBy = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    const data: Prisma.AccLedgerMasterUncheckedCreateInput = {
      ledCompanyId: companyId,
      ledBranchId: branchId,
      ledGroupId: groupId,
      ledName: normalizedName,
      // Must match the chk_led_ledger_type DB constraint, which only permits the
      // uppercase domain values ('PARTY','BANK','CASH',...). 'Party' violates it and
      // surfaces as a raw Postgres 23514 -> 500 on every ledger provision.
      ledLedgerType: 'PARTY',
      ledCreatedOn: now,
      ledCreatedBy: createdBy,
    };
    this.applyOptionalFields(data, saveAccountLedgerMasterDto);
    const created = await tx.accLedgerMaster.create({
      data,
      include: ACCOUNT_LEDGER_MASTER_RELATIONS,
    });
    await this.syncBankAccounts(
      tx,
      created.ledId,
      created.ledCompanyId,
      saveAccountLedgerMasterDto.ledgerBankAccount,
    );
    const bankAccounts = await this.loadBankAccounts(tx, created.ledId);
    const payload = this.toPayload({ ...created, bankAccounts });
    await this.auditLogService.logEntityChange(
      {
        action: 'New',
        tableName: ACCOUNT_LEDGER_MASTER_TABLE_NAME,
        screenName: ACCOUNT_LEDGER_MASTER_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: payload.ledId,
        displayName: payload.ledName,
        originalRecord: null,
        modifiedRecord: payload,
        userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        notes: 'Account ledger created',
      },
      tx,
    );
    return payload;
  }
  private async updateLedger(
    saveAccountLedgerMasterDto: SaveAccountLedgerMasterDto,
  ): Promise<AccountLedgerMasterPayload> {
    try {
      return await this.prisma.$transaction((tx) =>
        this.updateLedgerWithinTx(saveAccountLedgerMasterDto, tx),
      );
    } catch (error: unknown) {
      throwOnUniqueConstraintError<AccountLedgerMasterErrorDetail>(
        error,
        'Account ledger already exists',
        [{ field: 'ledName', message: 'Duplicate ledName is not allowed' }],
      );
      throw error;
    }
  }
  // Update a ledger inside an existing transaction. Exposed (not private) so linked masters —
  // e.g. customer/supplier edits, which share their PK with a ledger — can keep that ledger in
  // sync within their own transaction, mirroring how creation provisions it via createLedgerWithinTx.
  async updateLedgerWithinTx(
    saveAccountLedgerMasterDto: SaveAccountLedgerMasterDto,
    tx: AccountLedgerWriteClient,
  ): Promise<AccountLedgerMasterPayload> {
    const ledId = saveAccountLedgerMasterDto.ledId!;
    const existing = await tx.accLedgerMaster.findFirst({
      where: {
        ledId,
        ledIsDeleted: false,
      },
      include: ACCOUNT_LEDGER_MASTER_RELATIONS,
    });
    if (!existing) {
      throwAccountsNotFound<AccountLedgerMasterErrorDetail>(
        'Account ledger not found',
        'ledId',
        `No active account ledger found with id ${ledId}`,
      );
    }
    const normalizedName = normalizeRequiredText<AccountLedgerMasterErrorDetail>(
      saveAccountLedgerMasterDto.ledName,
      'ledName',
    );
    const nextGroupId = saveAccountLedgerMasterDto.ledGroupId;
    await this.ensureGroupExists(nextGroupId, tx);
    const nextCompanyId = hasOwnProperty(saveAccountLedgerMasterDto, 'ledCompanyId')
      ? (saveAccountLedgerMasterDto.ledCompanyId ?? null)
      : existing.ledCompanyId;
    await this.ensureNameIsUnique(tx, normalizedName, nextCompanyId, ledId);
    const data: Prisma.AccLedgerMasterUncheckedUpdateInput = {
      ledBranchId: saveAccountLedgerMasterDto.ledBranchId,
      ledGroupId: nextGroupId,
      ledName: normalizedName,
      ledModifiedOn: new Date(),
      ledModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
    };
    this.applyOptionalFields(data, saveAccountLedgerMasterDto);
    const updated = await tx.accLedgerMaster.update({
      where: {
        ledId,
      },
      data,
      include: ACCOUNT_LEDGER_MASTER_RELATIONS,
    });
    await this.syncBankAccounts(
      tx,
      ledId,
      updated.ledCompanyId,
      saveAccountLedgerMasterDto.ledgerBankAccount,
    );
    const bankAccounts = await this.loadBankAccounts(tx, ledId);
    const payload = this.toPayload({ ...updated, bankAccounts });
    await this.auditLogService.logEntityChange(
      {
        action: 'update',
        tableName: ACCOUNT_LEDGER_MASTER_TABLE_NAME,
        screenName: ACCOUNT_LEDGER_MASTER_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: ledId,
        displayName: payload.ledName,
        originalRecord: this.toPayload(existing),
        modifiedRecord: payload,
        userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        notes: 'Account ledger updated',
      },
      tx,
    );
    return payload;
  }
  private async ensureGroupExists(groupId: string, tx: AccountLedgerWriteClient): Promise<void> {
    const group = await tx.accountGroup.findFirst({
      where: {
        accGroupId: groupId,
        accGroupIsDeleted: false,
      },
      select: {
        accGroupId: true,
      },
    });
    if (!group) {
      throwAccountsBadRequest<AccountLedgerMasterErrorDetail>('Account group does not exist', [
        {
          field: 'ledGroupId',
          message: `No active account group found with id ${groupId}`,
        },
      ]);
    }
  }
  private async ensureNameIsUnique(
    tx: AccountLedgerWriteClient,
    ledgerName: string,
    companyId: string | null,
    excludeId?: string,
  ): Promise<void> {
    const existing = await tx.accLedgerMaster.findFirst({
      where: {
        ledIsDeleted: false,
        ledCompanyId: companyId,
        ledName: {
          equals: ledgerName,
          mode: 'insensitive',
        },
        ...(excludeId
          ? {
              ledId: {
                not: excludeId,
              },
            }
          : {}),
      },
      select: {
        ledId: true,
      },
    });
    if (existing) {
      throwAccountsConflict<AccountLedgerMasterErrorDetail>(
        'Account ledger name already exists for this company',
        [{ field: 'ledName', message: 'Duplicate ledName is not allowed for this company' }],
      );
    }
  }
  private applyOptionalFields(
    data: Prisma.AccLedgerMasterUncheckedCreateInput | Prisma.AccLedgerMasterUncheckedUpdateInput,
    saveAccountLedgerMasterDto: SaveAccountLedgerMasterDto,
  ): void {
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledCompanyId')) {
      data.ledCompanyId = saveAccountLedgerMasterDto.ledCompanyId;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledBranchId')) {
      data.ledBranchId = saveAccountLedgerMasterDto.ledBranchId;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledAlias')) {
      data.ledAlias = saveAccountLedgerMasterDto.ledAlias;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledShort')) {
      data.ledShort = saveAccountLedgerMasterDto.ledShort;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledTallyName')) {
      data.ledTallyName = saveAccountLedgerMasterDto.ledTallyName;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledTallyGroupName')) {
      data.ledTallyGroupName = saveAccountLedgerMasterDto.ledTallyGroupName;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledTallyGuid')) {
      data.ledTallyGuid = saveAccountLedgerMasterDto.ledTallyGuid;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledCategory')) {
      data.ledCategory = saveAccountLedgerMasterDto.ledCategory;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledLedgerType')) {
      data.ledLedgerType = saveAccountLedgerMasterDto.ledLedgerType;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledMailingName')) {
      data.ledMailingName = saveAccountLedgerMasterDto.ledMailingName;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledIsBillByBill')) {
      data.ledIsBillByBill = saveAccountLedgerMasterDto.ledIsBillByBill;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledIsCostCenterReq')) {
      data.ledIsCostCenterReq = saveAccountLedgerMasterDto.ledIsCostCenterReq;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledIsInterestApplicable')) {
      data.ledIsInterestApplicable = saveAccountLedgerMasterDto.ledIsInterestApplicable;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledInterestRate')) {
      data.ledInterestRate = saveAccountLedgerMasterDto.ledInterestRate;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledContactPerson')) {
      data.ledContactPerson = saveAccountLedgerMasterDto.ledContactPerson;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledEmail')) {
      data.ledEmail = saveAccountLedgerMasterDto.ledEmail;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledTel')) {
      data.ledTel = saveAccountLedgerMasterDto.ledTel;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledPhone1')) {
      data.ledPhone1 = saveAccountLedgerMasterDto.ledPhone1;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledPhone2')) {
      data.ledPhone2 = saveAccountLedgerMasterDto.ledPhone2;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledWhatsappNo')) {
      data.ledWhatsappNo = saveAccountLedgerMasterDto.ledWhatsappNo;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledAddr1')) {
      data.ledAddr1 = saveAccountLedgerMasterDto.ledAddr1;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledAddr2')) {
      data.ledAddr2 = saveAccountLedgerMasterDto.ledAddr2;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledAddr3')) {
      data.ledAddr3 = saveAccountLedgerMasterDto.ledAddr3;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledCity')) {
      data.ledCity = saveAccountLedgerMasterDto.ledCity;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledDistrict')) {
      data.ledDistrict = saveAccountLedgerMasterDto.ledDistrict;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledStateName')) {
      data.ledStateName = saveAccountLedgerMasterDto.ledStateName;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledStateCode')) {
      data.ledStateCode = saveAccountLedgerMasterDto.ledStateCode;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledPin')) {
      data.ledPin = saveAccountLedgerMasterDto.ledPin;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledCountry')) {
      data.ledCountry = saveAccountLedgerMasterDto.ledCountry;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledRegionName')) {
      data.ledRegionName = saveAccountLedgerMasterDto.ledRegionName;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledRegionAddr1')) {
      data.ledRegionAddr1 = saveAccountLedgerMasterDto.ledRegionAddr1;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledRegionAddr2')) {
      data.ledRegionAddr2 = saveAccountLedgerMasterDto.ledRegionAddr2;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledRegionAddr3')) {
      data.ledRegionAddr3 = saveAccountLedgerMasterDto.ledRegionAddr3;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledRegionCity')) {
      data.ledRegionCity = saveAccountLedgerMasterDto.ledRegionCity;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledRegionDistrict')) {
      data.ledRegionDistrict = saveAccountLedgerMasterDto.ledRegionDistrict;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledRegionStateName')) {
      data.ledRegionStateName = saveAccountLedgerMasterDto.ledRegionStateName;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledRegionCountry')) {
      data.ledRegionCountry = saveAccountLedgerMasterDto.ledRegionCountry;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledGstPartyRegType')) {
      data.ledGstPartyRegType = saveAccountLedgerMasterDto.ledGstPartyRegType;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledGstinNo')) {
      data.ledGstinNo = saveAccountLedgerMasterDto.ledGstinNo;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledPanNo')) {
      data.ledPanNo = saveAccountLedgerMasterDto.ledPanNo;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledAadharNo')) {
      data.ledAadharNo = saveAccountLedgerMasterDto.ledAadharNo;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledEcommerceGstin')) {
      data.ledEcommerceGstin = saveAccountLedgerMasterDto.ledEcommerceGstin;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledIsSez')) {
      data.ledIsSez = saveAccountLedgerMasterDto.ledIsSez;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledTypeOfSupply')) {
      data.ledTypeOfSupply = saveAccountLedgerMasterDto.ledTypeOfSupply;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledHsnSac')) {
      data.ledHsnSac = saveAccountLedgerMasterDto.ledHsnSac;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledGstRate')) {
      data.ledGstRate = saveAccountLedgerMasterDto.ledGstRate;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledTaxability')) {
      data.ledTaxability = saveAccountLedgerMasterDto.ledTaxability;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledGstPartyType')) {
      data.ledGstPartyType = saveAccountLedgerMasterDto.ledGstPartyType;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledTanNo')) {
      data.ledTanNo = saveAccountLedgerMasterDto.ledTanNo;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledCin')) {
      data.ledCin = saveAccountLedgerMasterDto.ledCin;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledUdyamNo')) {
      data.ledUdyamNo = saveAccountLedgerMasterDto.ledUdyamNo;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledMsmeType')) {
      data.ledMsmeType = saveAccountLedgerMasterDto.ledMsmeType;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledGstDutyHead')) {
      data.ledGstDutyHead = saveAccountLedgerMasterDto.ledGstDutyHead;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledTaxRate')) {
      data.ledTaxRate = saveAccountLedgerMasterDto.ledTaxRate;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledRoundingMethod')) {
      data.ledRoundingMethod = saveAccountLedgerMasterDto.ledRoundingMethod;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledRoundingLimit')) {
      data.ledRoundingLimit = saveAccountLedgerMasterDto.ledRoundingLimit;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledIsTdsApplicable')) {
      data.ledIsTdsApplicable = saveAccountLedgerMasterDto.ledIsTdsApplicable;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledTdsDeducteeType')) {
      data.ledTdsDeducteeType = saveAccountLedgerMasterDto.ledTdsDeducteeType;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledTdsNatureOfPayment')) {
      data.ledTdsNatureOfPayment = saveAccountLedgerMasterDto.ledTdsNatureOfPayment;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledIsTcsApplicable')) {
      data.ledIsTcsApplicable = saveAccountLedgerMasterDto.ledIsTcsApplicable;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledObAmount')) {
      data.ledObAmount = saveAccountLedgerMasterDto.ledObAmount;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledObType')) {
      data.ledObType = saveAccountLedgerMasterDto.ledObType;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledObAsOn')) {
      data.ledObAsOn = saveAccountLedgerMasterDto.ledObAsOn;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledTotalDr')) {
      data.ledTotalDr = saveAccountLedgerMasterDto.ledTotalDr;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledTotalCr')) {
      data.ledTotalCr = saveAccountLedgerMasterDto.ledTotalCr;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledTotalBalance')) {
      data.ledTotalBalance = saveAccountLedgerMasterDto.ledTotalBalance;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledSortOrder')) {
      data.ledSortOrder = saveAccountLedgerMasterDto.ledSortOrder;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledIsActive')) {
      data.ledIsActive = saveAccountLedgerMasterDto.ledIsActive;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledAllowEdit')) {
      data.ledAllowEdit = saveAccountLedgerMasterDto.ledAllowEdit;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledIsEntry')) {
      data.ledIsEntry = saveAccountLedgerMasterDto.ledIsEntry;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledAllowSms')) {
      data.ledAllowSms = saveAccountLedgerMasterDto.ledAllowSms;
    }
    if (hasOwnProperty(saveAccountLedgerMasterDto, 'ledRemarks')) {
      data.ledRemarks = saveAccountLedgerMasterDto.ledRemarks;
    }
  }
  private toPayload(record: AccLedgerMasterWithRelations): AccountLedgerMasterPayload {
    return {
      ledId: record.ledId,
      ledCompanyId: record.ledCompanyId,
      ledCompanyName: record.company?.compName ?? null,
      ledBranchId: record.ledBranchId,
      ledBranchName: record.branches?.brName ?? null,
      ledGroupId: record.ledGroupId,
      ledGroupName: record.accountGroup?.accGroupName ?? null,
      ledGroupLedgerProfile:
        (record.accountGroup?.accLedgerProfile as AccLedgerProfile | null) ?? null,
      ledName: record.ledName,
      ledAlias: record.ledAlias,
      ledShort: record.ledShort,
      ledTallyName: record.ledTallyName,
      ledTallyGroupName: record.ledTallyGroupName,
      ledTallyGuid: record.ledTallyGuid,
      ledTallyMasterId: record.ledTallyMasterId?.toString() ?? null,
      ledTallyAlterId: record.ledTallyAlterId?.toString() ?? null,
      ledCategory: record.ledCategory,
      ledLedgerType: record.ledLedgerType,
      ledMailingName: record.ledMailingName,
      ledIsBillByBill: record.ledIsBillByBill,
      ledIsCostCenterReq: record.ledIsCostCenterReq,
      ledIsInterestApplicable: record.ledIsInterestApplicable,
      ledInterestRate: toNullableNumber(record.ledInterestRate),
      ledContactPerson: record.ledContactPerson,
      ledEmail: record.ledEmail,
      ledTel: record.ledTel,
      ledPhone1: record.ledPhone1,
      ledPhone2: record.ledPhone2,
      ledWhatsappNo: record.ledWhatsappNo,
      ledAddr1: record.ledAddr1,
      ledAddr2: record.ledAddr2,
      ledAddr3: record.ledAddr3,
      ledCity: record.ledCity,
      ledDistrict: record.ledDistrict,
      ledStateName: record.ledStateName,
      ledStateCode: record.ledStateCode,
      ledPin: record.ledPin,
      ledCountry: record.ledCountry,
      ledRegionName: record.ledRegionName,
      ledRegionAddr1: record.ledRegionAddr1,
      ledRegionAddr2: record.ledRegionAddr2,
      ledRegionAddr3: record.ledRegionAddr3,
      ledRegionCity: record.ledRegionCity,
      ledRegionDistrict: record.ledRegionDistrict,
      ledRegionStateName: record.ledRegionStateName,
      ledRegionCountry: record.ledRegionCountry,
      ledGstPartyRegType: record.ledGstPartyRegType as LedGstPartyRegType | null,
      ledGstinNo: record.ledGstinNo,
      ledPanNo: record.ledPanNo,
      ledAadharNo: record.ledAadharNo,
      ledEcommerceGstin: record.ledEcommerceGstin,
      ledIsSez: record.ledIsSez,
      ledTypeOfSupply: record.ledTypeOfSupply,
      ledHsnSac: record.ledHsnSac,
      ledGstRate: toNullableNumber(record.ledGstRate),
      ledTaxability: record.ledTaxability,
      ledGstPartyType: record.ledGstPartyType,
      ledTanNo: record.ledTanNo,
      ledCin: record.ledCin,
      ledUdyamNo: record.ledUdyamNo,
      ledMsmeType: record.ledMsmeType,
      ledGstDutyHead: record.ledGstDutyHead,
      ledTaxRate: toNullableNumber(record.ledTaxRate),
      ledRoundingMethod: record.ledRoundingMethod,
      ledRoundingLimit: toNullableNumber(record.ledRoundingLimit),
      ledIsTdsApplicable: record.ledIsTdsApplicable,
      ledTdsDeducteeType: record.ledTdsDeducteeType,
      ledTdsNatureOfPayment: record.ledTdsNatureOfPayment,
      ledIsTcsApplicable: record.ledIsTcsApplicable,
      ledObAmount: toNumber(record.ledObAmount),
      ledObType: record.ledObType as LedObType,
      ledObAsOn: record.ledObAsOn ? record.ledObAsOn.toISOString() : null,
      ledTotalDr: toNumber(record.ledTotalDr),
      ledTotalCr: toNumber(record.ledTotalCr),
      ledTotalBalance: toNumber(record.ledTotalBalance),
      ledSortOrder: record.ledSortOrder,
      ledIsActive: record.ledIsActive,
      ledIsDeleted: record.ledIsDeleted,
      ledAllowEdit: record.ledAllowEdit,
      ledIsEntry: record.ledIsEntry,
      ledAllowSms: record.ledAllowSms,
      ledRemarks: record.ledRemarks,
      ledSyncDate: record.ledSyncDate ? record.ledSyncDate.toISOString() : null,
      ledCreatedOn: record.ledCreatedOn.toISOString(),
      ledCreatedBy: record.ledCreatedBy,
      ledModifiedOn: record.ledModifiedOn.toISOString(),
      ledModifiedBy: record.ledModifiedBy,
      ledgerBankAccount: record.bankAccounts.map((account) => this.toBankAccountPayload(account)),
    };
  }
  // ----- Nested ledger bank accounts -----
  // Fetch a single bank account by its own id (lba_id)
  async getBankAccounts(params: { lbaId: string }): Promise<LedgerBankAccountPayload>;
  // Fetch all active bank accounts for a ledger (led_id)
  async getBankAccounts(params: {
    ledId: string;
  }): Promise<{ data: LedgerBankAccountPayload[]; total: number }>;
  // Either/neither identifier (controller convenience — throws when neither is supplied)
  async getBankAccounts(params: {
    lbaId?: string;
    ledId?: string;
  }): Promise<LedgerBankAccountPayload | { data: LedgerBankAccountPayload[]; total: number }>;
  // Implementation
  async getBankAccounts(params: {
    lbaId?: string;
    ledId?: string;
  }): Promise<LedgerBankAccountPayload | { data: LedgerBankAccountPayload[]; total: number }> {
    const { lbaId, ledId } = params;
    // --- single bank account by id ---
    if (lbaId) {
      const record = await this.prisma.accLedgerBankAccount.findFirst({
        where: { lbaId, lbaIsDeleted: false },
      });
      if (!record) {
        throwAccountsNotFound<AccountLedgerMasterErrorDetail>(
          'Ledger bank account not found',
          'lbaId',
          `No active ledger bank account found with id ${lbaId}`,
        );
      }
      return this.toBankAccountPayload(record);
    }
    // --- list bank accounts for a ledger ---
    if (ledId) {
      const ledger = await this.prisma.accLedgerMaster.findFirst({
        where: { ledId, ledIsDeleted: false },
        select: { ledId: true },
      });
      if (!ledger) {
        throwAccountsNotFound<AccountLedgerMasterErrorDetail>(
          'Account ledger not found',
          'ledId',
          `No active account ledger found with id ${ledId}`,
        );
      }
      const where: Prisma.AccLedgerBankAccountWhereInput = {
        lbaLedgerId: ledId,
        lbaIsDeleted: false,
      };
      const [records, total] = await Promise.all([
        this.prisma.accLedgerBankAccount.findMany({
          where,
          orderBy: LEDGER_BANK_ACCOUNT_ORDER_BY,
        }),
        this.prisma.accLedgerBankAccount.count({ where }),
      ]);
      return { data: records.map((r) => this.toBankAccountPayload(r)), total };
    }
    // Neither identifier supplied.
    throwAccountsBadRequest<AccountLedgerMasterErrorDetail>('Validation failed', [
      { field: 'ledId', message: 'Provide either lbaId or ledId' },
    ]);
  }
  // Soft delete a single bank account by its own id (lba_id). GST/audit retention means
  // we never hard delete: the row is flagged deleted/inactive and cleared as default so
  // the partial unique index stays clean for any future default.
  async deleteBankAccountById(lbaId: string): Promise<{ lbaId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.accLedgerBankAccount.findFirst({
        where: { lbaId, lbaIsDeleted: false },
      });
      if (!existing) {
        throwAccountsNotFound<AccountLedgerMasterErrorDetail>(
          'Ledger bank account not found',
          'lbaId',
          `No active ledger bank account found with id ${lbaId}`,
        );
      }
      const modifiedOn = new Date();
      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      const result = await tx.accLedgerBankAccount.updateMany({
        where: { lbaId, lbaIsDeleted: false },
        data: {
          lbaIsDeleted: true,
          lbaIsActive: false,
          lbaModifiedOn: modifiedOn,
          lbaModifiedBy: actor,
        },
      });
      if (result.count === 0) {
        throwAccountsNotFound<AccountLedgerMasterErrorDetail>(
          'Ledger bank account not found',
          'lbaId',
          `No active ledger bank account found with id ${lbaId}`,
        );
      }
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: LEDGER_BANK_ACCOUNT_TABLE_NAME,
          screenName: LEDGER_BANK_ACCOUNT_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: lbaId,
          displayName: existing.lbaAccountHolder,
          originalRecord: this.toBankAccountPayload(existing),
          modifiedRecord: this.toBankAccountPayload({
            ...existing,
            lbaIsDeleted: true,
            lbaIsActive: false,
            lbaIsDefault: false,
            lbaModifiedOn: modifiedOn,
            lbaModifiedBy: actor,
          }),
          userId: actor,
          notes: 'Ledger bank account soft deleted',
        },
        tx,
      );
      return { lbaId, deleted: true };
    });
  }
  // Persist the nested bank accounts of a ledger inside the ledger's transaction.
  // An undefined or empty array leaves existing rows untouched (non-destructive) —
  // deletions go through deleteBankAccountById. Each item with an lbaId updates
  // that row (scoped to this ledger); items without an lbaId are inserted.
  private async syncBankAccounts(
    tx: AccountLedgerWriteClient,
    ledId: string,
    ledCompanyId: string | null,
    items: LedgerBankAccountItemDto[] | undefined,
  ): Promise<void> {
    if (!items || items.length === 0) {
      return;
    }
    this.assertSingleDefault(items);
    const now = new Date();
    const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    // When the payload marks a (single) account default, clear the ledger's current
    // default flag first so the partial unique index (one active default per ledger)
    // never trips while we set the new default below.
    if (items.some((item) => item.lbaIsDefault === true)) {
      await this.clearDefaultBankAccounts(tx, ledId);
    }
    for (const item of items) {
      const accountHolder = normalizeRequiredText<AccountLedgerMasterErrorDetail>(
        item.lbaAccountHolder,
        'lbaAccountHolder',
      );
      const bankName = normalizeRequiredText<AccountLedgerMasterErrorDetail>(
        item.lbaBankName,
        'lbaBankName',
      );
      const accountNo = normalizeRequiredText<AccountLedgerMasterErrorDetail>(
        item.lbaAccountNo,
        'lbaAccountNo',
      );
      if (item.lbaId) {
        const existing = await tx.accLedgerBankAccount.findFirst({
          where: { lbaId: item.lbaId, lbaLedgerId: ledId, lbaIsDeleted: false },
          select: { lbaId: true },
        });
        if (!existing) {
          throwAccountsBadRequest<AccountLedgerMasterErrorDetail>(
            'Ledger bank account does not exist',
            [
              {
                field: 'lbaId',
                message: `No active bank account ${item.lbaId} found for this ledger`,
              },
            ],
          );
        }
        await this.ensureBankAccountNumberIsUnique(tx, ledId, accountNo, item.lbaId);
        const data: Prisma.AccLedgerBankAccountUncheckedUpdateInput = {
          lbaCompanyId: ledCompanyId,
          lbaLedgerId: ledId,
          lbaAccountHolder: accountHolder,
          lbaBankName: bankName,
          lbaAccountNo: accountNo,
          lbaModifiedOn: now,
          lbaModifiedBy: actor,
        };
        this.applyBankAccountOptionalFields(data, item);
        await tx.accLedgerBankAccount.update({ where: { lbaId: item.lbaId }, data });
      } else {
        await this.ensureBankAccountNumberIsUnique(tx, ledId, accountNo);
        const data: Prisma.AccLedgerBankAccountUncheckedCreateInput = {
          lbaCompanyId: ledCompanyId,
          lbaLedgerId: ledId,
          lbaAccountHolder: accountHolder,
          lbaBankName: bankName,
          lbaAccountNo: accountNo,
          lbaCreatedOn: now,
          lbaCreatedBy: actor,
        };
        this.applyBankAccountOptionalFields(data, item);
        await tx.accLedgerBankAccount.create({ data });
      }
    }
  }
  private assertSingleDefault(items: LedgerBankAccountItemDto[]): void {
    const defaults = items.filter((item) => item.lbaIsDefault === true);
    if (defaults.length > 1) {
      throwAccountsBadRequest<AccountLedgerMasterErrorDetail>('Validation failed', [
        {
          field: 'lbaIsDefault',
          message: 'Only one bank account can be marked as default per ledger',
        },
      ]);
    }
  }
  // Clear the ledger's current default by flipping the flag off (NOT deleting the
  // rows) so a newly marked default satisfies the partial unique index.
  private async clearDefaultBankAccounts(
    tx: AccountLedgerWriteClient,
    ledId: string,
  ): Promise<void> {
    await tx.accLedgerBankAccount.updateMany({
      where: { lbaLedgerId: ledId, lbaIsDeleted: false, lbaIsDefault: true },
      data: {
        lbaIsDefault: false,
        lbaModifiedOn: new Date(),
        lbaModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
      },
    });
  }
  private async ensureBankAccountNumberIsUnique(
    tx: AccountLedgerWriteClient,
    ledId: string,
    accountNo: string,
    excludeLbaId?: string,
  ): Promise<void> {
    const existing = await tx.accLedgerBankAccount.findFirst({
      where: {
        lbaIsDeleted: false,
        lbaLedgerId: ledId,
        lbaAccountNo: { equals: accountNo, mode: 'insensitive' },
        ...(excludeLbaId ? { lbaId: { not: excludeLbaId } } : {}),
      },
      select: { lbaId: true },
    });
    if (existing) {
      throwAccountsConflict<AccountLedgerMasterErrorDetail>(
        'Ledger bank account already exists for this ledger',
        [
          {
            field: 'lbaAccountNo',
            message: 'Duplicate lbaAccountNo is not allowed for this ledger',
          },
        ],
      );
    }
  }
  private applyBankAccountOptionalFields(
    data:
      | Prisma.AccLedgerBankAccountUncheckedCreateInput
      | Prisma.AccLedgerBankAccountUncheckedUpdateInput,
    item: LedgerBankAccountItemDto,
  ): void {
    if (hasOwnProperty(item, 'lbaBranchName')) {
      data.lbaBranchName = item.lbaBranchName;
    }
    if (hasOwnProperty(item, 'lbaIfscCode')) {
      data.lbaIfscCode = item.lbaIfscCode;
    }
    if (hasOwnProperty(item, 'lbaMicrCode')) {
      data.lbaMicrCode = item.lbaMicrCode;
    }
    if (hasOwnProperty(item, 'lbaAccountType')) {
      data.lbaAccountType = item.lbaAccountType;
    }
    if (hasOwnProperty(item, 'lbaUpiId')) {
      data.lbaUpiId = item.lbaUpiId;
    }
    if (hasOwnProperty(item, 'lbaChequeName')) {
      data.lbaChequeName = item.lbaChequeName;
    }
    if (hasOwnProperty(item, 'lbaIsDefault')) {
      data.lbaIsDefault = item.lbaIsDefault;
    }
    if (hasOwnProperty(item, 'lbaIsActive')) {
      data.lbaIsActive = item.lbaIsActive;
    }
    if (hasOwnProperty(item, 'lbaRemarks')) {
      data.lbaRemarks = item.lbaRemarks;
    }
  }
  private loadBankAccounts(
    tx: AccountLedgerWriteClient,
    ledId: string,
  ): Promise<AccLedgerBankAccount[]> {
    return tx.accLedgerBankAccount.findMany({
      where: { lbaLedgerId: ledId, lbaIsDeleted: false },
      orderBy: LEDGER_BANK_ACCOUNT_ORDER_BY,
    });
  }
  // Load a ledger's active bank-account payloads (default-first, then oldest-first), returning
  // an empty array when there are none. Exposed so linked masters that share their PK with a
  // ledger — e.g. supplier get/create/update — can embed the bank accounts in their own
  // response without re-implementing the payload mapping. Never throws on a missing ledger.
  async listBankAccountPayloads(
    ledId: string,
    client: AccountLedgerWriteClient = this.prisma,
  ): Promise<LedgerBankAccountPayload[]> {
    const records = await this.loadBankAccounts(client, ledId);
    return records.map((record) => this.toBankAccountPayload(record));
  }
  private toBankAccountPayload(record: AccLedgerBankAccount): LedgerBankAccountPayload {
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