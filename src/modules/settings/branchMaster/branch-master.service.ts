import { Injectable } from '@nestjs/common';
import { BranchMaster, Company, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveBranchMasterDto } from './dto/save-branch-master.dto';
import {
  BranchMasterErrorDetail,
  BranchMasterErrorResponse,
  BranchMasterPayload,
  SeededMainBranch,
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
import {
  countLiveReferences,
  type LiveReference,
} from 'src/modules/Inventory/utils/master-tree.helper';
import { checkGstin } from '../shared/gst-registration';
import { GodownsMasterService } from 'src/modules/Inventory/godowns-master/godowns-master.service';

const BRANCH_MASTER_TABLE_NAME = 'branch master';
const BRANCH_MASTER_AUDIT_SCREEN_NAME = 'Branch Master';
/** Notes 78 item 1 — the branch a new company starts with. */
export const MAIN_BRANCH_NAME = 'Main Branch';
export const MAIN_BRANCH_TYPE = 'HEAD OFFICE';
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
/**
 * What ties a branch to its books (notes 72 B3 / B4): any document or stock
 * row, ever — a cancelled bill is still the branch's — and the users and
 * devices that sign in to it. While any exist the branch is not deleted and
 * does not move to another company.
 */
const BRANCH_IN_USE_REFERENCES: readonly LiveReference[] = [
  {
    table: 'stock.stock_balance',
    column: 'sbl_branch_id',
    live: 'true',
    label: 'stock balance rows',
  },
  { table: 'stock.stock_ledger', column: 'sml_branch_id', live: 'true', label: 'stock movements' },
  { table: 'stock.stock_voucher', column: 'svh_branch_id', live: 'true', label: 'stock vouchers' },
  {
    table: 'stock.stock_voucher',
    column: 'svh_to_branch_id',
    live: 'true',
    label: 'stock vouchers sent to it',
  },
  {
    table: 'stock.stock_transit',
    column: 'stt_from_branch_id',
    live: 'true',
    label: 'transfers out',
  },
  { table: 'stock.stock_transit', column: 'stt_to_branch_id', live: 'true', label: 'transfers in' },
  { table: 'sales.sale_quotation', column: 'sq_branch_id', live: 'true', label: 'quotations' },
  { table: 'sales.sale_order', column: 'so_branch_id', live: 'true', label: 'sale orders' },
  { table: 'sales.sale_dc', column: 'sdc_branch_id', live: 'true', label: 'delivery challans' },
  { table: 'sales.sale_dc_return', column: 'sdr_branch_id', live: 'true', label: 'DC returns' },
  { table: 'sales.sale_bill', column: 'sb_branch_id', live: 'true', label: 'sale bills' },
  { table: 'sales.sale_return', column: 'sr_branch_id', live: 'true', label: 'sale returns' },
  {
    table: 'accounts.acc_voucher_header',
    column: 'avh_branch_id',
    live: 'true',
    label: 'vouchers',
  },
  {
    table: 'accounts.acc_opening_balance',
    column: 'op_branch_id',
    live: 'op_is_deleted = false',
    label: 'opening balances',
  },
  {
    table: 'public.user_master',
    column: 'usr_branch_id',
    live: 'usr_is_deleted = false',
    label: 'users',
  },
  {
    table: 'fixed.device_master',
    column: 'dev_branch_id',
    live: 'dev_is_deleted = false',
    label: 'devices',
  },
];
const describeUse = (used: Array<{ label: string; count: number }>) =>
  used.map((ref) => `${ref.count} ${ref.label}`).join(', ');
type BranchMasterWriteClient = SettingsWriteClient;
@Injectable()
export class BranchMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
    private readonly godownsMasterService: GodownsMasterService,
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
      await this.assertDeletable(tx, existing);
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
  /**
   * Notes 72 B1 — brings a soft-deleted branch back, active. 409 when it is not
   * deleted, when its company is (restore that first), or when a live branch of
   * the company has taken its name since. It stays its company's default only
   * if no other live branch has become the default meanwhile.
   */
  async restore(brId: string): Promise<{ brId: string; deleted: false }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.branchMaster.findFirst({ where: { brId } });
      if (!existing) {
        throwSettingsNotFound<BranchMasterErrorDetail>(
          'Branch not found',
          'brId',
          `No branch found with id ${brId}`,
        );
      }
      if (!existing.brIsDeleted) {
        throwSettingsConflict<BranchMasterErrorDetail>('Branch is not deleted', [
          {
            field: 'brId',
            message: `${existing.brName} is live; only a deleted branch can be restored`,
          },
        ]);
      }
      const company = await tx.company.findFirst({
        where: { compId: existing.brCompId, compIsDeleted: false },
        select: { compId: true },
      });
      if (!company) {
        throwSettingsConflict<BranchMasterErrorDetail>('The branch’s company is deleted', [
          {
            field: 'brCompId',
            message: 'Restore the company first (POST /company-masters/restore)',
          },
        ]);
      }
      await this.ensureNameIsUnique(tx, existing.brCompId, existing.brName, brId);
      const otherDefault = existing.brIsDefault
        ? await tx.branchMaster.findFirst({
            where: {
              brCompId: existing.brCompId,
              brIsDeleted: false,
              brIsDefault: true,
              brId: { not: brId },
            },
            select: { brId: true },
          })
        : null;
      const modifiedOn = new Date();
      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      const restored = {
        brIsDeleted: false,
        brIsActive: true,
        brIsDefault: existing.brIsDefault && !otherDefault,
        brModifiedOn: modifiedOn,
        brModifiedBy: actor,
      };
      const result = await tx.branchMaster.updateMany({
        where: { brId, brIsDeleted: true },
        data: restored,
      });
      if (result.count === 0) {
        this.throwNotFound(brId);
      }
      await this.auditLogService.logEntityChange(
        {
          action: 'update',
          tableName: BRANCH_MASTER_TABLE_NAME,
          screenName: BRANCH_MASTER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: String(brId),
          displayName: existing.brName,
          originalRecord: this.toPayload(existing),
          modifiedRecord: this.toPayload({ ...existing, ...restored }),
          userId: actor,
          notes: 'Branch restored',
        },
        tx,
      );
      return { brId, deleted: false };
    });
  }
  /**
   * Notes 78 items 1 and 2 — the branch a new company starts with, written by
   * CompanyMasterService.createCompany() in the same transaction as the
   * company and its first fiscal year. Its state, GSTIN, PAN, registration
   * type, address and contacts are the company's (the same copy rules as the
   * share's 45_main_branch_seed.sql); brCode stays NULL, being unique across
   * all companies. It is the company's default branch and holds the company's
   * first godown, 'Main Godown', as its default godown.
   */
  async seedMainBranch(
    tx: BranchMasterWriteClient,
    company: Company,
    actor: string,
    now: Date,
  ): Promise<SeededMainBranch> {
    const created = await tx.branchMaster.create({
      data: {
        brCompId: company.compId,
        brName: MAIN_BRANCH_NAME,
        brType: MAIN_BRANCH_TYPE,
        brIsDefault: true,
        brIsActive: true,
        brAddr1: company.compAddr1,
        brAddr2: company.compAddr2,
        brAddr3: company.compAddr3,
        brCity: company.compCity,
        brDistrict: company.compDistrict,
        brState: company.compState,
        brStateCode: company.compStateCode,
        brPin: company.compPin,
        brCountry: company.compCountry,
        brRegionAddr1: company.compRegionAddr1,
        brRegionAddr2: company.compRegionAddr2,
        brRegionAddr3: company.compRegionAddr3,
        brRegionCity: company.compRegionCity,
        brRegionDistrict: company.compRegionDistrict,
        brRegionState: company.compRegionState,
        brRegionCountry: company.compRegionCountry,
        brTel: company.compTel,
        brPhone: company.compPhone,
        brMail: company.compMail,
        brGstinNo: company.compGstinNo,
        brGstRegType: company.compGstRegType,
        brPanNo: company.compPanNo,
        brCreatedOn: now,
        brCreatedBy: actor,
        brModifiedOn: now,
        brModifiedBy: actor,
      },
    });
    const godown = await this.godownsMasterService.seedMainGodown(tx, created.brId, actor, now);
    const branch = await tx.branchMaster.update({
      where: { brId: created.brId },
      data: { brDefaultGodownId: godown.gdl_id },
    });
    const payload = this.toPayload(branch);
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
        userId: actor,
        notes: 'Seeded on company create',
      },
      tx,
    );
    return {
      brId: branch.brId,
      brName: branch.brName,
      gdlId: godown.gdl_id,
      gdlName: godown.gdl_name,
    };
  }
  private async createBranch(
    saveBranchMasterDto: SaveBranchMasterDto,
  ): Promise<BranchMasterPayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const normalizedName = this.normalizeRequiredName(saveBranchMasterDto.brName);
        const stateCode = this.normalizeStateCode(saveBranchMasterDto.brStateCode);
        const panFromGstin = this.assertGstin(
          saveBranchMasterDto.brGstinNo ?? null,
          stateCode,
          saveBranchMasterDto.brPanNo ?? null,
        );
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
        if (panFromGstin) {
          data.brPanNo = panFromGstin;
        }
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
        // C7 against what the branch will hold: an omitted GSTIN or PAN keeps the stored one.
        const panFromGstin = this.assertGstin(
          saveBranchMasterDto.brGstinNo !== undefined
            ? saveBranchMasterDto.brGstinNo
            : existing.brGstinNo,
          stateCode,
          saveBranchMasterDto.brPanNo !== undefined
            ? saveBranchMasterDto.brPanNo
            : existing.brPanNo,
        );
        // Notes 78 item 5 — the default flag moves, it is never just dropped:
        // unticking it would leave the company without a default branch.
        if (existing.brIsDefault && saveBranchMasterDto.brIsDefault === false) {
          this.throwBadRequest('Validation failed', [
            {
              field: 'brIsDefault',
              message: `${existing.brName} is its company’s default branch; make another branch the default instead`,
            },
          ]);
        }
        if (saveBranchMasterDto.brCompId !== existing.brCompId) {
          await this.assertMayChangeCompany(tx, existing);
        }
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
        if (panFromGstin) {
          data.brPanNo = panFromGstin;
        }
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
  /**
   * Notes 72 B3 — a branch with any document, stock, user or device is not
   * deleted. Nor is its company's default branch while other live branches
   * exist: make one of them the default first. The company's ONLY branch may
   * go (once unused) — refusing it too would make the company undeletable,
   * since a company is deleted only once it has no live branches (B2).
   * Kept so under notes 78 item 6: the company is then branchless until it is
   * deleted or a branch is added, and the client says so.
   */
  private async assertDeletable(
    tx: BranchMasterWriteClient,
    existing: BranchMaster,
  ): Promise<void> {
    if (existing.brIsDefault) {
      const others = await tx.branchMaster.count({
        where: { brCompId: existing.brCompId, brIsDeleted: false, brId: { not: existing.brId } },
      });
      if (others > 0) {
        throwSettingsConflict<BranchMasterErrorDetail>('The default branch cannot be deleted', [
          {
            field: 'brId',
            message: `${existing.brName} is its company’s default branch; make another branch the default first`,
          },
        ]);
      }
    }
    const used = await this.inUse(tx, existing.brId);
    if (used.length) {
      throwSettingsConflict<BranchMasterErrorDetail>('This branch is still in use', [
        {
          field: 'brId',
          message:
            `Used by ${describeUse(used)}. A deleted branch would leave them under a ` +
            'branch nobody can open.',
        },
      ]);
    }
  }
  /**
   * Notes 72 B4 — moving a branch to another company would file everything it
   * holds under the wrong books, so a branch with any document, stock, user or
   * device stays where it is (400). Its company's default branch stays too:
   * the move would leave that company without one.
   */
  private async assertMayChangeCompany(
    tx: BranchMasterWriteClient,
    existing: BranchMaster,
  ): Promise<void> {
    if (existing.brIsDefault) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'brCompId',
          message: `${existing.brName} is its company’s default branch and cannot move to another company`,
        },
      ]);
    }
    const used = await this.inUse(tx, existing.brId);
    if (used.length) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'brCompId',
          message: `${existing.brName} cannot move to another company: it has ${describeUse(used)}`,
        },
      ]);
    }
  }
  private async inUse(
    tx: BranchMasterWriteClient,
    brId: string,
  ): Promise<Array<{ label: string; count: number }>> {
    return (await countLiveReferences(tx, BRANCH_IN_USE_REFERENCES, brId)).filter(
      (ref) => ref.count > 0,
    );
  }
  /**
   * Notes 72 C7 — the GSTIN must be of the branch's own state and PAN.
   * Returns the PAN to store when none was given and the GSTIN carries one.
   */
  private assertGstin(
    gstin: string | null | undefined,
    stateCode: string,
    pan: string | null | undefined,
  ): string | null {
    const check = checkGstin(gstin, stateCode, pan, {
      gstin: 'brGstinNo',
      stateCode: 'brStateCode',
      pan: 'brPanNo',
    });
    if (check.errors.length) {
      this.throwBadRequest('Validation failed', check.errors);
    }
    return check.panFromGstin;
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
