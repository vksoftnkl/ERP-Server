import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveAccountLedgerMasterDto } from './dto/save-account-ledger-master.dto';
import {
  AccountLedgerMasterErrorDetail,
  AccountLedgerMasterPayload,
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

const ACCOUNT_LEDGER_MASTER_TABLE_NAME = 'acc_ledger_master';
const ACCOUNT_LEDGER_MASTER_AUDIT_SCREEN_NAME = 'Account Ledger Master';

// Related master names resolved alongside the ledger payload.
const ACCOUNT_LEDGER_MASTER_RELATIONS = {
  company: { select: { compName: true } },
  branches: { select: { brName: true } },
  accountGroup: { select: { accGroupName: true } },
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

  // Fetch a single ledger by id
  async get(params: { ledId: string }): Promise<AccountLedgerMasterPayload>;
  // Fetch the full list
  async get(): Promise<{ data: AccountLedgerMasterPayload[]; total: number }>;
  // Implementation
  async get(params: { ledId?: string } = {}): Promise<
    AccountLedgerMasterPayload | { data: AccountLedgerMasterPayload[]; total: number }
  > {
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
      return await this.prisma.$transaction(async (tx) => {
        const normalizedName = normalizeRequiredText<AccountLedgerMasterErrorDetail>(
          saveAccountLedgerMasterDto.ledName,
          'ledName',
        );

        await this.ensureGroupExists(saveAccountLedgerMasterDto.ledGroupId, tx);

        const companyId = saveAccountLedgerMasterDto.ledCompanyId?.trim();
        if (!companyId) {
          throwAccountsBadRequest<AccountLedgerMasterErrorDetail>('Validation failed', [
            {
              field: 'ledCompanyId',
              message: 'ledCompanyId is required',
            },
          ]);
        }
        const branchId = saveAccountLedgerMasterDto.ledBranchId;
        const groupId = saveAccountLedgerMasterDto.ledGroupId;
        await this.ensureNameIsUnique(tx, normalizedName, companyId);
        const now = new Date();
        const createdBy = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
        const data: Prisma.AccLedgerMasterUncheckedCreateInput = {
          ledCompanyId: companyId,
          ledBranchId: branchId,
          ledGroupId: groupId,
          ledName: normalizedName,
          ledCreatedOn: now,
          ledCreatedBy: createdBy,
        };
        this.applyOptionalFields(data, saveAccountLedgerMasterDto);
        const created = await tx.accLedgerMaster.create({
          data,
          include: ACCOUNT_LEDGER_MASTER_RELATIONS,
        });
        const payload = this.toPayload(created);
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

  private async updateLedger(
    saveAccountLedgerMasterDto: SaveAccountLedgerMasterDto,
  ): Promise<AccountLedgerMasterPayload> {
    const ledId = saveAccountLedgerMasterDto.ledId!;
    try {
      return await this.prisma.$transaction(async (tx) => {
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
          ? saveAccountLedgerMasterDto.ledCompanyId?.trim()
          : existing.ledCompanyId;
        if (!nextCompanyId) {
          throwAccountsBadRequest<AccountLedgerMasterErrorDetail>('Validation failed', [
            {
              field: 'ledCompanyId',
              message: 'ledCompanyId is required',
            },
          ]);
        }
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
        const payload = this.toPayload(updated);
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
    companyId: string,
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
      ledGstPartyRegType: record.ledGstPartyRegType,
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
      ledObType: record.ledObType,
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
    };
  }
}