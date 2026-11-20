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
  violatedConstraintOf,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import {
  countLiveReferences,
  type LiveReference,
} from 'src/modules/Inventory/utils/master-tree.helper';
import { checkGstin } from '../shared/gst-registration';
import { COMPANY_CODE_SERIES, lockCodeSeries } from '../shared/code-series-lock';
import { COMPANY_CODE_RULE, initialsCode, nextFreeCode } from '../shared/code-from-name';
import {
  PIN_MAX,
  PIN_MIN,
  isBlank,
  isGstRegistered,
  isValidPin,
} from '../shared/registered-address';
import { CompanyMasterErrorCode } from './types/company-master-error-codes';
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
  // year on create and are ignored on update — the year owns its dates (notes
  // 72 A1 / C2).
  // Plan 18/11 Q1: the Books Lock Date is the company's own column again,
  // saved and returned as sent; nothing enforces it yet (the next job). The
  // year's fy_lock_date (a whole-year lock) is not touched here.
  'compBooksLockDate',
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
  'compUdyamNo',
  'compSignatoryName',
  // compAuthorizeSignature and compLogo are validated and normalised on their
  // own (C5, plan 18/11).
];
/** Plan I1 — what a GSTIN holder's seller address must have, in screen order. */
const COMPANY_ADDRESS_KEYS = ['compAddr1', 'compCity', 'compStateCode', 'compPin'] as const;
/** Plan 18/11 — the Udyam (MSME) registration number. */
const UDYAM_PATTERN = /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/;
/** Plan C5 — what a new company's currency symbol is when none is sent. */
export const DEFAULT_CURRENCY_SYMBOL = 'Rs.';

/**
 * Plan C1 (18/11) — the code a company gets when none is typed: the initials
 * of its name's words (PRIVATE, PVT, LIMITED, LTD, THE, AND and & skipped;
 * each word kept to A-Z 0-9), at most 6, padded to at least 3 with the next
 * letters of the first word (then of the next ones). "MT Demo Traders" → MDT,
 * "SUGI TRADERS" → STU. null when the name holds no A-Z / 0-9 at all. The
 * caller adds 2, 3, … while the code is taken. The generator lives in
 * settings/shared/code-from-name.ts since HR review step 5 (20/11).
 */
export function companyCodeBase(name: string): string | null {
  return initialsCode(name, COMPANY_CODE_RULE);
}

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

/** C5 — a company image (signature, logo): at most this many bytes once decoded. */
const SIGNATURE_MAX_BYTES = 512 * 1024;
/** C5 — the image kinds a company image may be, told by their first bytes. */
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
/** Which field a company image arrives in, and the codes its refusals carry. */
interface CompanyImageRule {
  field: 'compAuthorizeSignature' | 'compLogo';
  title: string;
  notBase64: CompanyMasterErrorCode;
  tooLarge: CompanyMasterErrorCode;
  notImage: CompanyMasterErrorCode;
}
/** Notes 72 C5 — the authorised signature image. */
const SIGNATURE_IMAGE: CompanyImageRule = {
  field: 'compAuthorizeSignature',
  title: 'Invalid signature image',
  notBase64: CompanyMasterErrorCode.SIGNATURE_NOT_BASE64,
  tooLarge: CompanyMasterErrorCode.SIGNATURE_TOO_LARGE,
  notImage: CompanyMasterErrorCode.SIGNATURE_NOT_IMAGE,
};
/** Plan 18/11 — the company logo: the signature's rules, its own codes. */
const LOGO_IMAGE: CompanyImageRule = {
  field: 'compLogo',
  title: 'Invalid logo image',
  notBase64: CompanyMasterErrorCode.LOGO_NOT_BASE64,
  tooLarge: CompanyMasterErrorCode.LOGO_TOO_LARGE,
  notImage: CompanyMasterErrorCode.LOGO_NOT_IMAGE,
};

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

/**
 * Review N2 (19/11) — the 409 a unique-index race answers, by what the index
 * covers (violatedConstraintOf: its columns or its name, e.g. `comp_code` or
 * `companys_comp_code_key`). The Main Branch's br_code is seeded inside a
 * company create and is made from the company code, so its clash points at
 * compCode, never at the name.
 */
