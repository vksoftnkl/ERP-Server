import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isOfflineSite } from 'src/config/offline-site';
import { AccVoucherType, Prisma, VoucherNumberingMode, VoucherResetFreq } from '@prisma/client';
import { withUserWording } from 'src/common/error-wording/error-wording';
import { assertMenuRight, type MenuRight } from 'src/common/posting/rights';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import {
  DEFAULT_ACTOR,
  isUniqueConstraintError,
  isForeignKeyConstraintError,
  throwConflict,
  throwForbidden,
  throwNotFound,
  throwUnprocessable,
  violatedConstraintOf,
  type ModuleErrorDetail,
} from 'src/common/utils/module-shared.utils';
import { PrismaService } from 'src/database/prisma/prisma.service';
import {
  isDeviceWideSeries,
  longestLiveDeviceCode,
} from 'src/common/Sequence/voucher-sequence.helper';
import { AuditLogService } from '../../audit-log/audit-log.service';
import {
  PRINT_DESIGN_ASSIGNMENT_RULE,
  PRINT_DESIGN_LAYOUT_RULE,
  printDesignRuleSql,
} from '../print-template-assignment/print-design-usable.sql';
import type { PrintDesignCloneDto } from './dto/voucher-type-query.dto';
import { resolveVoucherTypeCompany, voucherTypeCompanyMismatch } from './voucher-types-company';
import type { SaveVoucherTypeDto } from './dto/save-voucher-type.dto';
import {
  VOUCHER_TYPE_RIGHT_PREFIX,
  VoucherTypeErrorCode,
  VoucherTypeWarningCode,
} from './types/voucher-types-error-codes';
import type {
  VoucherTypeBranchState,
  VoucherTypeCounter,
  VoucherTypeNode,
  VoucherTypePayload,
  VoucherTypePrintDesign,
  VoucherTypeValidation,
} from './types/voucher-types-api.types';
import {
  ALLOWED_METHODS,
  BASE_LOCKED_FIELDS,
  MIRROR_FIELDS,
  NUMBERING_FIELDS,
  SALES_BILL_TYPE_CODE,
  VOUCHER_TYPES_AUDIT_SCREEN_NAME,
  VOUCHER_TYPES_MENU_ID,
  VOUCHER_TYPES_TABLE_NAME,
  canHaveChildren,
  checkChildIdentity,
  checkNumbering,
  childTypeCode,
  isBaseType,
  isGstDocNo,
  isGstOutward,
  issue,
  kindOf,
  lockedFieldChanges,
  numberedByOf,
  printDocTypeOf,
  sameValue,
  checkDeliveryMode,
  effectiveDeliveryMode,
  hasDeliveryMode,
  type BranchFact,
  type MirrorField,
  type NamedRow,
  type NumberingPreview,
  type SeriesFact,
  type VtIssue,
} from './voucher-types.rules';

type Client = Prisma.TransactionClient | PrismaService;

/** sales.offer_base_bill_type (COMPANY, BOOL, default false) — decision 33. */
export const OFFER_BASE_SETTING_KEY = 'sales.offer_base_bill_type';
const SAVE_LOCK_NAMESPACE = 'accounts.acc_voucher_types.save';
/** N1: a child's system code is unique across companies; one code pick per base at a time. */
const CODE_LOCK_NAMESPACE = 'accounts.acc_voucher_types.code';
/** S1: Alt+C print-design codes are unique across companies; one clone per code at a time. */
const PURPOSE_CODE_LOCK_NAMESPACE = 'public.print_purpose.clone_code';

/** One draft, judged: the row it would write, its base, and every refusal / warning. */
interface Judged {
  existing: AccVoucherType | null;
  base: AccVoucherType | null;
  isBase: boolean;
  /** The row's columns after the save (undefined fields = keep / base default). */
  target: TargetRow;
  errors: VtIssue[];
  warnings: VtIssue[];
  preview: NumberingPreview;
  offerBase: boolean | undefined;
  /** Sales Bill or one of its children: the type carries a delivery mode (Q3). */
  deliveryApplies: boolean;
}

interface TargetRow {
  vchrTypeName: string;
  vchrTypeShort: string;
  vchrParentId: number | null;
  vchrSortOrder: number;
  vchrIsActive: boolean;
  vchrNumberingMode: VoucherNumberingMode;
  vchrNoPrefix: string | null;
  vchrNoSuffix: string | null;
  vchrNoWidth: number;
  vchrResetFreq: VoucherResetFreq;
  vchrStartNo: number;
  vchrPrintTitle: string | null;
  vchrPrintPurposeId: string | null;
  vchrPrintAfterPost: boolean;
  vchrTallyVoucherTypeName: string | null;
  /** Delivery tracking (Q3): null on a child = the base's. */
  vchrDeliveryMode: string | null;
}

const iso = (d: Date): string => d.toISOString().slice(0, 10);

