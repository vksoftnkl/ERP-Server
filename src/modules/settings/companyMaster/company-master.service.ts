import { Injectable } from '@nestjs/common';
import { Company, FiscalYear, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveCompanyMasterDto } from './dto/save-company-master.dto';
import {
  CompanyMasterErrorDetail,
  CompanyMasterErrorResponse,
  CompanyMasterPayload,
} from './types/company-master-api.types';
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
  toNumber,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import {
  countLiveReferences,
  type LiveReference,
} from 'src/modules/Inventory/utils/master-tree.helper';
import { checkGstin } from '../shared/gst-registration';
import { BranchMasterService } from '../branchMaster/branch-master.service';

const COMPANY_MASTER_TABLE_NAME = 'companys';
const COMPANY_MASTER_AUDIT_SCREEN_NAME = 'Company Master';
const COMPANY_MASTER_OPTIONAL_FIELDS = [
  'compCode',
  'compShort',
  'compLegalName',
  'compGstinNo',
  'compGstRegType',
  'compPanNo',
  'compTanNo',
  'compCinNo',
  'compFssaiNo',
  'compDrugLicenseNo',
  'compAddr1',
  'compAddr2',
  'compAddr3',
  'compCity',
  'compDistrict',
  'compState',
  'compPin',
  'compCountry',
  'compRegionAddr1',
  'compRegionAddr2',
  'compRegionAddr3',
  'compRegionCity',
  'compRegionDistrict',
  'compRegionState',
  'compRegionCountry',
  'compRegionName',
  'compTel',
  'compPhone',
  'compMail',
  'compSupportEmail',
  'compSupportPhone',
  'compWebsiteName',
  // compFinYearFrom / compFinYearTo / compBooksBeginFrom seed the first fiscal
  // year on create and are ignored on update; compBooksLockDate is ignored
  // always — the year owns its dates and its lock (notes 72 A1 / C2).
  'compGstApplicable',
  'compTcsApplicable',
  'compTdsApplicable',
  'compAatoClass',
  'compDcPurposes',
  'compSmsApplicable',
  'compEinvoiceApplicable',
  'compEwayApplicable',
  'compEwayDate',
  'compEwayInterLimit',
  'compEwayIntraApl',
  'compEwayIntraLimit',
  'compEinvoiceDate',
  'compEinvoiceInclEway',
  'compBankId',
  'compPriceFixing',
  'compPrefixCode',
  'compBillGreeting',
  'compNegStkApl',
  'compDefault',
  'compIsActive',
  'compCurrencyCode',
  'compCurrencySymbol',
  'compLocaleCode',
  'compRemarks',
  // compAuthorizeSignature is validated and normalised on its own (C5).
];

/**
 * What keeps a company from being deleted (notes 72 B2). Its FKs are RESTRICT,
 * which only ever guards a hard delete; a soft delete used to leave live
 * branches under a deleted company. Documents hang off branches, so a branch
 * that has any cannot be deleted either (BranchMasterService).
 */
const COMPANY_DELETE_REFERENCES: readonly LiveReference[] = [
  {
    table: 'public.branch_master',
    column: 'br_comp_id',
    live: 'br_is_deleted = false',
    label: 'live branches',
  },
  {
    table: 'accounts.acc_ledger_master',
    column: 'led_company_id',
    live: 'led_is_deleted = false',
    label: 'live ledgers',
  },
  {
    table: 'accounts.acc_voucher_header',
    column: 'avh_company_id',
    live: 'true',
    label: 'vouchers',
  },
];

