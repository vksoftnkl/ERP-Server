import { Injectable } from '@nestjs/common';
import { BranchMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveBranchMasterDto } from './dto/save-branch-master.dto';
import {
  BranchMasterErrorDetail,
  BranchMasterErrorResponse,
  BranchMasterPayload,
} from './types/branch-master-api.types';
import {
  DEFAULT_ACTOR,
  SettingsWriteClient,
  applyPresentFields,
  buildSettingsErrorResponse,
  normalizeRequiredText,
  throwOnUniqueConstraintError,
  throwSettingsBadRequest,
  throwSettingsConflict,
  throwSettingsNotFound,
  toNullableNumber,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';

const BRANCH_MASTER_TABLE_NAME = 'branch master';
const BRANCH_MASTER_AUDIT_SCREEN_NAME = 'Branch Master';
const BRANCH_MASTER_OPTIONAL_FIELDS = [
  'brCode',
  'brMailingName',
  'brAlias',
  'brShort',
  'brType',
  'brIsDefault',
  'brIsActive',
  'brAddr1',
  'brAddr2',
  'brAddr3',
  'brCity',
  'brDistrict',
  'brState',
  'brPin',
  'brCountry',
  'brLandmark',
  'brRegionAddr1',
  'brRegionAddr2',
  'brRegionAddr3',
  'brRegionCity',
  'brRegionDistrict',
  'brRegionState',
  'brRegionCountry',
  'brRegionName',
  'brContactPerson',
  'brTel',
  'brPhone',
  'brMail',
  'brBillPrefix',
  'brInvoiceSeriesPrefix',
  'brBillGreeting',
  'brTerms',
  'brRoundingMode',
  'brRoundingValue',
  'brDefaultGodownId',
  'brPosType',
  'brAllowNegativeStock',
  'brSmsApplicable',
  'brBankId',
  'brFssaiNo',
  'brFssaiLicenseType',
  'brFssaiValidUpto',
  'brGstinNo',
  'brGstRegType',
  'brPanNo',
];
type BranchMasterWriteClient = SettingsWriteClient;
@Injectable()
export class BranchMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async save(saveBranchMasterDto: SaveBranchMasterDto): Promise<BranchMasterPayload> {
    if (saveBranchMasterDto.brId) {
      return this.updateBranch(saveBranchMasterDto);
    }
    return this.createBranch(saveBranchMasterDto);
  }
  async getById(brId: string): Promise<BranchMasterPayload> {
    const record = await this.prisma.branchMaster.findFirst({
      where: {
        brId,
        brIsDeleted: false,
      },
    });
    if (!record) {
      this.throwNotFound(brId);
    }
    const payload = this.toPayload(record);
    const relatedNames = await this.resolveRelatedNames(this.prisma, record);
    return { ...payload, ...relatedNames };
  }
  async softDelete(brId: string): Promise<{ brId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.branchMaster.findFirst({
        where: {
          brId,
          brIsDeleted: false,
        },
      });
      if (!existing) {
        this.throwNotFound(brId);
      }
      const modifiedOn = new Date();
      const result = await tx.branchMaster.updateMany({
        where: {
          brId,
          brIsDeleted: false,
        },
        data: {
          brIsDeleted: true,
          brIsActive: false,
          brModifiedOn: modifiedOn,
          brModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        this.throwNotFound(brId);
      }
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        brIsDeleted: true,
        brIsActive: false,
        brModifiedOn: modifiedOn,
        brModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: BRANCH_MASTER_TABLE_NAME,
          screenName: BRANCH_MASTER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: String(brId),
          displayName: existing.brName,
          originalRecord,
          modifiedRecord,
          userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
          notes: 'Branch soft deleted',
        },
        tx,
      );
      return {
        brId,
        deleted: true,
      };
    });
  }
  private async createBranch(
    saveBranchMasterDto: SaveBranchMasterDto,
  ): Promise<BranchMasterPayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const normalizedName = this.normalizeRequiredName(saveBranchMasterDto.brName);
        const stateCode = this.normalizeStateCode(saveBranchMasterDto.brStateCode);
        await this.ensureCompanyExists(saveBranchMasterDto.brCompId, tx);
        await this.ensureNameIsUnique(tx, saveBranchMasterDto.brCompId, normalizedName);
        await this.ensureCodeIsUnique(tx, saveBranchMasterDto.brCode ?? null);
        if (saveBranchMasterDto.brIsDefault === true) {
          await this.clearDefaultBranch(tx, saveBranchMasterDto.brCompId);
        }
        const now = new Date();
        const data: Prisma.BranchMasterUncheckedCreateInput = {
          brCompId: saveBranchMasterDto.brCompId,
          brName: normalizedName,
          brStateCode: stateCode,
          brCreatedOn: now,
          brCreatedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        };
        this.applyOptionalFields(data, saveBranchMasterDto);
        const created = await tx.branchMaster.create({ data });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: BRANCH_MASTER_TABLE_NAME,
            screenName: BRANCH_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: String(payload.brId),
            displayName: payload.brName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Branch created',
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
  private async updateBranch(
    saveBranchMasterDto: SaveBranchMasterDto,
  ): Promise<BranchMasterPayload> {
    const brId = saveBranchMasterDto.brId!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.branchMaster.findFirst({
          where: {
            brId,
            brIsDeleted: false,
          },
        });
        if (!existing) {
          this.throwNotFound(brId);
        }
        const normalizedName = this.normalizeRequiredName(saveBranchMasterDto.brName);
        const stateCode = this.normalizeStateCode(saveBranchMasterDto.brStateCode);
        await this.ensureCompanyExists(saveBranchMasterDto.brCompId, tx);
        await this.ensureNameIsUnique(tx, saveBranchMasterDto.brCompId, normalizedName, brId);
        await this.ensureCodeIsUnique(tx, saveBranchMasterDto.brCode ?? null, brId);
        if (saveBranchMasterDto.brIsDefault === true) {
          await this.clearDefaultBranch(tx, saveBranchMasterDto.brCompId, brId);
        }
        const data: Prisma.BranchMasterUncheckedUpdateInput = {
          brCompId: saveBranchMasterDto.brCompId,
          brName: normalizedName,
          brStateCode: stateCode,
          brModifiedOn: new Date(),
          brModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        };
        this.applyOptionalFields(data, saveBranchMasterDto);
        const updated = await tx.branchMaster.update({
          where: {
            brId,
          },
          data,
        });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: BRANCH_MASTER_TABLE_NAME,
            screenName: BRANCH_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: String(brId),
            displayName: payload.brName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Branch updated',
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
  private async resolveRelatedNames(
    client: BranchMasterWriteClient,
    record: Pick<BranchMaster, 'brCompId' | 'brBankId' | 'brDefaultGodownId'>,
  ): Promise<{
    brCompName: string | null;
    brBankName: string | null;
    brDefaultGodownName: string | null;
  }> {
    const [company, bankLedger, godown] = await Promise.all([
      record.brCompId
        ? client.company.findFirst({
            where: { compId: record.brCompId },
            select: { compName: true },
          })
        : null,
      record.brBankId
        ? client.accLedgerMaster.findFirst({
            where: { ledId: record.brBankId },
            select: { ledName: true },
          })
        : null,
      record.brDefaultGodownId
        ? client.godownLocation.findFirst({
            where: { gdlId: record.brDefaultGodownId },
            select: { gdlName: true },
          })
        : null,
    ]);

    return {
      brCompName: company?.compName ?? null,
      brBankName: bankLedger?.ledName ?? null,
      brDefaultGodownName: godown?.gdlName ?? null,
    };
  }

  private async ensureCompanyExists(compId: string, tx: BranchMasterWriteClient): Promise<void> {
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
          field: 'compId',
          message: `No active company found with id ${compId}`,
        },
      ]);
    }
  }
  private async ensureNameIsUnique(
    tx: BranchMasterWriteClient,
    brCompId: string,
    brName: string,
    excludeBrId?: string,
  ): Promise<void> {
    const existing = await tx.branchMaster.findFirst({
      where: {
        brCompId: brCompId,
        brIsDeleted: false,
        brName: {
          equals: brName,
          mode: 'insensitive',
        },
        ...(excludeBrId !== undefined
          ? {
              brId: {
                not: excludeBrId,
              },
            }
          : {}),
      },
      select: {
        brId: true,
      },
    });
    if (existing) {
      throwSettingsConflict<BranchMasterErrorDetail>(
        'Branch name already exists for this company',
        [
          {
            field: 'brName',
            message: 'Duplicate brName is not allowed for this company',
          },
        ],
      );
    }
  }
  private async ensureCodeIsUnique(
    tx: BranchMasterWriteClient,
    brCode: string | null,
    excludeBrId?: string,
  ): Promise<void> {
    if (!brCode) {
      return;
    }
    const existing = await tx.branchMaster.findFirst({
      where: {
        brCode: {
          equals: brCode,
          mode: 'insensitive',
        },
        ...(excludeBrId !== undefined
          ? {
              brId: {
                not: excludeBrId,
              },
            }
          : {}),
      },
      select: {
        brId: true,
      },
    });
    if (existing) {
      throwSettingsConflict<BranchMasterErrorDetail>('Branch code already exists', [
        {
          field: 'brCode',
          message: 'Duplicate brCode is not allowed',
        },
      ]);
    }
  }
  private async clearDefaultBranch(
    tx: BranchMasterWriteClient,
    compId: string,
    excludeBrId?: string,
  ): Promise<void> {
    await tx.branchMaster.updateMany({
      where: {
        brCompId: compId,
        brIsDeleted: false,
        brIsDefault: true,
        ...(excludeBrId !== undefined
          ? {
              brId: {
                not: excludeBrId,
              },
            }
          : {}),
      },
      data: {
        brIsDefault: false,
        brModifiedOn: new Date(),
        brModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
      },
    });
  }
  private applyOptionalFields(
    data: Prisma.BranchMasterUncheckedCreateInput | Prisma.BranchMasterUncheckedUpdateInput,
    saveBranchMasterDto: SaveBranchMasterDto,
  ): void {
    applyPresentFields(data, saveBranchMasterDto, BRANCH_MASTER_OPTIONAL_FIELDS);
  }
  private normalizeRequiredName(name: string): string {
    return normalizeRequiredText<BranchMasterErrorDetail>(name, 'brName');
  }
  private normalizeStateCode(stateCode: string): string {
    const normalized = stateCode.trim().toUpperCase();
    if (normalized.length !== 2) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'brStateCode',
          message: 'brStateCode must be exactly 2 characters',
        },
      ]);
    }
    return normalized;
  }
  private toPayload(record: BranchMaster): BranchMasterPayload {
    return {
      brId: record.brId,
      brCompId: record.brCompId,
      brCode: record.brCode,
      brName: record.brName,
      brMailingName: record.brMailingName,
      brAlias: record.brAlias,
      brShort: record.brShort,
      brType: record.brType,
      brIsDefault: record.brIsDefault,
      brIsActive: record.brIsActive,
      brAddr1: record.brAddr1,
      brAddr2: record.brAddr2,
      brAddr3: record.brAddr3,
      brCity: record.brCity,
      brDistrict: record.brDistrict,
      brState: record.brState,
      brStateCode: record.brStateCode,
      brPin: record.brPin,
      brCountry: record.brCountry,
      brLandmark: record.brLandmark,
      brRegionAddr1: record.brRegionAddr1,
      brRegionAddr2: record.brRegionAddr2,
      brRegionAddr3: record.brRegionAddr3,
      brRegionCity: record.brRegionCity,
      brRegionDistrict: record.brRegionDistrict,
      brRegionState: record.brRegionState,
      brRegionCountry: record.brRegionCountry,
      brRegionName: record.brRegionName,
      brContactPerson: record.brContactPerson,
      brTel: record.brTel,
      brPhone: record.brPhone,
      brMail: record.brMail,
      brBillPrefix: record.brBillPrefix,
      brInvoiceSeriesPrefix: record.brInvoiceSeriesPrefix,
      brBillGreeting: record.brBillGreeting,
      brTerms: record.brTerms,
      brRoundingMode: record.brRoundingMode,
      brRoundingValue: toNullableNumber(record.brRoundingValue),
      brDefaultGodownId: record.brDefaultGodownId,
      brPosType: record.brPosType,
      brAllowNegativeStock: record.brAllowNegativeStock,
      brSmsApplicable: record.brSmsApplicable,
      brBankId: record.brBankId,
      brFssaiNo: record.brFssaiNo,
      brFssaiLicenseType: record.brFssaiLicenseType,
      brFssaiValidUpto: record.brFssaiValidUpto ? record.brFssaiValidUpto.toISOString() : null,
      brGstinNo: record.brGstinNo,
      brGstRegType: record.brGstRegType,
      brPanNo: record.brPanNo,
      brIsDeleted: record.brIsDeleted,
      brSyncDate: record.brSyncDate ? record.brSyncDate.toISOString() : null,
      brCreatedOn: record.brCreatedOn.toISOString(),
      brCreatedBy: record.brCreatedBy,
      brModifiedOn: record.brModifiedOn.toISOString(),
      brModifiedBy: record.brModifiedBy,
    };
  }
  private handleWriteError(error: unknown): void {
    throwOnUniqueConstraintError<BranchMasterErrorDetail>(error, 'Branch already exists', [
      {
        field: 'brCode',
        message: 'Duplicate branch unique value is not allowed',
      },
    ]);
  }
  private throwNotFound(brId: string): never {
    throwSettingsNotFound<BranchMasterErrorDetail>(
      'Branch not found',
      'brId',
      `No active branch found with id ${brId}`,
    );
  }
  private throwBadRequest(message: string, errors: BranchMasterErrorDetail[]): never {
    throwSettingsBadRequest<BranchMasterErrorDetail>(message, errors);
  }
  private buildErrorResponse(
    message: string,
    errors: BranchMasterErrorDetail[] = [],
  ): BranchMasterErrorResponse {
    return buildSettingsErrorResponse<BranchMasterErrorDetail, BranchMasterErrorResponse>(
      message,
      errors,
    );
  }
}