/** `YYYY-YYYY` for an IST calendar date, on the April–March year. */
function accYearOfIso(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const y = d.getUTCMonth() + 1 >= 4 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${y}-${y + 1}`;
}

function istToday(): string {
  return iso(new Date(Date.now() + 330 * 60_000));
}

const pickBool = (v: string | null | undefined, fallback: boolean): boolean => {
  const t = (v ?? '').trim().toLowerCase();
  if (t === 'true' || t === '1' || t === 'yes') return true;
  if (t === 'false' || t === '0' || t === 'no') return false;
  return fallback;
};

/**
 * Voucher Types master, menu 303 under Settings › Configuration (plan
 * Shared/Prathap/accounts/plan-voucher-types-2026-11-14.md §7). Not the Voucher
 * Register's accountsModule/vouchers/voucher-types.service.ts.
 *
 * A BASE type is shared by every company and keeps its name, code, accounting and
 * Active (Q17, OP-2); its numbering, print and sort may change. A CHILD type (Q1:
 * under Sales Bill) belongs to one company and carries a server-written mirror of
 * its base's accounting (decision 31) and a server-made code (decision 32).
 * Written online only (Q16, decision 41).
 */
@Injectable()
export class VoucherTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContextService,
    private readonly auditLogService: AuditLogService,
    private readonly config: ConfigService,
  ) {}

  private actor(): string {
    return this.ctx.getUserId() ?? DEFAULT_ACTOR;
  }

  private assertRight(client: Client, right: MenuRight, action: string): Promise<unknown> {
    return assertMenuRight(client, {
      userId: this.ctx.getUserId() ?? null,
      menuId: VOUCHER_TYPES_MENU_ID,
      right,
      codePrefix: VOUCHER_TYPE_RIGHT_PREFIX,
      action,
    });
  }

  /** Q16 / decision 41: CLOUD_SYNC_ENABLED marks an offline site; types are made on the main server. */
  private assertOnline(): void {
    if (isOfflineSite(this.config)) {
      throwForbidden<ModuleErrorDetail>('Voucher types are changed only on the main server', [
        {
          field: 'request',
          code: VoucherTypeErrorCode.OFFLINE,
          message:
            'This install is an offline site (CLOUD_SYNC_ENABLED); voucher types are made and changed on the main server.',
        },
      ]);
    }
  }

  /**
   * The body's company. A user bound to a company may name only that one; a user
   * bound to none (VKPOS) may name any live company — as the Vehicle Master.
   */
  private resolveCompany(client: Client, bodyCompanyId: string): Promise<string> {
    // The rule is shared with /reports/day-summary/voucher-types (review N8).
    return resolveVoucherTypeCompany(client, this.ctx.getCompanyId(), bodyCompanyId);
  }

  private companyMismatch(message: string): never {
    voucherTypeCompanyMismatch(message);
  }

  private notFound(vchrTypeId: number): never {
    throwNotFound<ModuleErrorDetail>(
      'Voucher type not found',
      'vchrTypeId',
      `No voucher type ${vchrTypeId}`,
      VoucherTypeErrorCode.NOT_FOUND,
    );
  }

  /** The row, or 404; a child of another company is 403 VT_COMPANY_MISMATCH. */
  private async loadForCompany(
    client: Client,
    vchrTypeId: number,
    company: string,
    forUpdate = false,
  ): Promise<AccVoucherType> {
    if (forUpdate) {
      await client.$queryRaw`
        SELECT vchr_type_id FROM accounts.acc_voucher_types WHERE vchr_type_id = ${vchrTypeId}::int FOR UPDATE`;
    }
    const row = await client.accVoucherType.findUnique({ where: { vchrTypeId } });
    if (!row) {
      this.notFound(vchrTypeId);
    }
    if (row.vchrCompanyId && row.vchrCompanyId.toLowerCase() !== company) {
      this.companyMismatch(`Voucher type ${vchrTypeId} belongs to company ${row.vchrCompanyId}`);
    }
    return row;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  GET /voucher-types/tree
  // ═══════════════════════════════════════════════════════════════════════

  async tree(companyId: string, includeInactive = false): Promise<{ nodes: VoucherTypeNode[] }> {
    await this.assertRight(this.prisma, 'view', 'open voucher types');
    const company = await this.resolveCompany(this.prisma, companyId);
    const rows = await this.prisma.accVoucherType.findMany({
      where: {
        OR: [{ vchrCompanyId: null }, { vchrCompanyId: company }],
        ...(includeInactive ? {} : { vchrIsActive: true }),
      },
      orderBy: [{ vchrSortOrder: 'asc' }, { vchrTypeId: 'asc' }],
    });
    const childCount = new Map<number, number>();
    for (const r of rows) {
      if (r.vchrParentId != null) {
        childCount.set(r.vchrParentId, (childCount.get(r.vchrParentId) ?? 0) + 1);
      }
    }
    // Bases in their order, each followed by its children.
    const bases = rows.filter((r) => r.vchrParentId == null);
    const ordered: AccVoucherType[] = [];
    for (const b of bases) {
      ordered.push(b, ...rows.filter((r) => r.vchrParentId === b.vchrTypeId));
    }
    // A child whose base is inactive and hidden still shows (its base filtered out).
    ordered.push(
      ...rows.filter(
        (r) => r.vchrParentId != null && !bases.some((b) => b.vchrTypeId === r.vchrParentId),
      ),
    );
    return {
      nodes: ordered.map((r) => ({
        vchrTypeId: r.vchrTypeId,
        vchrTypeCode: r.vchrTypeCode,
        vchrTypeName: r.vchrTypeName,
        vchrTypeShort: r.vchrTypeShort,
        vchrParentId: r.vchrParentId,
        vchrCompanyId: r.vchrCompanyId,
        vchrNature: r.vchrNature,
        // added 11-15 round 2: the tree search matches a prefix too (as written, tokens raw).
        vchrNoPrefix: r.vchrNoPrefix,
        vchrNoSuffix: r.vchrNoSuffix,
        kind: kindOf(r),
        numberedBy: numberedByOf(r),
        vchrIsActive: r.vchrIsActive,
        vchrSortOrder: r.vchrSortOrder,
        childCount: childCount.get(r.vchrTypeId) ?? 0,
        canHaveChildren: canHaveChildren(r),
      })),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  GET /voucher-types/get
  // ═══════════════════════════════════════════════════════════════════════

  async get(q: {
    companyId: string;
    branchId: string;
    accYear: string;
    vchrTypeId: number;
  }): Promise<VoucherTypePayload> {
    await this.assertRight(this.prisma, 'view', 'open voucher types');
    const company = await this.resolveCompany(this.prisma, q.companyId);
    const row = await this.loadForCompany(this.prisma, q.vchrTypeId, company);
    return this.payload(this.prisma, row, company, q.branchId, q.accYear);
  }

  private async payload(
    client: Client,
    row: AccVoucherType,
    company: string,
    branchId: string | null | undefined,
    accYearIn: string | null | undefined,
  ): Promise<VoucherTypePayload> {
    const base =
      row.vchrParentId == null
        ? row
        : await client.accVoucherType.findUnique({ where: { vchrTypeId: row.vchrParentId } });
    const accYear = accYearIn?.trim() || accYearOfIso(istToday());
    const branch = await this.previewBranch(client, company, branchId ?? null);
    const [billCount, inUse, counters, printDocType, offerBase, facts, vouchers, branches] =
      await Promise.all([
        this.billCount(client, row.vchrTypeId, company),
        this.inUse(client, row.vchrTypeId),
        this.counters(client, row.vchrTypeId, company, accYear, isDeviceWideSeries(row)),
        this.printDocType(client, base ?? row),
        (base ?? row).vchrTypeCode === SALES_BILL_TYPE_CODE && row.vchrParentId == null
          ? this.readOfferBase(client, company)
          : Promise.resolve(null),
        this.numberingFacts(client, row, company, accYear, branch),
        this.voucherFacts(client, row.vchrTypeId, company, branch?.branchId ?? null, accYear),
        this.branchStates(client, row.vchrTypeId, company, accYear, isDeviceWideSeries(row)),
      ]);
    const printDesigns = printDocType
      ? await this.printDesigns(client, printDocType, company, row.vchrParentId == null)
      : [];
    const verdict = checkNumbering(
      {
        mode: row.vchrNumberingMode,
        prefix: row.vchrNoPrefix,
        suffix: row.vchrNoSuffix,
        width: row.vchrNoWidth,
        startNo: row.vchrStartNo,
      },
      facts,
    );
    const inherited = this.inheritedOf(base ?? row);
    const deliveryApplies = hasDeliveryMode(row, base);
    const inheritedDeliveryMode = deliveryApplies ? ((base ?? row).vchrDeliveryMode ?? null) : null;
    return {
      type: row,
      inherited,
      deliveryModeApplies: deliveryApplies,
      inheritedDeliveryMode,
      effectiveDeliveryMode: effectiveDeliveryMode(
        row.vchrDeliveryMode,
        inheritedDeliveryMode,
        deliveryApplies,
      ),
      kind: kindOf(row),
      numberedBy: numberedByOf(row),
      isBase: isBaseType(row),
      isGstOutward: isGstOutward(row),
      canHaveChildren: canHaveChildren(row),
      allowedMethods: [...ALLOWED_METHODS],
      offerBase,
      billCount,
      inUse,
      counters,
      // added 11-15 round 2 (B2 "numbered by its screen" rows, and every other):
      voucherCount: vouchers.voucherCount,
      lastVoucherRefno: vouchers.lastVoucherRefno,
      lastVoucherDate: vouchers.lastVoucherDate,
      branches,
      printDocType,
      printDesigns,
      preview:
        numberedByOf(row) === 'SCREEN'
          ? { ...verdict.preview, sample: null, length: null, clashWith: null }
          : verdict.preview,
    };
  }

  private inheritedOf(base: AccVoucherType): VoucherTypePayload['inherited'] {
    const out: Record<string, unknown> = {
      vchrTypeId: base.vchrTypeId,
      vchrTypeCode: base.vchrTypeCode,
      vchrTypeName: base.vchrTypeName,
    };
    for (const k of MIRROR_FIELDS) {
      out[k] = base[k];
    }
    return out as VoucherTypePayload['inherited'];
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  POST /voucher-types/validate and /save
  // ═══════════════════════════════════════════════════════════════════════

  async validate(dto: SaveVoucherTypeDto): Promise<VoucherTypeValidation> {
    await this.assertRight(this.prisma, 'view', 'open voucher types');
    const company = await this.resolveCompany(this.prisma, dto.companyId);
    const existing =
      dto.vchrTypeId !== undefined
        ? await this.loadForCompany(this.prisma, dto.vchrTypeId, company)
        : null;
    const judged = await this.judge(this.prisma, dto, existing, company);
    const inheritedDeliveryMode = judged.deliveryApplies
      ? ((judged.isBase ? judged.target.vchrDeliveryMode : judged.base?.vchrDeliveryMode) ?? null)
      : null;
    return {
      ok: judged.errors.length === 0,
      // A success body's `errors` is not worded by the interceptor (it words
      // warnings / refusals): word them here, as an error body would be.
      errors: wordIssues(judged.errors),
      warnings: judged.warnings,
      preview: judged.preview,
      vchrDeliveryMode: judged.target.vchrDeliveryMode,
      deliveryModeApplies: judged.deliveryApplies,
      inheritedDeliveryMode,
      effectiveDeliveryMode: effectiveDeliveryMode(
        judged.target.vchrDeliveryMode,
        inheritedDeliveryMode,
        judged.deliveryApplies,
      ),
    };
  }

  async save(dto: SaveVoucherTypeDto): Promise<VoucherTypePayload & { warnings: VtIssue[] }> {
    const isCreate = dto.vchrTypeId === undefined;
    this.assertOnline();
    let company = '';
    const { id, warnings } = await this.prisma.$transaction(
      async (tx) => {
        await this.assertRight(
          tx,
          isCreate ? 'create' : 'edit',
          isCreate ? 'make voucher types' : 'change voucher types',
        );
        company = await this.resolveCompany(tx, dto.companyId);
        // One save per company at a time: name / abbreviation / code / prefix
        // checks read, then write.
        await tx.$queryRaw`
          SELECT count(pg_advisory_xact_lock(hashtext(${SAVE_LOCK_NAMESPACE}), hashtext(${company})))::int AS locked`;
        const existing = isCreate
          ? null
          : await this.loadForCompany(tx, dto.vchrTypeId!, company, true);
        const judged = await this.judge(tx, dto, existing, company);
        if (judged.errors.length > 0) {
          throwUnprocessable<ModuleErrorDetail>('Voucher type not saved', judged.errors);
        }
        const saved = await this.write(tx, judged, company);
        let offerBaseBefore: boolean | null = null;
        if (
          judged.offerBase !== undefined &&
          judged.isBase &&
          saved.vchrTypeCode === SALES_BILL_TYPE_CODE
        ) {
          offerBaseBefore = await this.readOfferBase(tx, company);
          await this.writeOfferBase(tx, company, judged.offerBase);
        }
        await this.auditLogService.logEntityChange(
          {
            action: isCreate ? 'New' : 'update',
            tableName: VOUCHER_TYPES_TABLE_NAME,
            screenName: VOUCHER_TYPES_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: String(saved.vchrTypeId),
            displayName: saved.vchrTypeName,
            originalRecord: judged.existing,
            modifiedRecord: saved,
            userId: this.actor(),
            notes: isCreate
              ? `Voucher type ${saved.vchrTypeCode} created`
              : `Voucher type ${saved.vchrTypeCode} updated` +
                (offerBaseBefore !== null && offerBaseBefore !== judged.offerBase
                  ? `; offer Sales Bill itself ${offerBaseBefore} → ${judged.offerBase} for company ${company}`
                  : ''),
          },
          tx,
        );
        return { id: saved.vchrTypeId, warnings: judged.warnings };
      },
      { timeout: 30000, maxWait: 10000 },
    );
    const row = await this.loadForCompany(this.prisma, id, company);
    const data = await this.payload(this.prisma, row, company, dto.branchId, dto.accYear);
    return { ...data, warnings };
  }

  /** Every rule of §7.2 on a draft, collected (validate lists them all; save refuses with them all). */
  private async judge(
    client: Client,
    dto: SaveVoucherTypeDto,
    existing: AccVoucherType | null,
    company: string,
  ): Promise<Judged> {
    const errors: VtIssue[] = [];
    const warnings: VtIssue[] = [];
    const accYear = dto.accYear?.trim() || accYearOfIso(istToday());
    const isCreate = existing === null;
    const isBase = existing !== null && existing.vchrParentId == null;

    // ── 2 · the parent ──
    let base: AccVoucherType | null = null;
    if (isBase) {
      base = existing;
      if (dto.vchrParentId !== undefined && dto.vchrParentId !== null) {
        errors.push(
          issue(
            VoucherTypeErrorCode.BASE_FIELD_LOCKED,
            'vchrParentId',
            'A base type has no parent.',
          ),
        );
      }
    } else {
      const parentId =
        dto.vchrParentId !== undefined ? dto.vchrParentId : (existing?.vchrParentId ?? null);
      const parentChanged = existing !== null && parentId !== existing.vchrParentId;
      if (parentChanged && (await this.billCount(client, existing.vchrTypeId, null)) > 0) {
        errors.push(
          issue(
            VoucherTypeErrorCode.PARENT_LOCKED,
            'vchrParentId',
            `Voucher type ${existing.vchrTypeId} has bills; its parent stays.`,
          ),
        );
      }
      const parent =
        parentId == null
          ? null
          : await client.accVoucherType.findUnique({ where: { vchrTypeId: parentId } });
      if (!parent || !canHaveChildren(parent)) {
        errors.push(
          issue(
            VoucherTypeErrorCode.PARENT_NOT_ALLOWED,
            'vchrParentId',
            parentId == null
              ? 'A new voucher type is a child: name its base (Sales Bill).'
              : `Voucher type ${parentId} cannot have children: only Sales Bill can, and a child cannot.`,
          ),
        );
      }
      // A refused parent: the rules below still run against the stored base.
      base =
        parent && canHaveChildren(parent)
          ? parent
          : existing?.vchrParentId != null
            ? await client.accVoucherType.findUnique({
                where: { vchrTypeId: existing.vchrParentId },
              })
            : null;
    }

    // The row after the save: the stored row (an edit) or the base (a new child),
    // overlaid with what the body sends. `!== undefined`: every declared DTO
    // field is an own property (ES2022), so `?? stored` would not do.
    const from = existing ?? base;
    const pick = <T>(_field: keyof TargetRow, dtoValue: T | undefined, fallback: T): T =>
      dtoValue !== undefined ? dtoValue : fallback;
    const target: TargetRow = {
      vchrTypeName: pick('vchrTypeName', dto.vchrTypeName?.trim(), existing?.vchrTypeName ?? ''),
      vchrTypeShort: pick(
        'vchrTypeShort',
        dto.vchrTypeShort?.trim(),
        existing?.vchrTypeShort ?? '',
      ),
      vchrParentId: isBase
        ? null
        : dto.vchrParentId !== undefined
          ? dto.vchrParentId
          : (existing?.vchrParentId ?? null),
      vchrSortOrder: pick(
        'vchrSortOrder',
        dto.vchrSortOrder,
        existing?.vchrSortOrder ?? (base ? base.vchrSortOrder + 1 : 0),
      ),
      vchrIsActive: pick('vchrIsActive', dto.vchrIsActive, existing?.vchrIsActive ?? true),
      vchrNumberingMode: pick(
        'vchrNumberingMode',
        dto.vchrNumberingMode,
        from?.vchrNumberingMode ?? VoucherNumberingMode.AUTO,
      ),
      // A new child starts with an empty prefix (§8.1): it never inherits the base's series.
      vchrNoPrefix: pick('vchrNoPrefix', dto.vchrNoPrefix, existing ? existing.vchrNoPrefix : null),
      vchrNoSuffix: pick('vchrNoSuffix', dto.vchrNoSuffix, existing ? existing.vchrNoSuffix : null),
      vchrNoWidth: pick('vchrNoWidth', dto.vchrNoWidth, from?.vchrNoWidth ?? 5),
      vchrResetFreq: pick(
        'vchrResetFreq',
        dto.vchrResetFreq,
        from?.vchrResetFreq ?? VoucherResetFreq.YEARLY,
      ),
      vchrStartNo: pick('vchrStartNo', dto.vchrStartNo, existing?.vchrStartNo ?? 1),
      vchrPrintTitle: pick(
        'vchrPrintTitle',
        dto.vchrPrintTitle,
        existing ? existing.vchrPrintTitle : null,
      ),
      vchrPrintPurposeId: pick(
        'vchrPrintPurposeId',
        dto.vchrPrintPurposeId,
        existing ? existing.vchrPrintPurposeId : null,
      ),
      vchrPrintAfterPost: pick(
        'vchrPrintAfterPost',
        dto.vchrPrintAfterPost,
        from?.vchrPrintAfterPost ?? false,
      ),
      vchrTallyVoucherTypeName: pick(
        'vchrTallyVoucherTypeName',
        dto.vchrTallyVoucherTypeName,
        existing ? existing.vchrTallyVoucherTypeName : null,
      ),
      // A new child starts with null: the base's mode until one is chosen (§7.5 item 2).
      vchrDeliveryMode: pick(
        'vchrDeliveryMode',
        dto.vchrDeliveryMode,
        existing ? existing.vchrDeliveryMode : null,
      ),
    };
    if (!isBase && target.vchrTallyVoucherTypeName === null) {
      // Q9: a child's Tally name defaults to its name.
      target.vchrTallyVoucherTypeName = target.vchrTypeName || null;
    }

    // ── 2 / 3 · identity ──
    if (isBase) {
      errors.push(
        ...lockedFieldChanges(
          existing,
          {
            vchrTypeName: dto.vchrTypeName,
            vchrTypeShort: dto.vchrTypeShort,
            vchrIsActive: dto.vchrIsActive,
            vchrTallyVoucherTypeName: dto.vchrTallyVoucherTypeName,
          },
          BASE_LOCKED_FIELDS.filter((f) => f !== 'vchrParentId'),
          'of a base type is set by the app.',
        ),
      );
    } else {
      errors.push(
        ...checkChildIdentity(
          { name: target.vchrTypeName, abbr: target.vchrTypeShort },
          await this.namedRows(client, company),
          existing?.vchrTypeId ?? null,
        ),
      );
    }

    // ── 4 · numbering ──
    const subject =
      existing ?? ({ ...base, vchrTypeId: 0, vchrParentId: target.vchrParentId } as AccVoucherType);
    const screenNumbered = existing !== null && numberedByOf(existing) === 'SCREEN';
    const gstOutward = !!base && isGstOutward(base);
    // Challan plan decision 32: a child is held to its base's GST document rule.
    const gstDocNo = !!base && isGstDocNo(base);
    const branch = await this.previewBranch(client, company, dto.branchId ?? null);
    const facts = await this.numberingFacts(
      client,
      {
        ...subject,
        vchrGstSide: base?.vchrGstSide ?? subject.vchrGstSide,
        vchrGstDocNo: base?.vchrGstDocNo ?? subject.vchrGstDocNo,
      },
      company,
      accYear,
      branch,
    );
    const verdict = checkNumbering(
      {
        mode: target.vchrNumberingMode,
        prefix: target.vchrNoPrefix,
        suffix: target.vchrNoSuffix,
        width: target.vchrNoWidth,
        startNo: target.vchrStartNo,
      },
      { ...facts, gstOutward, gstDocNo },
    );
    let preview = verdict.preview;
    if (screenNumbered) {
      errors.push(
        ...lockedFieldChanges(
          existing,
          {
            vchrNumberingMode: dto.vchrNumberingMode,
            vchrNoPrefix: dto.vchrNoPrefix,
            vchrNoSuffix: dto.vchrNoSuffix,
            vchrNoWidth: dto.vchrNoWidth,
            vchrResetFreq: dto.vchrResetFreq,
            vchrStartNo: dto.vchrStartNo,
          },
          NUMBERING_FIELDS,
          'is set by the document screen, per device (numbered by its screen).',
        ),
      );
      preview = { ...preview, sample: null, length: null, clashWith: null };
    } else {
      const numberingChanged =
        isCreate || NUMBERING_FIELDS.some((k) => !sameValue(target[k], existing[k]));
      if (numberingChanged) {
        errors.push(...verdict.errors);
      }
      warnings.push(...verdict.warnings);
      const formatChanged =
        existing !== null &&
        (['vchrNoPrefix', 'vchrNoSuffix', 'vchrNoWidth', 'vchrStartNo'] as const).some(
          (k) => !sameValue(target[k], existing[k]),
        );
      if (
        formatChanged &&
        (await this.hasCounterThisYear(
          client,
          existing.vchrTypeId,
          isBase ? null : company,
          accYear,
        ))
      ) {
        warnings.push(
          issue(
            VoucherTypeWarningCode.FORMAT_NEXT_COUNTER,
            'vchrNoPrefix',
            'The new numbering starts with the next counter: next year, or a branch that has not started yet.',
          ),
        );
      }
    }

    // ── 4b · delivery mode (delivery tracking §8.4 item 11) ──
    const deliveryApplies = hasDeliveryMode(
      existing ?? { vchrTypeCode: '', vchrParentId: target.vchrParentId ?? base?.vchrTypeId ?? null },
      isBase ? existing : base,
    );
    errors.push(
      ...checkDeliveryMode(dto.vchrDeliveryMode, target.vchrDeliveryMode, {
        applies: deliveryApplies,
        isBase,
      }),
    );

    // ── 5 · print design ──
    const purposeChanged = target.vchrPrintPurposeId !== (existing?.vchrPrintPurposeId ?? null);
    if (target.vchrPrintPurposeId && purposeChanged) {
      const docType = base ? await this.printDocType(client, base) : null;
      const ok = docType
        ? await this.purposeAllowed(client, target.vchrPrintPurposeId, docType, company, isBase)
        : false;
      if (!ok) {
        errors.push(
          issue(
            VoucherTypeErrorCode.PURPOSE_INVALID,
            'vchrPrintPurposeId',
            docType
              ? `Print design ${target.vchrPrintPurposeId} is not a live ${docType} design ${isBase ? 'shared by every company' : 'of this company or shared'}.`
              : 'This voucher type has no print design to pick.',
          ),
        );
      }
    }

    return {
      existing,
      base,
      isBase,
      target,
      errors,
      warnings,
      preview,
      offerBase: dto.offerBase ?? undefined,
      deliveryApplies,
    };
  }

  /** Insert / update the row (§7.2 item 6). Judged clean. */
  private async write(
    tx: Prisma.TransactionClient,
    j: Judged,
    company: string,
  ): Promise<AccVoucherType> {
    const t = j.target;
    const now = new Date();
    const numbering = {
      vchrNumberingMode: t.vchrNumberingMode,
      vchrNoPrefix: t.vchrNoPrefix,
      vchrNoSuffix: t.vchrNoSuffix,
      vchrNoWidth: t.vchrNoWidth,
      vchrResetFreq: t.vchrResetFreq,
      vchrStartNo: t.vchrStartNo,
    };
    const print = {
      vchrPrintTitle: t.vchrPrintTitle,
      vchrPrintPurposeId: t.vchrPrintPurposeId,
      vchrPrintAfterPost: t.vchrPrintAfterPost,
    };
    try {
      if (j.isBase) {
        // A base row is shared by every company: write only what really differs
        // ('' and null are the same here), and nothing at all for a no-op save
        // (e.g. one that only sets offerBase).
        const stored = j.existing!;
        const wanted: Record<string, unknown> = {
          ...(numberedByOf(stored) === 'SCREEN' ? {} : numbering),
          ...print,
          vchrSortOrder: t.vchrSortOrder,
          // Sales Bill (base) only: no other base type is ever sent one (NOT_ALLOWED).
          ...(j.deliveryApplies ? { vchrDeliveryMode: t.vchrDeliveryMode } : {}),
        };
        const changed = Object.fromEntries(
          Object.entries(wanted).filter(
            ([k, v]) => !sameValue(v, stored[k as keyof AccVoucherType]),
          ),
        ) as Prisma.AccVoucherTypeUpdateInput;
        if (Object.keys(changed).length === 0) {
          return stored;
        }
        return await tx.accVoucherType.update({
          where: { vchrTypeId: stored.vchrTypeId },
          data: { ...changed, vchrUpdatedOn: now, vchrUpdatedBy: this.actor() },
        });
      }
      const base = j.base!;
      const mirror = Object.fromEntries(MIRROR_FIELDS.map((k) => [k, base[k]])) as Pick<
        AccVoucherType,
        MirrorField
      >;
      const identity = {
        vchrTypeName: t.vchrTypeName,
        vchrTypeShort: t.vchrTypeShort,
        vchrSortOrder: t.vchrSortOrder,
        vchrIsActive: t.vchrIsActive,
        vchrTallyVoucherTypeName: t.vchrTallyVoucherTypeName,
        vchrDeliveryMode: j.deliveryApplies ? t.vchrDeliveryMode : null,
      };
      if (j.existing) {
        return await tx.accVoucherType.update({
          where: { vchrTypeId: j.existing.vchrTypeId },
          data: {
            ...identity,
            ...numbering,
            ...print,
            ...mirror,
            vchrParentId: base.vchrTypeId,
            vchrUpdatedOn: now,
            vchrUpdatedBy: this.actor(),
          },
        });
      }
      // N1: the system code is unique across EVERY company (uq_acc_voucher_types_code),
      // while the save lock above is per company. Two companies adding "RT" at once
      // would both pick Bil-RT; this lock makes the second wait and see the first's
      // row (READ COMMITTED reads afresh), so it takes Bil-RT-2.
      await tx.$queryRaw`
        SELECT count(pg_advisory_xact_lock(hashtext(${CODE_LOCK_NAMESPACE}), hashtext(${base.vchrTypeCode})))::int AS locked`;
      const taken = await tx.accVoucherType.findMany({
        where: { vchrTypeCode: { startsWith: `${base.vchrTypeCode}-`, mode: 'insensitive' } },
        select: { vchrTypeCode: true },
      });
      return await tx.accVoucherType.create({
        data: {
          vchrTypeCode: childTypeCode(
            base.vchrTypeCode,
            t.vchrTypeShort,
            new Set(taken.map((r) => r.vchrTypeCode)),
          ),
          ...identity,
          ...numbering,
          ...print,
          ...mirror,
          vchrParentId: base.vchrTypeId,
          vchrCompanyId: company,
          vchrCreatedBy: this.actor(),
        },
      });
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throwConflict<ModuleErrorDetail>('Voucher type not saved', [
          uniqueRaceIssue(violatedConstraintOf(error)),
        ]);
      }
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  POST /voucher-types/inactivate and /delete (C4, Q8)
  // ═══════════════════════════════════════════════════════════════════════

  async inactivate(dto: {
    companyId: string;
    vchrTypeId: number;
  }): Promise<{ vchrTypeId: number; vchrIsActive: false; name: string }> {
    this.assertOnline();
    return this.prisma.$transaction(async (tx) => {
      await this.assertRight(tx, 'edit', 'change voucher types');
      const company = await this.resolveCompany(tx, dto.companyId);
      const existing = await this.loadForCompany(tx, dto.vchrTypeId, company, true);
      if (existing.vchrParentId == null) {
        throwUnprocessable<ModuleErrorDetail>('A base type stays active', [
          issue(
            VoucherTypeErrorCode.BASE_FIELD_LOCKED,
            'vchrIsActive',
            'The Active of a base type is set by the app (OP-2).',
          ),
        ]);
      }
      const saved = await tx.accVoucherType.update({
        where: { vchrTypeId: existing.vchrTypeId },
        data: { vchrIsActive: false, vchrUpdatedOn: new Date(), vchrUpdatedBy: this.actor() },
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'update',
          tableName: VOUCHER_TYPES_TABLE_NAME,
          screenName: VOUCHER_TYPES_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: String(saved.vchrTypeId),
          displayName: saved.vchrTypeName,
          originalRecord: existing,
          modifiedRecord: saved,
          userId: this.actor(),
          notes: `Voucher type ${saved.vchrTypeCode} made inactive`,
        },
        tx,
      );
      return {
        vchrTypeId: saved.vchrTypeId,
        vchrIsActive: false as const,
        name: saved.vchrTypeName,
      };
    });
  }

  async remove(dto: {
    companyId: string;
    vchrTypeId: number;
  }): Promise<{ vchrTypeId: number; deleted: true; name: string }> {
    this.assertOnline();
    return this.prisma.$transaction(async (tx) => {
      await this.assertRight(tx, 'delete', 'delete voucher types');
      const company = await this.resolveCompany(tx, dto.companyId);
      const existing = await this.loadForCompany(tx, dto.vchrTypeId, company, true);
      if (existing.vchrParentId == null) {
        throwUnprocessable<ModuleErrorDetail>('A base type cannot be deleted', [
          issue(
            VoucherTypeErrorCode.BASE_FIELD_LOCKED,
            'vchrTypeId',
            'A base type is set by the app and cannot be deleted.',
          ),
        ]);
      }
      const inUse = () =>
        throwConflict<ModuleErrorDetail>('Voucher type in use', [
          issue(
            VoucherTypeErrorCode.IN_USE,
            'vchrTypeId',
            `${existing.vchrTypeName} has bills, a counter or vouchers; make it inactive instead.`,
            { params: { name: existing.vchrTypeName } },
          ),
        ]);
      if (await this.inUse(tx, existing.vchrTypeId)) {
        inUse();
      }
      try {
        await tx.accVoucherType.delete({ where: { vchrTypeId: existing.vchrTypeId } });
      } catch (error: unknown) {
        if (isForeignKeyConstraintError(error)) {
          inUse();
        }
        throw error;
      }
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: VOUCHER_TYPES_TABLE_NAME,
          screenName: VOUCHER_TYPES_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: String(existing.vchrTypeId),
          displayName: existing.vchrTypeName,
          originalRecord: existing,
          modifiedRecord: null,
          userId: this.actor(),
          notes: `Voucher type ${existing.vchrTypeCode} deleted (unused)`,
        },
        tx,
      );
      return {
        vchrTypeId: existing.vchrTypeId,
        deleted: true as const,
        name: existing.vchrTypeName,
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  POST /voucher-types/print-design-clone (Alt+C, decision 36)
  // ═══════════════════════════════════════════════════════════════════════

  async clonePrintDesign(dto: PrintDesignCloneDto): Promise<VoucherTypePrintDesign> {
    this.assertOnline();
    return this.prisma.$transaction(async (tx) => {
      await this.assertRight(tx, 'create', 'make print designs for voucher types');
      const company = await this.resolveCompany(tx, dto.companyId);
      const code = dto.ppoCode.trim().toUpperCase();
      const [source] = await tx.$queryRaw<
        {
          ppo_id: string;
          ppo_src_module: string;
          ppo_doc_type: string;
          ppo_copy_count: number;
          ppo_copy_labels: string | null;
          ppo_allow_reprint: boolean;
          ppo_sort_order: number;
          ppo_name: string;
        }[]
      >`
        SELECT ppo_id, ppo_src_module, ppo_doc_type, ppo_copy_count, ppo_copy_labels, ppo_allow_reprint,
               ppo_sort_order, ppo_name
          FROM public.print_purpose
         WHERE lower(ppo_code) = lower(${dto.fromPpoCode.trim()})
           AND ppo_is_deleted = false AND ppo_is_active = true
           AND (ppo_company_id IS NULL OR ppo_company_id = ${company}::uuid)
         ORDER BY ppo_company_id NULLS LAST
         LIMIT 1`;
      if (!source) {
        throwUnprocessable<ModuleErrorDetail>('Print design not found', [
          issue(
            VoucherTypeErrorCode.PURPOSE_INVALID,
            'fromPpoCode',
            `No live print design ${dto.fromPpoCode} for this company.`,
          ),
        ]);
      }
      // S1 / decision 61: an Alt+C code is unique across EVERY company, shared
      // designs included — printing finds a design by its code, and ux_ppo_code
      // is unique per company only. The lock makes two companies cloning the same
      // code at once take turns, so the second one sees the first's row.
      await tx.$queryRaw`
        SELECT count(pg_advisory_xact_lock(hashtext(${PURPOSE_CODE_LOCK_NAMESPACE}), hashtext(lower(${code}))))::int AS locked`;
      const codeTaken = (): never =>
        throwConflict<ModuleErrorDetail>('Print design code taken', [
          issue(
            VoucherTypeErrorCode.PURPOSE_CODE_TAKEN,
            'ppoCode',
            `A print design ${code} already exists (shared, this company's or another company's); print design codes are unique across companies.`,
            {
              params: { code },
            },
          ),
        ]);
      const [taken] = await tx.$queryRaw<{ ppo_id: string }[]>`
        SELECT ppo_id FROM public.print_purpose
         WHERE lower(ppo_code) = lower(${code}) AND ppo_is_deleted = false
         LIMIT 1`;
      if (taken) {
        codeTaken();
      }
      const userId = this.ctx.getUserId();
      let created: Awaited<ReturnType<typeof tx.printPurpose.create>>;
      try {
        created = await tx.printPurpose.create({
          data: {
            ppoCompanyId: company,
            ppoCode: code,
            ppoName: dto.ppoName.trim(),
            ppoSrcModule: source.ppo_src_module,
            ppoDocType: source.ppo_doc_type,
            ppoCopyCount: source.ppo_copy_count,
            ppoCopyLabels: source.ppo_copy_labels,
            ppoAllowReprint: source.ppo_allow_reprint,
            ppoSortOrder: Math.min(source.ppo_sort_order + 1, 32767),
            ppoNotes: `Cloned from ${dto.fromPpoCode.trim().toUpperCase()} (${source.ppo_name}) in Voucher Types; no layout until one is made in Print Templates.`,
            ppoCreatedBy: userId && isUuid(userId) ? userId : null,
          },
        });
      } catch (error: unknown) {
        // ux_ppo_code: a design of this company written past the lock (another path).
        if (isUniqueConstraintError(error)) {
          codeTaken();
        }
        throw error;
      }
      return {
        ppoId: created.ppoId,
        ppoCode: created.ppoCode,
        ppoName: created.ppoName,
        ppoCopyCount: created.ppoCopyCount,
        ppoCopyLabels: created.ppoCopyLabels,
        isShared: false,
        hasLayout: false,
        hasAssignment: false,
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  facts
  // ═══════════════════════════════════════════════════════════════════════

  /** The branch the preview is for: the one named (of this company), else the default, else the first. */
  private async previewBranch(
    client: Client,
    company: string,
    branchId: string | null,
  ): Promise<BranchFact | null> {
    const rows = await this.branchRows(client, company, true);
    const named = branchId?.toLowerCase() ?? null;
    return (
      rows.find((b) => b.branchId === named) ?? rows.find((b) => b.isDefault) ?? rows[0] ?? null
    );
  }

  /** The live (and, unless asked, active) branches of a company, or of every live company (null). */
  private async branchRows(
    client: Client,
    company: string | null,
    includeInactive = false,
  ): Promise<Array<BranchFact & { isDefault: boolean }>> {
    const rows = await client.$queryRaw<
      {
        br_id: string;
        br_name: string;
        br_comp_id: string;
        br_is_default: boolean;
        code: string | null;
        gstin: string | null;
      }[]
    >`
      SELECT b.br_id, b.br_name, b.br_comp_id, b.br_is_default,
             upper(COALESCE(NULLIF(btrim(b.br_bill_prefix), ''), NULLIF(btrim(b.br_code), ''))) AS code,
             upper(COALESCE(NULLIF(btrim(b.br_gstin_no), ''), NULLIF(btrim(c.comp_gstin_no), ''))) AS gstin
        FROM public.branch_master b
        JOIN public.companys c ON c.comp_id = b.br_comp_id AND coalesce(c.comp_is_deleted, false) = false
       WHERE b.br_is_deleted = false
         AND (${includeInactive} OR b.br_is_active = true)
         AND (${company}::uuid IS NULL OR b.br_comp_id = ${company}::uuid)
       ORDER BY b.br_is_default DESC, b.br_name`;
    return rows.map((r) => ({
      branchId: r.br_id,
      branchName: r.br_name,
      companyId: r.br_comp_id,
      isDefault: r.br_is_default,
      numberCode: r.code,
      gstin: r.gstin,
    }));
  }

  /**
   * What the numbering rules read: the active branches the type numbers at (a
   * child: its company's; a base: every company's), and the other counter-numbered
   * series (a child: the bases + the company's children; a base: every row).
   */
  private async numberingFacts(
    client: Client,
    subject: AccVoucherType,
    company: string,
    accYear: string,
    previewBranch: BranchFact | null,
  ) {
    const scopeCompany = subject.vchrParentId == null && subject.vchrTypeId !== 0 ? null : company;
    const [branches, seriesRows, deviceCode] = await Promise.all([
      this.branchRows(client, scopeCompany),
      client.accVoucherType.findMany({
        where: scopeCompany
          ? { OR: [{ vchrCompanyId: null }, { vchrCompanyId: scopeCompany }] }
          : {},
        select: {
          vchrTypeId: true,
          vchrTypeCode: true,
          vchrTypeName: true,
          vchrParentId: true,
          vchrNoPrefix: true,
          vchrNoSuffix: true,
        },
      }),
      // What {DV} is judged with (challan plan decision 32): the company's longest
      // live device code; a base, like its branches, every company's.
      longestLiveDeviceCode(client, scopeCompany),
    ]);
    const series: SeriesFact[] = seriesRows
      .filter((r) => numberedByOf(r) === 'COUNTER')
      .map((r) => ({
        vchrTypeId: r.vchrTypeId,
        vchrTypeName: r.vchrTypeName,
        prefix: r.vchrNoPrefix,
        suffix: r.vchrNoSuffix,
      }));
    return {
      vchrTypeId: subject.vchrTypeId === 0 ? null : subject.vchrTypeId,
      accYear,
      gstOutward: isGstOutward(subject),
      gstDocNo: isGstDocNo(subject),
      deviceCode,
      branches,
      previewBranch,
      series,
    };
  }

  /** The bases and this company's children: the names / abbreviations a child must not repeat. */
  private async namedRows(client: Client, company: string): Promise<NamedRow[]> {
    return client.accVoucherType.findMany({
      where: { OR: [{ vchrCompanyId: null }, { vchrCompanyId: company }] },
      select: { vchrTypeId: true, vchrTypeName: true, vchrTypeShort: true },
    });
  }

  private async billCount(
    client: Client,
    vchrTypeId: number,
    company: string | null,
  ): Promise<number> {
    const [r] = await client.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM sales.sale_bill
       WHERE sb_vchr_type_id = ${vchrTypeId}::int AND sb_is_deleted = false
         AND (${company}::uuid IS NULL OR sb_company_id = ${company}::uuid)`;
    return r?.n ?? 0;
  }

  /** Any bill (deleted drafts too: their FK holds), counter, voucher or bill-balance row (any company). */
  private async inUse(client: Client, vchrTypeId: number): Promise<boolean> {
    const [r] = await client.$queryRaw<{ used: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM sales.sale_bill WHERE sb_vchr_type_id = ${vchrTypeId}::int)
          OR EXISTS (SELECT 1 FROM accounts.acc_voucher_seq WHERE seq_vchr_type_id = ${vchrTypeId}::int)
          OR EXISTS (SELECT 1 FROM accounts.acc_voucher_header WHERE avh_voucher_type_id = ${vchrTypeId}::int)
          OR EXISTS (SELECT 1 FROM accounts.acc_bill_balance WHERE abl_voucher_type_id = ${vchrTypeId}::int)
          AS used`;
    return r?.used === true;
  }

  private async hasCounterThisYear(
    client: Client,
    vchrTypeId: number,
    company: string | null,
    accYear: string,
  ): Promise<boolean> {
    const [r] = await client.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM accounts.acc_voucher_seq
       WHERE seq_vchr_type_id = ${vchrTypeId}::int AND seq_acc_year = ${accYear}
         AND seq_is_deleted = false
         AND (${company}::uuid IS NULL OR seq_company_id = ${company}::uuid)`;
    return (r?.n ?? 0) > 0;
  }

  private async counters(
    client: Client,
    vchrTypeId: number,
    company: string,
    accYear: string,
    /** One series per PC (user 11-16): each device row serves every branch. */
    deviceWide = false,
  ): Promise<VoucherTypeCounter[]> {
    const rows = await client.$queryRaw<
      {
        branch_id: string;
        br_name: string;
        code: string | null;
        device_code: string;
        last_no: bigint;
        last_refno: string | null;
      }[]
    >`
      SELECT s.seq_branch_id AS branch_id, b.br_name,
             upper(COALESCE(NULLIF(btrim(b.br_bill_prefix), ''), NULLIF(btrim(b.br_code), ''))) AS code,
             s.seq_device_code AS device_code, s.seq_last_no AS last_no, s.seq_last_refno AS last_refno
        FROM accounts.acc_voucher_seq s
        JOIN public.branch_master b ON b.br_id = s.seq_branch_id
       WHERE s.seq_vchr_type_id = ${vchrTypeId}::int AND s.seq_company_id = ${company}::uuid
         AND s.seq_acc_year = ${accYear} AND s.seq_is_deleted = false
       ORDER BY b.br_name, s.seq_device_code`;
    return rows.map((r) => ({
      branchId: r.branch_id,
      branchName: r.br_name,
      branchCode: r.code,
      deviceCode: r.device_code,
      lastNo: r.last_no.toString(),
      lastRefno: r.last_refno,
      allBranches: deviceWide && r.device_code.trim().toUpperCase() !== 'MAIN',
    }));
  }

  /**
   * The type's accounts vouchers (accounts.acc_voucher_header), added 11-15 round 2:
   * the count in this company and year over every branch, and the number on the
   * latest one at the preview branch. POSTED and CANCELLED count; DRAFT and
   * deleted rows do not. For a "numbered by its screen" type the voucher carries
   * the document's own number (SRT/2026-2027/D9/00056, PUR/…); a type that posts
   * no voucher (PO, the SV-* numbering rows) answers 0 / null.
   */
  private async voucherFacts(
    client: Client,
    vchrTypeId: number,
    company: string,
    branchId: string | null,
    accYear: string,
  ): Promise<{
    voucherCount: number;
    lastVoucherRefno: string | null;
    lastVoucherDate: string | null;
  }> {
    const [[count], [last]] = await Promise.all([
      client.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM accounts.acc_voucher_header
         WHERE avh_company_id = ${company}::uuid AND avh_acc_year = ${accYear}::char(9)
           AND avh_voucher_type_id = ${vchrTypeId}::int
           AND avh_is_deleted = false AND avh_voucher_status <> 'DRAFT'`,
      branchId
        ? client.$queryRaw<{ refno: string | null; vdate: Date | null }[]>`
            SELECT avh_voucher_refno AS refno, avh_voucher_date AS vdate FROM accounts.acc_voucher_header
             WHERE avh_company_id = ${company}::uuid AND avh_branch_id = ${branchId}::uuid
               AND avh_acc_year = ${accYear}::char(9) AND avh_voucher_type_id = ${vchrTypeId}::int
               AND avh_is_deleted = false AND avh_voucher_status <> 'DRAFT'
             ORDER BY avh_voucher_slno DESC NULLS LAST, avh_created_on DESC
             LIMIT 1`
        : Promise.resolve([] as { refno: string | null; vdate: Date | null }[]),
    ]);
    return {
      voucherCount: typeof count?.n === 'number' ? count.n : 0,
      lastVoucherRefno: last?.refno ?? null,
      lastVoucherDate: last?.vdate instanceof Date ? iso(last.vdate) : null,
    };
  }

  /**
   * The company's active branches for the year asked (added 11-15 round 2): the
   * strip caption's "Head Office: not started" / "COIMBATORE (CBE)". `hasCounter`
   * = a live acc_voucher_seq row of this type at the branch this year (any
   * device); `lastVoucherRefno` = the number on its latest voucher of the type.
   */
  private async branchStates(
    client: Client,
    vchrTypeId: number,
    company: string,
    accYear: string,
    /** One series per PC: a device's counter at any branch counts for every branch. */
    deviceWide = false,
  ): Promise<VoucherTypeBranchState[]> {
    const rows = await client.$queryRaw<
      {
        br_id: string;
        br_name: string;
        br_is_default: boolean;
        code: string | null;
        has_counter: boolean;
        refno: string | null;
      }[]
    >`
      SELECT b.br_id, b.br_name, b.br_is_default,
             upper(COALESCE(NULLIF(btrim(b.br_bill_prefix), ''), NULLIF(btrim(b.br_code), ''))) AS code,
             EXISTS (SELECT 1 FROM accounts.acc_voucher_seq s
                      WHERE s.seq_vchr_type_id = ${vchrTypeId}::int AND s.seq_company_id = ${company}::uuid
                        AND (s.seq_branch_id = b.br_id
                             OR (${deviceWide} AND upper(btrim(s.seq_device_code)) <> 'MAIN'))
                        AND s.seq_acc_year = ${accYear}
                        AND s.seq_is_deleted = false) AS has_counter,
             lv.refno
        FROM public.branch_master b
        LEFT JOIN LATERAL (
          SELECT h.avh_voucher_refno AS refno FROM accounts.acc_voucher_header h
           WHERE h.avh_company_id = ${company}::uuid AND h.avh_branch_id = b.br_id
             AND h.avh_acc_year = ${accYear}::char(9) AND h.avh_voucher_type_id = ${vchrTypeId}::int
             AND h.avh_is_deleted = false AND h.avh_voucher_status <> 'DRAFT'
           ORDER BY h.avh_voucher_slno DESC NULLS LAST, h.avh_created_on DESC
           LIMIT 1) lv ON true
       WHERE b.br_comp_id = ${company}::uuid AND b.br_is_deleted = false AND b.br_is_active = true
       ORDER BY b.br_is_default DESC, b.br_name`;
    return rows.map((r) => ({
      branchId: r.br_id,
      branchName: r.br_name,
      branchCode: r.code,
      isDefault: r.br_is_default,
      hasCounter: r.has_counter === true,
      lastVoucherRefno: r.refno ?? null,
    }));
  }

  /** The ppo_doc_type of a base's designs (rules.printDocTypeOf). */
  private async printDocType(client: Client, base: AccVoucherType): Promise<string | null> {
    let own: string | null = null;
    if (base.vchrPrintPurposeId) {
      const p = await client.printPurpose.findUnique({
        where: { ppoId: base.vchrPrintPurposeId },
        select: { ppoDocType: true },
      });
      own = p?.ppoDocType ?? null;
    }
    return printDocTypeOf(base, own);
  }

  private async printDesigns(
    client: Client,
    docType: string,
    company: string,
    sharedOnly: boolean,
  ): Promise<VoucherTypePrintDesign[]> {
    const rows = await client.$queryRaw<
      {
        ppo_id: string;
        ppo_code: string;
        ppo_name: string;
        ppo_copy_count: number;
        ppo_copy_labels: string | null;
        is_shared: boolean;
        has_layout: boolean;
        has_assignment: boolean;
      }[]
    >`
      SELECT p.ppo_id, p.ppo_code, p.ppo_name, p.ppo_copy_count, p.ppo_copy_labels,
             p.ppo_company_id IS NULL AS is_shared,
             ${printDesignRuleSql(PRINT_DESIGN_LAYOUT_RULE, 'p', Prisma.sql`${company}::uuid`)} AS has_layout,
             ${printDesignRuleSql(PRINT_DESIGN_ASSIGNMENT_RULE, 'p', Prisma.sql`${company}::uuid`)} AS has_assignment
        FROM public.print_purpose p
       WHERE p.ppo_doc_type = ${docType} AND p.ppo_is_deleted = false AND p.ppo_is_active = true
         AND (p.ppo_company_id IS NULL OR (${sharedOnly} = false AND p.ppo_company_id = ${company}::uuid))
       ORDER BY p.ppo_sort_order, p.ppo_name`;
    return rows.map((r) => ({
      ppoId: r.ppo_id,
      ppoCode: r.ppo_code,
      ppoName: r.ppo_name,
      ppoCopyCount: r.ppo_copy_count,
      ppoCopyLabels: r.ppo_copy_labels,
      isShared: r.is_shared,
      // S2 / decision 62: (a) holds by the WHERE; usable = hasLayout && hasAssignment.
      hasLayout: r.has_layout === true,
      hasAssignment: r.has_assignment === true,
    }));
  }

  private async purposeAllowed(
    client: Client,
    ppoId: string,
    docType: string,
    company: string,
    sharedOnly: boolean,
  ): Promise<boolean> {
    const designs = await this.printDesigns(client, docType, company, sharedOnly);
    return designs.some((d) => d.ppoId === ppoId);
  }

  /** sales.offer_base_bill_type for the company: its COMPANY row, else GLOBAL, else the default. */
  private async readOfferBase(client: Client, company: string): Promise<boolean> {
    const [r] = await client.$queryRaw<{ v: string | null }[]>`
      SELECT COALESCE(
        (SELECT asv_value FROM public.app_setting_value
          WHERE asv_setting_key = ${OFFER_BASE_SETTING_KEY} AND asv_scope = 'COMPANY'
            AND asv_company_id = ${company}::uuid AND asv_is_deleted = false LIMIT 1),
        (SELECT asv_value FROM public.app_setting_value
          WHERE asv_setting_key = ${OFFER_BASE_SETTING_KEY} AND asv_scope = 'GLOBAL'
            AND asv_is_deleted = false LIMIT 1),
        (SELECT asd_default_value FROM public.app_setting_def WHERE asd_key = ${OFFER_BASE_SETTING_KEY})) AS v`;
    return pickBool(r?.v, false);
  }

  /** Decision 33: the company's COMPANY-scope value, written in the save's transaction. */
  private async writeOfferBase(
    tx: Prisma.TransactionClient,
    company: string,
    value: boolean,
  ): Promise<void> {
    const actor = this.actor().slice(0, 50);
    const text = value ? 'true' : 'false';
    const updated = await tx.$executeRaw`
      UPDATE public.app_setting_value
         SET asv_value = ${text}, asv_modified_on = now(), asv_modified_by = ${actor}, asv_sync_date = NULL
       WHERE asv_setting_key = ${OFFER_BASE_SETTING_KEY} AND asv_scope = 'COMPANY'
         AND asv_company_id = ${company}::uuid AND asv_branch_id IS NULL AND asv_device_id IS NULL
         AND asv_user_id IS NULL AND asv_is_deleted = false`;
    if (updated === 0) {
      await tx.$executeRaw`
        INSERT INTO public.app_setting_value (asv_setting_key, asv_scope, asv_company_id, asv_value, asv_remarks, asv_created_by)
        VALUES (${OFFER_BASE_SETTING_KEY}, 'COMPANY', ${company}::uuid, ${text}, 'Voucher Types (menu 303)', ${actor})`;
    }
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: string): boolean {
  return UUID.test(v);
}

/**
 * N1 — a unique index the pre-checks could not see coming (a race), mapped to
 * its own code: the abbreviation (ux_vchr_company_short), the name
 * (ux_vchr_company_name / ux_vchr_base_name), else the system code
 * (uq_acc_voucher_types_code, unique across every company). Prisma names the
 * index or its columns; when it names neither, it is the code — the name and
 * abbreviation are checked under the per-company save lock, the code is not
 * company-scoped. A code clash clears on a second save (the next free -2, -3).
 */
export function uniqueRaceIssue(hit: string | null): VtIssue {
  const what = hit ?? 'unknown index';
  if (hit && /short/i.test(hit)) {
    return issue(
      VoucherTypeErrorCode.ABBR_TAKEN,
      'vchrTypeShort',
      `Another voucher type took this abbreviation just now (${what}).`,
    );
  }
  if (hit && /name/i.test(hit)) {
    return issue(
      VoucherTypeErrorCode.NAME_TAKEN,
      'vchrTypeName',
      `Another voucher type took this name just now (${what}).`,
    );
  }
  return issue(
    VoucherTypeErrorCode.CODE_TAKEN,
    'vchrTypeShort',
    `Another company made a voucher type with the same system code just now (${what}). Save again: the next free code is taken then.`,
  );
}

/** The `user` words of each issue, as the exception filter adds them to an error body. */
function wordIssues(errors: VtIssue[]): VtIssue[] {
  return withUserWording({ errors }).errors;
}
