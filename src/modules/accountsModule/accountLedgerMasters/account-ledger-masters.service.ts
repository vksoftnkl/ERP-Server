import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccLedgerMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListAccountLedgerMasterQueryDto } from './dto/list-account-ledger-master-query.dto';
import { SaveAccountLedgerMasterDto } from './dto/save-account-ledger-master.dto';
import {
  AccountLedgerMasterErrorDetail,
  AccountLedgerMasterErrorResponse,
  AccountLedgerMasterListItem,
  AccountLedgerMasterListMeta,
  AccountLedgerMasterPayload,
} from './types/account-ledger-master-api.types';

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const ACCOUNT_LEDGER_MASTER_TABLE_NAME = 'acc_ledger_master';
const ACCOUNT_LEDGER_MASTER_AUDIT_SCREEN_NAME = 'Account Ledger Master';

type AccountLedgerWriteClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class AccountLedgerMastersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async save(
    saveAccountLedgerMasterDto: SaveAccountLedgerMasterDto,
  ): Promise<AccountLedgerMasterPayload> {
    if (saveAccountLedgerMasterDto.ledId) {
      return this.updateLedger(saveAccountLedgerMasterDto);
    }

    return this.createLedger(saveAccountLedgerMasterDto);
  }

  async list(
    queryDto: ListAccountLedgerMasterQueryDto,
  ): Promise<{ items: AccountLedgerMasterListItem[]; meta: AccountLedgerMasterListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const where: Prisma.AccLedgerMasterWhereInput = {
      ledIsDeleted: false,
    };

    if (queryDto.ledCompanyId !== undefined) {
      where.ledCompanyId = queryDto.ledCompanyId;
    }

    if (queryDto.ledGroupId !== undefined) {
      where.ledGroupId = queryDto.ledGroupId;
    }

    if (queryDto.ledCategory?.trim()) {
      where.ledCategory = queryDto.ledCategory.trim();
    }

    if (queryDto.ledIsActive !== undefined) {
      where.ledIsActive = queryDto.ledIsActive;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { ledName: { contains: search, mode: 'insensitive' } },
        { ledAlias: { contains: search, mode: 'insensitive' } },
        { ledShort: { contains: search, mode: 'insensitive' } },
        { ledTallyName: { contains: search, mode: 'insensitive' } },
        { ledTallyGroupName: { contains: search, mode: 'insensitive' } },
        { ledContactPerson: { contains: search, mode: 'insensitive' } },
        { ledEmail: { contains: search, mode: 'insensitive' } },
        { ledCity: { contains: search, mode: 'insensitive' } },
        { ledDistrict: { contains: search, mode: 'insensitive' } },
        { ledStateName: { contains: search, mode: 'insensitive' } },
        { ledGstinNo: { contains: search, mode: 'insensitive' } },
        { ledPanNo: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.accLedgerMaster.count({ where }),
      this.prisma.accLedgerMaster.findMany({
        where,
        orderBy: [{ ledName: 'asc' }, { ledId: 'asc' }],
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

  async getById(ledId: string): Promise<AccountLedgerMasterPayload> {
    const record = await this.prisma.accLedgerMaster.findFirst({
      where: {
        ledId,
        ledIsDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(ledId);
    }

    return this.toPayload(record);
  }

  async softDelete(ledId: string): Promise<{ ledId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.accLedgerMaster.findFirst({
        where: {
          ledId,
          ledIsDeleted: false,
        },
      });

      if (!existing) {
        this.throwNotFound(ledId);
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
          ledModifiedBy: DEFAULT_ACTOR,
        },
      });

      if (result.count === 0) {
        this.throwNotFound(ledId);
      }

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        ledIsDeleted: true,
        ledIsActive: false,
        ledModifiedOn: modifiedOn,
        ledModifiedBy: DEFAULT_ACTOR,
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
          userId: DEFAULT_ACTOR,
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
        const normalizedName = this.normalizeRequiredName(saveAccountLedgerMasterDto.ledName);

        await this.ensureGroupExists(saveAccountLedgerMasterDto.ledGroupId, tx);

        const companyId = this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledCompanyId')
          ? (saveAccountLedgerMasterDto.ledCompanyId ?? null)
          : null;
        const groupId = saveAccountLedgerMasterDto.ledGroupId;
        await this.ensureNameIsUnique(tx, normalizedName, companyId, groupId);

        const now = new Date();
        const createdBy = DEFAULT_ACTOR;

        const data: Prisma.AccLedgerMasterUncheckedCreateInput = {
          ledGroupId: groupId,
          ledName: normalizedName,
          ledCreatedOn: now,
          ledCreatedBy: createdBy,
          ledModifiedOn: now,
          ledModifiedBy: createdBy,
        };

        this.applyOptionalFields(data, saveAccountLedgerMasterDto);

        const created = await tx.accLedgerMaster.create({ data });
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
            userId: DEFAULT_ACTOR,
            notes: 'Account ledger created',
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
        });

        if (!existing) {
          this.throwNotFound(ledId);
        }

        const normalizedName = this.normalizeRequiredName(saveAccountLedgerMasterDto.ledName);

        const nextGroupId = saveAccountLedgerMasterDto.ledGroupId;
        await this.ensureGroupExists(nextGroupId, tx);

        const nextCompanyId = this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledCompanyId')
          ? (saveAccountLedgerMasterDto.ledCompanyId ?? null)
          : existing.ledCompanyId;
        await this.ensureNameIsUnique(tx, normalizedName, nextCompanyId, nextGroupId, ledId);

        const data: Prisma.AccLedgerMasterUncheckedUpdateInput = {
          ledGroupId: nextGroupId,
          ledName: normalizedName,
          ledModifiedOn: new Date(),
          ledModifiedBy: DEFAULT_ACTOR,
        };

        this.applyOptionalFields(data, saveAccountLedgerMasterDto);

        const updated = await tx.accLedgerMaster.update({
          where: {
            ledId,
          },
          data,
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
            userId: DEFAULT_ACTOR,
            notes: 'Account ledger updated',
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
      this.throwBadRequest('Account group does not exist', [
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
    groupId: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await tx.accLedgerMaster.findFirst({
      where: {
        ledIsDeleted: false,
        ledCompanyId: companyId,
        ledGroupId: groupId,
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
      throw new ConflictException(
        this.buildErrorResponse('Account ledger name already exists for this company and group', [
          {
            field: 'ledName',
            message: 'Duplicate ledName is not allowed for this company and group',
          },
        ]),
      );
    }
  }

  private applyOptionalFields(
    data: Prisma.AccLedgerMasterUncheckedCreateInput | Prisma.AccLedgerMasterUncheckedUpdateInput,
    saveAccountLedgerMasterDto: SaveAccountLedgerMasterDto,
  ): void {
    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledCompanyId')) {
      data.ledCompanyId = saveAccountLedgerMasterDto.ledCompanyId;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledAlias')) {
      data.ledAlias = saveAccountLedgerMasterDto.ledAlias;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledShort')) {
      data.ledShort = saveAccountLedgerMasterDto.ledShort;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledTallyName')) {
      data.ledTallyName = saveAccountLedgerMasterDto.ledTallyName;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledTallyGroupName')) {
      data.ledTallyGroupName = saveAccountLedgerMasterDto.ledTallyGroupName;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledTallyGuid')) {
      data.ledTallyGuid = saveAccountLedgerMasterDto.ledTallyGuid;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledCategory')) {
      data.ledCategory = saveAccountLedgerMasterDto.ledCategory;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledIsBillByBill')) {
      data.ledIsBillByBill = saveAccountLedgerMasterDto.ledIsBillByBill;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledIsCostCenterReq')) {
      data.ledIsCostCenterReq = saveAccountLedgerMasterDto.ledIsCostCenterReq;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledIsInterestApplicable')) {
      data.ledIsInterestApplicable = saveAccountLedgerMasterDto.ledIsInterestApplicable;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledInterestRate')) {
      data.ledInterestRate = saveAccountLedgerMasterDto.ledInterestRate;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledContactPerson')) {
      data.ledContactPerson = saveAccountLedgerMasterDto.ledContactPerson;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledEmail')) {
      data.ledEmail = saveAccountLedgerMasterDto.ledEmail;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledTel')) {
      data.ledTel = saveAccountLedgerMasterDto.ledTel;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledPhone1')) {
      data.ledPhone1 = saveAccountLedgerMasterDto.ledPhone1;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledPhone2')) {
      data.ledPhone2 = saveAccountLedgerMasterDto.ledPhone2;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledWhatsappNo')) {
      data.ledWhatsappNo = saveAccountLedgerMasterDto.ledWhatsappNo;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledAddr1')) {
      data.ledAddr1 = saveAccountLedgerMasterDto.ledAddr1;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledAddr2')) {
      data.ledAddr2 = saveAccountLedgerMasterDto.ledAddr2;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledAddr3')) {
      data.ledAddr3 = saveAccountLedgerMasterDto.ledAddr3;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledCity')) {
      data.ledCity = saveAccountLedgerMasterDto.ledCity;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledDistrict')) {
      data.ledDistrict = saveAccountLedgerMasterDto.ledDistrict;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledStateName')) {
      data.ledStateName = saveAccountLedgerMasterDto.ledStateName;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledStateCode')) {
      data.ledStateCode = saveAccountLedgerMasterDto.ledStateCode;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledPin')) {
      data.ledPin = saveAccountLedgerMasterDto.ledPin;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledCountry')) {
      data.ledCountry = saveAccountLedgerMasterDto.ledCountry;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledRegionAddr1')) {
      data.ledRegionAddr1 = saveAccountLedgerMasterDto.ledRegionAddr1;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledRegionAddr2')) {
      data.ledRegionAddr2 = saveAccountLedgerMasterDto.ledRegionAddr2;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledRegionAddr3')) {
      data.ledRegionAddr3 = saveAccountLedgerMasterDto.ledRegionAddr3;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledRegionCity')) {
      data.ledRegionCity = saveAccountLedgerMasterDto.ledRegionCity;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledRegionDistrict')) {
      data.ledRegionDistrict = saveAccountLedgerMasterDto.ledRegionDistrict;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledRegionStateName')) {
      data.ledRegionStateName = saveAccountLedgerMasterDto.ledRegionStateName;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledRegionCountry')) {
      data.ledRegionCountry = saveAccountLedgerMasterDto.ledRegionCountry;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledGstPartyRegType')) {
      data.ledGstPartyRegType = saveAccountLedgerMasterDto.ledGstPartyRegType;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledGstinNo')) {
      data.ledGstinNo = saveAccountLedgerMasterDto.ledGstinNo;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledPanNo')) {
      data.ledPanNo = saveAccountLedgerMasterDto.ledPanNo;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledAadharNo')) {
      data.ledAadharNo = saveAccountLedgerMasterDto.ledAadharNo;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledEcommerceGstin')) {
      data.ledEcommerceGstin = saveAccountLedgerMasterDto.ledEcommerceGstin;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledIsSez')) {
      data.ledIsSez = saveAccountLedgerMasterDto.ledIsSez;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledChequeName')) {
      data.ledChequeName = saveAccountLedgerMasterDto.ledChequeName;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledBankName')) {
      data.ledBankName = saveAccountLedgerMasterDto.ledBankName;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledBankBranch')) {
      data.ledBankBranch = saveAccountLedgerMasterDto.ledBankBranch;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledBankAcNo')) {
      data.ledBankAcNo = saveAccountLedgerMasterDto.ledBankAcNo;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledBankIfsc')) {
      data.ledBankIfsc = saveAccountLedgerMasterDto.ledBankIfsc;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledUpiId')) {
      data.ledUpiId = saveAccountLedgerMasterDto.ledUpiId;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledObAmount')) {
      data.ledObAmount = saveAccountLedgerMasterDto.ledObAmount;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledObType')) {
      data.ledObType = saveAccountLedgerMasterDto.ledObType;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledObAsOn')) {
      data.ledObAsOn = saveAccountLedgerMasterDto.ledObAsOn;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledIsActive')) {
      data.ledIsActive = saveAccountLedgerMasterDto.ledIsActive;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledAllowEdit')) {
      data.ledAllowEdit = saveAccountLedgerMasterDto.ledAllowEdit;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledIsEntry')) {
      data.ledIsEntry = saveAccountLedgerMasterDto.ledIsEntry;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledAllowSms')) {
      data.ledAllowSms = saveAccountLedgerMasterDto.ledAllowSms;
    }

    if (this.hasOwnProperty(saveAccountLedgerMasterDto, 'ledRemarks')) {
      data.ledRemarks = saveAccountLedgerMasterDto.ledRemarks;
    }
  }

  private normalizeRequiredName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'ledName',
          message: 'ledName must not be empty',
        },
      ]);
    }

    return trimmed;
  }

  private toPayload(record: AccLedgerMaster): AccountLedgerMasterPayload {
    return {
      ledId: record.ledId,
      ledCompanyId: record.ledCompanyId,
      ledGroupId: record.ledGroupId,
      ledName: record.ledName,
      ledAlias: record.ledAlias,
      ledShort: record.ledShort,
      ledTallyName: record.ledTallyName,
      ledTallyGroupName: record.ledTallyGroupName,
      ledTallyGuid: record.ledTallyGuid,
      ledCategory: record.ledCategory,
      ledIsBillByBill: record.ledIsBillByBill,
      ledIsCostCenterReq: record.ledIsCostCenterReq,
      ledIsInterestApplicable: record.ledIsInterestApplicable,
      ledInterestRate: this.toNullableNumber(record.ledInterestRate),
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
      ledChequeName: record.ledChequeName,
      ledBankName: record.ledBankName,
      ledBankBranch: record.ledBankBranch,
      ledBankAcNo: record.ledBankAcNo,
      ledBankIfsc: record.ledBankIfsc,
      ledUpiId: record.ledUpiId,
      ledObAmount: this.toNumber(record.ledObAmount),
      ledObType: record.ledObType,
      ledObAsOn: record.ledObAsOn ? record.ledObAsOn.toISOString() : null,
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

  private toNumber(value: Prisma.Decimal | number): number {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value.toString());
  }

  private toNullableNumber(value: Prisma.Decimal | number | null): number | null {
    if (value === null) {
      return null;
    }

    return this.toNumber(value);
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Account ledger already exists', [
          {
            field: 'ledName',
            message: 'Duplicate ledName is not allowed',
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

  private throwNotFound(ledId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Account ledger not found', [
        {
          field: 'ledId',
          message: `No active account ledger found with id ${ledId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: AccountLedgerMasterErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: AccountLedgerMasterErrorDetail[] = [],
  ): AccountLedgerMasterErrorResponse {
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