export function uniqueRaceDetail(target: string | null): CompanyMasterErrorDetail {
  const covers = (column: string) =>
    (target ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .includes(column);
  if (covers('compcode')) {
    return {
      field: 'compCode',
      message: 'Another company took this code at the same moment',
      code: CompanyMasterErrorCode.CODE_DUPLICATE,
    };
  }
  if (covers('compgstinno')) {
    return {
      field: 'compGstinNo',
      message: 'Another company took this GSTIN at the same moment',
      code: CompanyMasterErrorCode.GSTIN_DUPLICATE,
    };
  }
  if (covers('brcode')) {
    return {
      field: 'compCode',
      message:
        'Another branch took the Main Branch code made from this company code at the same moment; save again',
      code: CompanyMasterErrorCode.DUPLICATE,
    };
  }
  return {
    field: 'compName',
    message: 'Duplicate company unique value is not allowed',
    code: CompanyMasterErrorCode.DUPLICATE,
  };
}

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
          CompanyMasterErrorCode.NOT_FOUND,
        );
      }
      if (!existing.compIsDeleted) {
        throwSettingsConflict<CompanyMasterErrorDetail>('Company is not deleted', [
          {
            field: 'compId',
            message: `${existing.compName} is live; only a deleted company can be restored`,
            code: CompanyMasterErrorCode.NOT_DELETED,
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
        this.assertRegistrationRules(saveCompanyMasterDto, null);
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
        const signature = this.normalizeImage(
          saveCompanyMasterDto.compAuthorizeSignature,
          SIGNATURE_IMAGE,
        );
        const logo = this.normalizeImage(saveCompanyMasterDto.compLogo, LOGO_IMAGE);
        // Plan C1 / C9a: one create at a time picks the next free company code
        // and Main Branch code, so two creates never pick the same one.
        await lockCodeSeries(tx, COMPANY_CODE_SERIES);
        await this.ensureNameIsUnique(tx, compName);
        const typedCode = saveCompanyMasterDto.compCode ?? null;
        await this.ensureCodeIsUnique(tx, typedCode);
        const autoCode = typedCode ? null : await this.nextCompanyCode(tx, compName);
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
        if (autoCode) {
          data.compCode = autoCode;
        }
        // C5: the column default fills an omitted column only, not a sent null.
        if (!data.compCurrencySymbol) {
          data.compCurrencySymbol = DEFAULT_CURRENCY_SYMBOL;
        }
        if (panFromGstin) {
          data.compPanNo = panFromGstin;
        }
        if (signature !== undefined) {
          data.compAuthorizeSignature = signature;
        }
        if (logo !== undefined) {
          data.compLogo = logo;
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
        this.assertRegistrationRules(saveCompanyMasterDto, existing);
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
        const signature = this.normalizeImage(
          saveCompanyMasterDto.compAuthorizeSignature,
          SIGNATURE_IMAGE,
        );
        const logo = this.normalizeImage(saveCompanyMasterDto.compLogo, LOGO_IMAGE);
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
        const now = new Date();
        const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
        const data: Prisma.CompanyUncheckedUpdateInput = {
          compName,
          compStateCode,
          compStylesheetId: saveCompanyMasterDto.compStylesheetId,
          compModifiedOn: now,
          compModifiedBy: actor,
        };
        this.applyOptionalFields(data, saveCompanyMasterDto);
        if (panFromGstin) {
          data.compPanNo = panFromGstin;
        }
        if (signature !== undefined) {
          data.compAuthorizeSignature = signature;
        }
        if (logo !== undefined) {
          data.compLogo = logo;
        }
        const updated = await tx.company.update({
          where: {
            compId,
          },
          data,
        });
        // Plan C9b: while the company has only one live branch, that branch
        // takes what this save changed (address / GSTIN group, phones, mail).
        await this.branchMasterService.syncOnlyBranch(tx, existing, updated, actor, now);
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
          code: CompanyMasterErrorCode.NAME_DUPLICATE,
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
          code: CompanyMasterErrorCode.CODE_DUPLICATE,
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
          code: CompanyMasterErrorCode.GSTIN_DUPLICATE,
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
    return normalizeRequiredText<CompanyMasterErrorDetail>(
      value,
      field,
      undefined,
      CompanyMasterErrorCode.NAME_REQUIRED,
    );
  }
  private normalizeLengthCode(value: string, length: number, field: string): string {
    const normalized = value.trim().toUpperCase();
    if (normalized.length !== length) {
      this.throwBadRequest('Validation failed', [
        {
          field,
          message: `${field} must be exactly ${length} characters`,
          code: CompanyMasterErrorCode.STATE_CODE_INVALID,
        },
      ]);
    }
    return normalized;
  }
  /**
   * @param year the company's current fiscal year. Its begin / end /
   *   books-begin dates are what compFinYearFrom / compFinYearTo /
   *   compBooksBeginFrom report (notes 72 C2); without one the companys
   *   columns are reported as stored. compBooksLockDate is always the
   *   company's own column (plan 18/11 Q1), not the year's fy_lock_date.
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
    // Plan 18/11 Q1: the company's own Books Lock Date, as saved.
    const booksLockDate = record.compBooksLockDate;
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
      compUdyamNo: record.compUdyamNo,
      compLogo: record.compLogo,
      compSignatoryName: record.compSignatoryName,
      compIsDeleted: record.compIsDeleted,
      compSyncDate: record.compSyncDate ? record.compSyncDate.toISOString() : null,
      compCreatedOn: record.compCreatedOn.toISOString(),
      compCreatedBy: record.compCreatedBy,
      compModifiedOn: record.compModifiedOn.toISOString(),
      compModifiedBy: record.compModifiedBy,
    };
  }
  /**
   * A unique index the checks above did not catch (a race), told apart by
   * what it covers (review N2, 19/11): the company code, the GSTIN, the Main
   * Branch code seeded with a create (it is made from the company code), else
   * the name.
   */
  private handleWriteError(error: unknown): void {
    throwOnUniqueConstraintError<CompanyMasterErrorDetail>(error, 'Company already exists', [
      uniqueRaceDetail(violatedConstraintOf(error)),
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
          code: CompanyMasterErrorCode.DEFAULT_UNDELETABLE,
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
          code: CompanyMasterErrorCode.IN_USE,
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
          code: CompanyMasterErrorCode.FIN_YEAR_FROM_INVALID,
        },
      ]);
    }
    if (to && !isThirtyFirstMarch(to)) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'compFinYearTo',
          message: `A financial year ends on 31 March; compFinYearTo is ${isoDay(to)}`,
          code: CompanyMasterErrorCode.FIN_YEAR_TO_INVALID,
        },
      ]);
    }
    if (from && to && to.getUTCFullYear() !== from.getUTCFullYear() + 1) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'compFinYearTo',
          message: `A year from ${isoDay(from)} ends on ${from.getUTCFullYear() + 1}-03-31; compFinYearTo is ${isoDay(to)}`,
          code: CompanyMasterErrorCode.FIN_YEAR_SPAN_INVALID,
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
          code: CompanyMasterErrorCode.BOOKS_BEGIN_OUTSIDE_YEAR,
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
    const fields = { gstin: 'compGstinNo', stateCode: 'compStateCode', pan: 'compPanNo' };
    const check = checkGstin(gstin, stateCode, pan, fields);
    if (check.errors.length) {
      // checkGstin (settings/shared) names no code: the field tells a PAN
      // mismatch, and of the GSTIN's two refusals only the state one opens
      // with "GSTIN ".
      this.throwBadRequest(
        'Validation failed',
        check.errors.map((error) => ({
          ...error,
          code:
            error.field === fields.pan
              ? CompanyMasterErrorCode.PAN_GSTIN_MISMATCH
              : error.message.startsWith('GSTIN ')
                ? CompanyMasterErrorCode.GSTIN_STATE_MISMATCH
                : CompanyMasterErrorCode.GSTIN_INVALID,
        })),
      );
    }
    return check.panFromGstin;
  }
  /**
   * Notes 72 C5 — a company image (the authorised signature; the logo since
   * plan 18/11), as a data URL of a real image. Accepts a data URL or bare
   * base64; the image kind is read from the bytes, not from what the caller
   * claims. undefined = not sent (kept), null / "" = cleared. Each field
   * refuses under its own codes (`rule`).
   */
  private normalizeImage(
    value: string | null | undefined,
    rule: CompanyImageRule,
  ): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null || !value.trim()) {
      return null;
    }
    const { field, title } = rule;
    const dataUrl = /^data:([^;,]*)((?:;[^;,]*)*),(.*)$/s.exec(value.trim());
    if (dataUrl && !dataUrl[2].split(';').includes('base64')) {
      this.throwBadRequest(title, [
        {
          field,
          message: `${field} must be base64-encoded`,
          code: rule.notBase64,
        },
      ]);
    }
    const base64 = (dataUrl ? dataUrl[3] : value).replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) {
      this.throwBadRequest(title, [
        {
          field,
          message: `${field} must be valid base64 content`,
          code: rule.notBase64,
        },
      ]);
    }
    const bytes = Buffer.from(base64, 'base64');
    if (bytes.length > SIGNATURE_MAX_BYTES) {
      this.throwBadRequest(title, [
        {
          field,
          message: `${field} must be at most ${SIGNATURE_MAX_BYTES / 1024} KB; this one is ${Math.ceil(bytes.length / 1024)} KB`,
          code: rule.tooLarge,
        },
      ]);
    }
    const type = SIGNATURE_IMAGE_TYPES.find(([, isType]) => isType(bytes))?.[0];
    if (!type) {
      this.throwBadRequest(title, [
        {
          field,
          message: `${field} must be a PNG, JPEG, GIF or WebP image`,
          code: rule.notImage,
        },
      ]);
    }
    return `data:${type};base64,${bytes.toString('base64')}`;
  }
  /**
   * Plan C8 / I1 (18/11) and the pin / Udyam forms, against what the company
   * will hold after this save (on update a key not sent keeps the stored
   * value). A REGULAR, COMPOSITION or SEZ company needs its Legal Name and the
   * seller address of an e-invoice / e-way bill: one COMPANY_ADDRESS_REQUIRED
   * per missing key, `field` = that key. A pin or Udyam No that is SENT must
   * have its form. Every refusal comes back in one 400, in screen order.
   */
  private assertRegistrationRules(dto: SaveCompanyMasterDto, existing: Company | null): void {
    const sent = dto as unknown as Record<string, unknown>;
    const stored = existing as unknown as Record<string, unknown> | null;
    const after = (key: string): unknown =>
      sent[key] !== undefined ? sent[key] : stored ? stored[key] : null;
    const errors: CompanyMasterErrorDetail[] = [];
    const regType = after('compGstRegType') as string | null;
    if (isGstRegistered(regType)) {
      if (isBlank(after('compLegalName'))) {
        errors.push({
          field: 'compLegalName',
          message: `compLegalName is required for a ${regType} company`,
          code: CompanyMasterErrorCode.LEGAL_NAME_REQUIRED,
        });
      }
      for (const key of COMPANY_ADDRESS_KEYS) {
        if (isBlank(after(key))) {
          errors.push({
            field: key,
            message: `${key} is required for a ${regType} company (the e-invoice / e-way seller address)`,
            code: CompanyMasterErrorCode.ADDRESS_REQUIRED,
          });
        }
      }
    }
    if (typeof dto.compPin === 'number' && !isValidPin(dto.compPin)) {
      errors.push({
        field: 'compPin',
        message: `compPin must be 6 digits, ${PIN_MIN} to ${PIN_MAX}; it is ${dto.compPin}`,
        code: CompanyMasterErrorCode.PIN_INVALID,
      });
    }
    if (typeof dto.compUdyamNo === 'string' && !UDYAM_PATTERN.test(dto.compUdyamNo)) {
      errors.push({
        field: 'compUdyamNo',
        message: 'compUdyamNo must look like UDYAM-XX-00-0000000',
        code: CompanyMasterErrorCode.UDYAM_INVALID,
      });
    }
    if (errors.length) {
      this.throwBadRequest('Validation failed', errors);
    }
  }
  /**
   * Plan C1 — the code for a company created without one: companyCodeBase()
   * of its name, then 2, 3, … until no company (deleted ones included: the
   * unique index covers them) holds it in any case. null when the name gives
   * no code.
   */
  private async nextCompanyCode(tx: CompanyWriteClient, compName: string): Promise<string | null> {
    return nextFreeCode(companyCodeBase(compName), async (base) => {
      const rows = await tx.company.findMany({
        where: { compCode: { startsWith: base, mode: 'insensitive' } },
        select: { compCode: true },
      });
      return rows.map((row) => row.compCode);
    });
  }
  private throwNotFound(compId: string): never {
    throwSettingsNotFound<CompanyMasterErrorDetail>(
      'Company not found',
      'compId',
      `No active company found with id ${compId}`,
      CompanyMasterErrorCode.NOT_FOUND,
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
        {
          field: 'compStylesheetId',
          message: `theme ${thmId} is not active`,
          code: CompanyMasterErrorCode.THEME_INACTIVE,
        },
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