/** C5 — the signature image: at most this many bytes once decoded. */
const SIGNATURE_MAX_BYTES = 512 * 1024;
/** C5 — the image kinds a signature may be, told by their first bytes. */
const SIGNATURE_IMAGE_TYPES: ReadonlyArray<readonly [string, (bytes: Buffer) => boolean]> = [
  ['image/png', (b) => b.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))],
  ['image/jpeg', (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ['image/gif', (b) => b.subarray(0, 4).toString('latin1') === 'GIF8'],
  [
    'image/webp',
    (b) =>
      b.subarray(0, 4).toString('latin1') === 'RIFF' &&
      b.subarray(8, 12).toString('latin1') === 'WEBP',
  ],
];

/** The first fiscal year a new company is created with (notes 72 A1). */
interface FirstYear {
  name: string;
  begin: Date;
  end: Date;
  booksBegin: Date;
}
const utcDay = (year: number, monthIndex: number, day: number) =>
  new Date(Date.UTC(year, monthIndex, day));
const sameDay = (date: Date) =>
  utcDay(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
/** The calendar year in which the April-to-March year containing `date` begins. */
const aprilYearOf = (date: Date) =>
  date.getUTCMonth() >= 3 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
const isFirstApril = (date: Date) => date.getUTCMonth() === 3 && date.getUTCDate() === 1;
const isThirtyFirstMarch = (date: Date) => date.getUTCMonth() === 2 && date.getUTCDate() === 31;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

type CompanyWriteClient = SettingsWriteClient;
@Injectable()
export class CompanyMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
    private readonly branchMasterService: BranchMasterService,
  ) {}
  async save(saveCompanyMasterDto: SaveCompanyMasterDto): Promise<CompanyMasterPayload> {
    if (saveCompanyMasterDto.compId) {
      return this.updateCompany(saveCompanyMasterDto);
    }
    return this.createCompany(saveCompanyMasterDto);
  }

  async getById(compId: string): Promise<CompanyMasterPayload> {
    const record = await this.prisma.company.findFirst({
      where: {
        compId,
        compIsDeleted: false,
      },
      include: {
        stylesheet: { select: { thmName: true } },
      },
    });
    if (!record) {
      this.throwNotFound(compId);
    }
    const bankLedger = record.compBankId
      ? await this.prisma.accLedgerMaster.findUnique({
          where: { ledId: record.compBankId },
          select: { ledName: true },
        })
      : null;
    return this.toPayload(
      record,
      {
        compStylesheetName: record.stylesheet?.thmName ?? null,
        compBankName: bankLedger?.ledName ?? null,
      },
      await this.currentYear(this.prisma, compId),
    );
  }
  async softDelete(compId: string): Promise<{ compId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.company.findFirst({
        where: {
          compId,
          compIsDeleted: false,
        },
      });
      if (!existing) {
        this.throwNotFound(compId);
      }
      await this.assertDeletable(tx, existing);
      const modifiedOn = new Date();
      const result = await tx.company.updateMany({
        where: {
          compId,
          compIsDeleted: false,
        },
        data: {
          compIsDeleted: true,
          compIsActive: false,
          compDefault: false,
          compModifiedOn: modifiedOn,
          compModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        this.throwNotFound(compId);
      }
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        compIsDeleted: true,
        compIsActive: false,
        compDefault: false,
        compModifiedOn: modifiedOn,
        compModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: COMPANY_MASTER_TABLE_NAME,
          screenName: COMPANY_MASTER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: String(compId),
          displayName: existing.compName,
          originalRecord,
          modifiedRecord,
          userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
          notes: 'Company soft deleted',
        },
        tx,
      );
      return {
        compId,
        deleted: true,
      };
    });
  }
  /**
   * Notes 72 B1 — brings a soft-deleted company back, active. 409 when it is
   * not deleted. It comes back as a non-default company; its branches are
   * restored one by one (POST /branch-masters/restore).
   */
  async restore(compId: string): Promise<{ compId: string; deleted: false }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.company.findFirst({ where: { compId } });
      if (!existing) {
        throwSettingsNotFound<CompanyMasterErrorDetail>(
          'Company not found',
          'compId',
          `No company found with id ${compId}`,
        );
      }
      if (!existing.compIsDeleted) {
        throwSettingsConflict<CompanyMasterErrorDetail>('Company is not deleted', [
          {
            field: 'compId',
            message: `${existing.compName} is live; only a deleted company can be restored`,
          },
        ]);
      }
      const modifiedOn = new Date();
      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      const result = await tx.company.updateMany({
        where: { compId, compIsDeleted: true },
        data: {
          compIsDeleted: false,
          compIsActive: true,
          compModifiedOn: modifiedOn,
          compModifiedBy: actor,
        },
      });
      if (result.count === 0) {
        this.throwNotFound(compId);
      }
      await this.auditLogService.logEntityChange(
        {
          action: 'update',
          tableName: COMPANY_MASTER_TABLE_NAME,
          screenName: COMPANY_MASTER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: String(compId),
          displayName: existing.compName,
          originalRecord: this.toPayload(existing),
          modifiedRecord: this.toPayload({
            ...existing,
            compIsDeleted: false,
            compIsActive: true,
            compModifiedOn: modifiedOn,
            compModifiedBy: actor,
          }),
          userId: actor,
          notes: 'Company restored',
        },
        tx,
      );
      return { compId, deleted: false };
    });
  }
  private async createCompany(
    saveCompanyMasterDto: SaveCompanyMasterDto,
  ): Promise<CompanyMasterPayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const compName = this.normalizeRequiredName(saveCompanyMasterDto.compName, 'compName');
        const compStateCode = this.normalizeLengthCode(
          saveCompanyMasterDto.compStateCode,
          2,
          'compStateCode',
        );
        const year = this.resolveFirstYear(saveCompanyMasterDto);
        const panFromGstin = this.assertGstin(
          saveCompanyMasterDto.compGstinNo ?? null,
          compStateCode,
          saveCompanyMasterDto.compPanNo ?? null,
        );
        const signature = this.normalizeSignature(saveCompanyMasterDto.compAuthorizeSignature);
        await this.ensureNameIsUnique(tx, compName);
        await this.ensureCodeIsUnique(tx, saveCompanyMasterDto.compCode ?? null);
        await this.ensureGstinIsUnique(tx, saveCompanyMasterDto.compGstinNo ?? null);
        await this.ensureThemeIsLive(tx, saveCompanyMasterDto.compStylesheetId);
        if (saveCompanyMasterDto.compDefault === true) {
          await this.clearDefaultCompany(tx);
        }
        const now = new Date();
        const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
        const data: Prisma.CompanyUncheckedCreateInput = {
          compName,
          compStateCode,
          compStylesheetId: saveCompanyMasterDto.compStylesheetId,
          // The dates the first year was actually seeded with (C2).
          compFinYearFrom: year.begin,
          compFinYearTo: year.end,
          compBooksBeginFrom: year.booksBegin,
          compCreatedOn: now,
          compCreatedBy: actor,
        };
        this.applyOptionalFields(data, saveCompanyMasterDto);
        if (panFromGstin) {
          data.compPanNo = panFromGstin;
        }
        if (signature !== undefined) {
          data.compAuthorizeSignature = signature;
        }
        const created = await tx.company.create({ data });
        // A1 — a company is usable from the moment it exists: the year list at
        // login, the lock date and every posting guard read fiscal_years.
        const fiscalYear = await tx.fiscalYear.create({
          data: {
            compId: created.compId,
            fyYearName: year.name,
            fyBeginDate: year.begin,
            fyEndDate: year.end,
            fyBooksBeginDate: year.booksBegin,
            fyStatus: 'OPEN',
            fyIsCurrent: true,
            createdBy: actor,
            fyRemarks: 'Seeded on company create',
          },
        });
        // Notes 78 — and a branch to work in: the login token, godowns,
        // counters, number series and stock balances all hang off one. The
        // Main Branch brings its Main Godown; the client names both.
        const compMainBranch = await this.branchMasterService.seedMainBranch(
          tx,
          created,
          actor,
          now,
        );
        const payload: CompanyMasterPayload = {
          ...this.toPayload(created, undefined, fiscalYear),
          compMainBranch,
        };
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: COMPANY_MASTER_TABLE_NAME,
            screenName: COMPANY_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: String(payload.compId),
            displayName: payload.compName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Company created',
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
  private async updateCompany(
    saveCompanyMasterDto: SaveCompanyMasterDto,
  ): Promise<CompanyMasterPayload> {
    const compId = saveCompanyMasterDto.compId!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.company.findFirst({
          where: {
            compId,
            compIsDeleted: false,
          },
        });
        if (!existing) {
          this.throwNotFound(compId);
        }
        const compName = this.normalizeRequiredName(saveCompanyMasterDto.compName, 'compName');
        const compStateCode = this.normalizeLengthCode(
          saveCompanyMasterDto.compStateCode,
          2,
          'compStateCode',
        );
        // C7 against what the company will hold after this save: an omitted
        // GSTIN or PAN keeps the stored one.
        const panFromGstin = this.assertGstin(
          saveCompanyMasterDto.compGstinNo !== undefined
            ? saveCompanyMasterDto.compGstinNo
            : existing.compGstinNo,
          compStateCode,
          saveCompanyMasterDto.compPanNo !== undefined
            ? saveCompanyMasterDto.compPanNo
            : existing.compPanNo,
        );
        const signature = this.normalizeSignature(saveCompanyMasterDto.compAuthorizeSignature);
        await this.ensureNameIsUnique(tx, compName, compId);
        await this.ensureCodeIsUnique(tx, saveCompanyMasterDto.compCode ?? null, compId);
        await this.ensureGstinIsUnique(tx, saveCompanyMasterDto.compGstinNo ?? null, compId);
        // Only a CHANGED theme is checked: a company already pointing at a theme
        // retired since is still saved for an unrelated edit.
        if (saveCompanyMasterDto.compStylesheetId !== existing.compStylesheetId) {
          await this.ensureThemeIsLive(tx, saveCompanyMasterDto.compStylesheetId);
        }
        if (saveCompanyMasterDto.compDefault === true) {
          await this.clearDefaultCompany(tx, compId);
        }
        const data: Prisma.CompanyUncheckedUpdateInput = {
          compName,
          compStateCode,
          compStylesheetId: saveCompanyMasterDto.compStylesheetId,
          compModifiedOn: new Date(),
          compModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        };
        this.applyOptionalFields(data, saveCompanyMasterDto);
        if (panFromGstin) {
          data.compPanNo = panFromGstin;
        }
        if (signature !== undefined) {
          data.compAuthorizeSignature = signature;
        }
        const updated = await tx.company.update({
          where: {
            compId,
          },
          data,
        });
        const year = await this.currentYear(tx, compId);
        const payload = this.toPayload(updated, undefined, year);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: COMPANY_MASTER_TABLE_NAME,
            screenName: COMPANY_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: String(compId),
            displayName: payload.compName,
            originalRecord: this.toPayload(existing, undefined, year),
            modifiedRecord: payload,
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            notes: 'Company updated',
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
    tx: CompanyWriteClient,
    compName: string,
    excludeCompId?: string,
  ): Promise<void> {
    const existing = await tx.company.findFirst({
      where: {
        compName: {
          equals: compName,
          mode: 'insensitive',
        },
        ...(excludeCompId !== undefined
          ? {
              compId: {
                not: excludeCompId,
              },
            }
          : {}),
      },
      select: {
        compId: true,
      },
    });
    if (existing) {
      throwSettingsConflict<CompanyMasterErrorDetail>('Company name already exists', [
        {
          field: 'compName',
          message: 'Duplicate compName is not allowed',
        },
      ]);
    }
  }
  private async ensureCodeIsUnique(
    tx: CompanyWriteClient,
    compCode: string | null,
    excludeCompId?: string,
  ): Promise<void> {
    if (!compCode) {
      return;
    }
    const existing = await tx.company.findFirst({
      where: {
        compCode: {
          equals: compCode,
          mode: 'insensitive',
        },
        ...(excludeCompId !== undefined
          ? {
              compId: {
                not: excludeCompId,
              },
            }
          : {}),
      },
      select: {
        compId: true,
      },
    });
    if (existing) {
      throwSettingsConflict<CompanyMasterErrorDetail>('Company code already exists', [
        {
          field: 'compCode',
          message: 'Duplicate compCode is not allowed',
        },
      ]);
    }
  }
  private async ensureGstinIsUnique(
    tx: CompanyWriteClient,
    compGstinNo: string | null,
    excludeCompId?: string,
  ): Promise<void> {
    if (!compGstinNo) {
      return;
    }
    const existing = await tx.company.findFirst({
      where: {
        compGstinNo: {
          equals: compGstinNo,
          mode: 'insensitive',
        },
        ...(excludeCompId !== undefined
          ? {
              compId: {
                not: excludeCompId,
              },
            }
          : {}),
      },
      select: {
        compId: true,
      },
    });
    if (existing) {
      throwSettingsConflict<CompanyMasterErrorDetail>('Company GSTIN already exists', [
        {
          field: 'compGstinNo',
          message: 'Duplicate compGstinNo is not allowed',
        },
      ]);
    }
  }
  private async clearDefaultCompany(tx: CompanyWriteClient, excludeCompId?: string): Promise<void> {
    await tx.company.updateMany({
      where: {
        compIsDeleted: false,
        compDefault: true,
        ...(excludeCompId !== undefined
          ? {
              compId: {
                not: excludeCompId,
              },
            }
          : {}),
      },
      data: {
        compDefault: false,
        compModifiedOn: new Date(),
        compModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
      },
    });
  }
  private applyOptionalFields(
    data: Prisma.CompanyUncheckedCreateInput | Prisma.CompanyUncheckedUpdateInput,
    saveCompanyMasterDto: SaveCompanyMasterDto,
  ): void {
    applyPresentFields(data, saveCompanyMasterDto, COMPANY_MASTER_OPTIONAL_FIELDS);
  }
  private normalizeRequiredName(value: string, field: string): string {
    return normalizeRequiredText<CompanyMasterErrorDetail>(value, field);
  }
  private normalizeLengthCode(value: string, length: number, field: string): string {
    const normalized = value.trim().toUpperCase();
    if (normalized.length !== length) {
      this.throwBadRequest('Validation failed', [
        {
          field,
          message: `${field} must be exactly ${length} characters`,
        },
      ]);
    }
    return normalized;
  }
  /**
   * @param year the company's current fiscal year. Its begin / end /
   *   books-begin / lock date are what compFinYearFrom / compFinYearTo /
   *   compBooksBeginFrom / compBooksLockDate report (notes 72 C2); without one
   *   the companys columns are reported as stored.
   */
  private toPayload(
    record: Company,
    related: { compStylesheetName: string | null; compBankName: string | null } = {
      compStylesheetName: null,
      compBankName: null,
    },
    year: FiscalYear | null = null,
  ): CompanyMasterPayload {
    const finYearFrom = year ? year.fyBeginDate : record.compFinYearFrom;
    const finYearTo = year ? year.fyEndDate : record.compFinYearTo;
    const booksBeginFrom = year
      ? (year.fyBooksBeginDate ?? year.fyBeginDate)
      : record.compBooksBeginFrom;
    const booksLockDate = year ? year.fyLockDate : record.compBooksLockDate;
    return {
      compId: record.compId,
      compCode: record.compCode,
      compName: record.compName,
      compShort: record.compShort,
      compLegalName: record.compLegalName,
      compGstinNo: record.compGstinNo,
      compGstRegType: record.compGstRegType,
      compPanNo: record.compPanNo,
      compTanNo: record.compTanNo,
      compCinNo: record.compCinNo,
      compFssaiNo: record.compFssaiNo,
      compDrugLicenseNo: record.compDrugLicenseNo,
      compAddr1: record.compAddr1,
      compAddr2: record.compAddr2,
      compAddr3: record.compAddr3,
      compCity: record.compCity,
      compDistrict: record.compDistrict,
      compState: record.compState,
      compStateCode: record.compStateCode,
      compPin: record.compPin,
      compCountry: record.compCountry,
      compRegionAddr1: record.compRegionAddr1,
      compRegionAddr2: record.compRegionAddr2,
      compRegionAddr3: record.compRegionAddr3,
      compRegionCity: record.compRegionCity,
      compRegionDistrict: record.compRegionDistrict,
      compRegionState: record.compRegionState,
      compRegionCountry: record.compRegionCountry,
      compRegionName: record.compRegionName,
      compTel: record.compTel,
      compPhone: record.compPhone,
      compMail: record.compMail,
      compSupportEmail: record.compSupportEmail,
      compSupportPhone: record.compSupportPhone,
      compWebsiteName: record.compWebsiteName,
      compFinYearFrom: finYearFrom ? finYearFrom.toISOString() : null,
      compFinYearTo: finYearTo ? finYearTo.toISOString() : null,
      compBooksBeginFrom: booksBeginFrom ? booksBeginFrom.toISOString() : null,
      compBooksLockDate: booksLockDate ? booksLockDate.toISOString() : null,
      compGstApplicable: record.compGstApplicable,
      compTcsApplicable: record.compTcsApplicable,
      compTdsApplicable: record.compTdsApplicable,
      compAatoClass: record.compAatoClass,
      compDcPurposes: record.compDcPurposes,
      compSmsApplicable: record.compSmsApplicable,
      compEinvoiceApplicable: record.compEinvoiceApplicable,
      compEwayApplicable: record.compEwayApplicable,
      compEwayDate: record.compEwayDate ? record.compEwayDate.toISOString() : null,
      compEwayInterLimit: toNullableNumber(record.compEwayInterLimit),
      compEwayIntraApl: record.compEwayIntraApl,
      compEwayIntraLimit: toNumber(record.compEwayIntraLimit),
      compEinvoiceDate: record.compEinvoiceDate ? record.compEinvoiceDate.toISOString() : null,
      compEinvoiceInclEway: record.compEinvoiceInclEway,
      compStylesheetId: record.compStylesheetId,
      compStylesheetName: related.compStylesheetName,
      compBankId: record.compBankId,
      compBankName: related.compBankName,
      compPriceFixing: record.compPriceFixing,
      compPrefixCode: record.compPrefixCode,
      compBillGreeting: record.compBillGreeting,
      compNegStkApl: record.compNegStkApl,
      compDefault: record.compDefault,
      compIsActive: record.compIsActive,
      compCurrencyCode: record.compCurrencyCode,
      compCurrencySymbol: record.compCurrencySymbol,
      compLocaleCode: record.compLocaleCode,
      compRemarks: record.compRemarks,
      compAuthorizeSignature: record.compAuthorizeSignature,
      compIsDeleted: record.compIsDeleted,
      compSyncDate: record.compSyncDate ? record.compSyncDate.toISOString() : null,
      compCreatedOn: record.compCreatedOn.toISOString(),
      compCreatedBy: record.compCreatedBy,
      compModifiedOn: record.compModifiedOn.toISOString(),
      compModifiedBy: record.compModifiedBy,
    };
  }
  private handleWriteError(error: unknown): void {
    throwOnUniqueConstraintError<CompanyMasterErrorDetail>(error, 'Company already exists', [
      {
        field: 'compName',
        message: 'Duplicate company unique value is not allowed',
      },
    ]);
  }
  /** The company's current fiscal year, if it has one. */
  private currentYear(client: CompanyWriteClient, compId: string): Promise<FiscalYear | null> {
    return client.fiscalYear.findFirst({
      where: { compId, fyIsCurrent: true, isDeleted: false },
    });
  }
  /**
   * Notes 72 B2 — the default company is not deleted (the delete would leave
   * none), nor one that live branches, live ledgers or vouchers still use.
   */
  private async assertDeletable(tx: CompanyWriteClient, existing: Company): Promise<void> {
    if (existing.compDefault) {
      throwSettingsConflict<CompanyMasterErrorDetail>('The default company cannot be deleted', [
        {
          field: 'compId',
          message: `${existing.compName} is the default company; make another company the default first`,
        },
      ]);
    }
    const used = (await countLiveReferences(tx, COMPANY_DELETE_REFERENCES, existing.compId)).filter(
      (ref) => ref.count > 0,
    );
    if (used.length) {
      throwSettingsConflict<CompanyMasterErrorDetail>('This company is still in use', [
        {
          field: 'compId',
          message:
            `Used by ${used.map((ref) => `${ref.count} ${ref.label}`).join(', ')}. ` +
            'Delete those first; a deleted company would leave them under books nobody can open.',
        },
      ]);
    }
  }
  /**
   * Notes 72 A1 — the year a new company starts in, derived as the share's
   * 43_fiscal_year_seed.sql derives it (prisma/seed/Fiscal_Year_Seed.sql).
   *
   * A year is ALWAYS 1 April – 31 March and is named 'YYYY-YYYY' with the
   * second year one more than the first: ck_caa_fin_year, isValidAccYear and
   * every accYear check assume exactly that. So compFinYearFrom must be a
   * 1 April and compFinYearTo the 31 March after it (400 otherwise — they are
   * refused, not silently moved; a range like 2026-03-20 .. 2026-03-28 once
   * became an eight-day year named '2026-2026'). The year is the one that
   * begins on compFinYearFrom, else ends on compFinYearTo, else contains
   * compBooksBeginFrom, else contains today (IST). The books begin inside it.
   */
  private resolveFirstYear(dto: SaveCompanyMasterDto): FirstYear {
    const from = dto.compFinYearFrom ? sameDay(dto.compFinYearFrom) : null;
    const to = dto.compFinYearTo ? sameDay(dto.compFinYearTo) : null;
    const books = dto.compBooksBeginFrom ? sameDay(dto.compBooksBeginFrom) : null;
    if (from && !isFirstApril(from)) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'compFinYearFrom',
          message: `A financial year begins on 1 April; compFinYearFrom is ${isoDay(from)}`,
        },
      ]);
    }
    if (to && !isThirtyFirstMarch(to)) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'compFinYearTo',
          message: `A financial year ends on 31 March; compFinYearTo is ${isoDay(to)}`,
        },
      ]);
    }
    if (from && to && to.getUTCFullYear() !== from.getUTCFullYear() + 1) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'compFinYearTo',
          message: `A year from ${isoDay(from)} ends on ${from.getUTCFullYear() + 1}-03-31; compFinYearTo is ${isoDay(to)}`,
        },
      ]);
    }
    const startYear = from
      ? from.getUTCFullYear()
      : to
        ? to.getUTCFullYear() - 1
        : aprilYearOf(books ?? this.todayInIndia());
    const begin = utcDay(startYear, 3, 1);
    const end = utcDay(startYear + 1, 2, 31);
    const booksBegin = books ?? begin;
    if (booksBegin < begin || booksBegin > end) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'compBooksBeginFrom',
          message: `compBooksBeginFrom must fall inside the first year, ${isoDay(begin)} to ${isoDay(end)}`,
        },
      ]);
    }
    return { name: `${startYear}-${startYear + 1}`, begin, end, booksBegin };
  }
  /** Today's date in IST, as a UTC-midnight Date like the DTO's dates. */
  private todayInIndia(): Date {
    const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(new Date())
      .split('-')
      .map(Number);
    return utcDay(year, month - 1, day);
  }
  /**
   * Notes 72 C7 — the GSTIN must be of the company's own state and PAN.
   * Returns the PAN to store when none was given and the GSTIN carries one.
   */
  private assertGstin(
    gstin: string | null | undefined,
    stateCode: string,
    pan: string | null | undefined,
  ): string | null {
    const check = checkGstin(gstin, stateCode, pan, {
      gstin: 'compGstinNo',
      stateCode: 'compStateCode',
      pan: 'compPanNo',
    });
    if (check.errors.length) {
      this.throwBadRequest('Validation failed', check.errors);
    }
    return check.panFromGstin;
  }
  /**
   * Notes 72 C5 — the authorised signature, as a data URL of a real image.
   * Accepts a data URL or bare base64; the image kind is read from the bytes,
   * not from what the caller claims. undefined = not sent (kept), null / "" =
   * cleared.
   */
  private normalizeSignature(value: string | null | undefined): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null || !value.trim()) {
      return null;
    }
    const field = 'compAuthorizeSignature';
    const dataUrl = /^data:([^;,]*)((?:;[^;,]*)*),(.*)$/s.exec(value.trim());
    if (dataUrl && !dataUrl[2].split(';').includes('base64')) {
      this.throwBadRequest('Invalid signature image', [
        { field, message: `${field} must be base64-encoded` },
      ]);
    }
    const base64 = (dataUrl ? dataUrl[3] : value).replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) {
      this.throwBadRequest('Invalid signature image', [
        { field, message: `${field} must be valid base64 content` },
      ]);
    }
    const bytes = Buffer.from(base64, 'base64');
    if (bytes.length > SIGNATURE_MAX_BYTES) {
      this.throwBadRequest('Invalid signature image', [
        {
          field,
          message: `${field} must be at most ${SIGNATURE_MAX_BYTES / 1024} KB; this one is ${Math.ceil(bytes.length / 1024)} KB`,
        },
      ]);
    }
    const type = SIGNATURE_IMAGE_TYPES.find(([, isType]) => isType(bytes))?.[0];
    if (!type) {
      this.throwBadRequest('Invalid signature image', [
        { field, message: `${field} must be a PNG, JPEG, GIF or WebP image` },
      ]);
    }
    return `data:${type};base64,${bytes.toString('base64')}`;
  }
  private throwNotFound(compId: string): never {
    throwSettingsNotFound<CompanyMasterErrorDetail>(
      'Company not found',
      'compId',
      `No active company found with id ${compId}`,
    );
  }
  /**
   * theme/plan-app-theme.md §3.1 — the FK to app_theme_master accepts a
   * soft-deleted row, so a company could be pointed at a theme nobody can see
   * or edit. Refused here: the theme must be active and not deleted.
   */
  private async ensureThemeIsLive(
    tx: SettingsWriteClient,
    thmId: number | null | undefined,
  ): Promise<void> {
    if (thmId === null || thmId === undefined) {
      return;
    }
    const theme = await tx.appThemeMaster.findFirst({
      where: { thmId, thmIsActive: true, thmIsDeleted: false },
      select: { thmId: true },
    });
    if (!theme) {
      this.throwBadRequest('Validation failed', [
        { field: 'compStylesheetId', message: `theme ${thmId} is not active` },
      ]);
    }
  }
  private throwBadRequest(message: string, errors: CompanyMasterErrorDetail[]): never {
    throwSettingsBadRequest<CompanyMasterErrorDetail>(message, errors);
  }
  private buildErrorResponse(
    message: string,
    errors: CompanyMasterErrorDetail[] = [],
  ): CompanyMasterErrorResponse {
    return buildSettingsErrorResponse<CompanyMasterErrorDetail, CompanyMasterErrorResponse>(
      message,
      errors,
    );
  }
}
