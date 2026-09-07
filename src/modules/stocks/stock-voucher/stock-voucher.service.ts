import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import {
  DEFAULT_ACTOR,
  resolveActor,
  throwStockConflict,
  throwStockNotFound,
  throwStockUnprocessable,
  toNullableNumber,
  toNumber,
} from 'src/common/utils/module-service.utils';
import { SaveStockVoucherDto } from './dto/save-stock-voucher.dto';
import { SaveStockVoucherItemDto } from './dto/save-stock-voucher-item.dto';
import {
  allocateStockVoucherNumber,
  type StockVoucherNumberScope,
} from './stock-voucher-numbering.helper';
import {
  type OpeningReconcileRow,
  type PagedResult,
  type PendingOpeningItem,
  type StockBucket,
  type StockErrorDetail,
  type StockErrorResponse,
  type StockRateSource,
  type StockVoucherCancelResult,
  type StockVoucherDeleteResult,
  type StockVoucherHeaderPayload,
  type StockVoucherLinePayload,
  type StockVoucherLineProblem,
  type StockVoucherListItem,
  type StockVoucherListResult,
  type StockVoucherPayload,
  type StockVoucherPostResult,
  type StockVoucherStatus,
  type StockVoucherTypeRules,
} from './types/stock-voucher.types';

const STOCK_VOUCHER_TABLE_NAME = 'stock_voucher';
const STOCK_VOUCHER_ITEM_TABLE_NAME = 'stock_voucher_item';

/** §10 — both reports can cover a 40,000-row item master, so they page. */
const DEFAULT_REPORT_LIMIT = 200;
const MAX_REPORT_LIMIT = 1000;
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 500;

/** The lot-identity sentinels of ux_slt_identity. Impossible values, not merely unlikely. */
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

interface ListStockVouchersQuery {
  companyId: string;
  branchId: string;
  accYear: string;
  status?: StockVoucherStatus;
  fromDate?: string;
  toDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/** What item_unit_conversion answers for one (item, uom) pair. */
interface UomConversion {
  iucId: string;
  itemId: string;
  toBaseFactor: number;
  baseIucId: string | null;
}

interface HeaderRow {
  svh_id: string;
  svh_acc_year: string;
  svh_company_id: string;
  svh_branch_id: string;
  svh_tenant_id: string | null;
  svh_device_id: string;
  svh_session_id: string | null;
  svh_voucher_type: string;
  svh_slno: bigint;
  svh_refno: string;
  svh_usr_refno: string | null;
  svh_doc_date: Date;
  svh_doc_datetime: Date;
  svh_from_godown_id: string | null;
  from_godown_name: string | null;
  svh_to_godown_id: string | null;
  to_godown_name: string | null;
  svh_supplier_id: string | null;
  svh_status: string;
  svh_line_count: number;
  svh_total_qty: Prisma.Decimal;
  svh_total_value: Prisma.Decimal;
  svh_total_value_wot: Prisma.Decimal;
  svh_posted_on: Date | null;
  svh_posted_by: string | null;
  posted_by_name: string | null;
  svh_cancelled_on: Date | null;
  svh_cancel_reason: string | null;
  svh_rate_source: string | null;
  svh_remarks: string | null;
  svh_is_deleted: boolean;
}

interface LineRow {
  svi_id: string;
  svi_line_no: number;
  svi_split_no: number;
  svi_item_id: string;
  item_code: string | null;
  item_name: string;
  unit_name: string | null;
  svi_uom_id: string;
  svi_base_uom_id: string;
  svi_to_base_factor: Prisma.Decimal;
  svi_godown_id: string;
  godown_name: string | null;
  svi_bucket: string;
  svi_batch_no: string | null;
  svi_mfg_date: Date | null;
  svi_expiry_date: Date | null;
  svi_mrp: Prisma.Decimal | null;
  svi_sale_price: Prisma.Decimal | null;
  svi_serial_no: string | null;
  svi_supplier_id: string | null;
  svi_qty: Prisma.Decimal;
  svi_base_qty: Prisma.Decimal;
  svi_free_qty: Prisma.Decimal;
  svi_free_base_qty: Prisma.Decimal;
  svi_cost_rate: Prisma.Decimal;
  svi_cost_rate_wot: Prisma.Decimal;
  svi_tax_perc: Prisma.Decimal;
  svi_value: Prisma.Decimal | null;
  svi_value_wot: Prisma.Decimal | null;
  svi_lot_id: string | null;
  svi_remarks: string | null;
}

/**
 * The type-agnostic half of every stock document screen.
 *
 * WHY THIS IS SHARED. stock.stock_voucher already serves OPENING, RECEIPT,
 * ISSUE, ADJUSTMENT, TRANSFER_OUT/IN, DAMAGE, EXPIRY_WRITEOFF, PHYSICAL and
 * REPACK_IN/OUT, and five more screens are planned against it. Written as one
 * OpeningStockService this gets copy-pasted five times, and the fifth copy
 * disagrees with the first about what a draft is. The service takes the
 * voucher type as a rule record from its CALLER; the controller pins it, so no
 * payload can ever change the type a document is saved under.
 *
 * WHAT THIS SERVICE DOES NOT DO. It writes exactly two tables — stock_voucher
 * and stock_voucher_item — and calls one function. The lot, the ledger row, the
 * balance and the moving average are written by stock.fn_svh_post() and by
 * triggers. Nothing here inserts into stock_ledger, touches stock_balance, or
 * computes a header total; see the write rules on the Prisma models.
 */
@Injectable()
export class StockVoucherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // §4 — save a draft
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Create when `header.svhId` is absent, update when present.
   *
   * UPDATE IS A FULL REPLACE OF THE LINES. Merging by line number over a grid
   * the user can insert into the middle of is exactly where line numbers drift
   * apart from the rows they name, and a DRAFT has no history worth preserving
   * — nothing downstream of it exists yet.
   */
  async save(rules: StockVoucherTypeRules, dto: SaveStockVoucherDto): Promise<StockVoucherPayload> {
    const { header } = dto;
    const actor = resolveActor(header.userId, this.requestContextService.getUserId());

    this.assertPayloadRules(rules, dto);
    const conversions = await this.resolveConversions(dto.lines);
    this.assertUnitsBelongToItems(dto.lines, conversions);

    const svhId = await this.prisma.$transaction(async (tx) => {
      return header.svhId
        ? await this.updateDraft(tx, rules, dto, actor)
        : await this.createDraft(tx, rules, dto, actor);
    });

    return this.getById(rules, svhId, header.accYear, header.companyId, header.branchId);
  }

  /**
   * Everything the engine would refuse, refused here first.
   *
   * fn_svh_post raises on the FIRST bad line and rolls the whole document back.
   * That is right for the database and useless as a screen message: a user
   * forty lines into an opening gets one error, fixes it, and is told about the
   * next one. So every rule that can be checked without touching the engine is
   * checked here, and reported as a 422 with a per-line list the grid can
   * highlight all at once.
   */
  private assertPayloadRules(rules: StockVoucherTypeRules, dto: SaveStockVoucherDto): void {
    const { header, lines } = dto;
    const errors: StockErrorDetail[] = [];

    if (rules.refuseTypes?.length) {
      // Belt and braces behind the controller's @IsIn: this service is exported
      // and the next five screens import it.
      for (const refused of rules.refuseTypes) {
        if (refused === rules.voucherType) {
          errors.push({
            field: 'voucherType',
            message: `${rules.voucherType} cannot be saved through this route.`,
          });
        }
      }
    }

    // ck_svh_godowns will NOT catch a missing to-godown on an OPENING: it is
    // satisfied by a from-godown alone, because an ISSUE has no to-godown at
    // all. The engine catches it much later, as a not_null_violation.
    if (rules.requiresToGodown && !header.toGodownId) {
      errors.push({
        field: 'toGodownId',
        message: `A ${rules.displayName} must name the godown the stock arrives in.`,
      });
    }
    if (rules.requiresFromGodown && !header.fromGodownId) {
      errors.push({
        field: 'fromGodownId',
        message: `A ${rules.displayName} must name the godown the stock leaves from.`,
      });
    }

    if (!lines.length) {
      // A draft with no lines is allowed to EXIST — a user opens the screen,
      // fills the header and walks away — but not to be created empty by an
      // importer that resolved nothing.
      errors.push({ field: 'lines', message: 'A document must have at least one line.' });
    }

    const seen = new Map<string, number>();
    lines.forEach((line, index) => {
      const field = `lines.${index}`;
      const splitNo = line.splitNo ?? 1;
      const key = `${line.lineNo}|${splitNo}`;
      const firstAt = seen.get(key);
      if (firstAt !== undefined) {
        // ux_svi_line would say this too, but from Postgres it names a
        // partition-local index and no line number.
        errors.push({
          field,
          message: `Line ${line.lineNo} split ${splitNo} is already used by row ${firstAt + 1}.`,
        });
      } else {
        seen.set(key, index);
      }

      const qty = this.toDecimalNumber(line.qty);
      const freeQty = this.toDecimalNumber(line.freeQty ?? 0);

      if (qty < 0 || freeQty < 0) {
        // ck_svi_qty_sign. Quantities are MAGNITUDES — direction comes from the
        // voucher type. A negative opening is an ADJUSTMENT, not an opening.
        errors.push({
          field,
          message: `Line ${line.lineNo}: quantities are magnitudes and cannot be negative. A negative opening is an ADJUSTMENT.`,
        });
      } else if (qty === 0 && freeQty === 0) {
        errors.push({
          field,
          message: `Line ${line.lineNo} has no quantity.`,
        });
      }

      if (splitNo > 1 && !line.batchNo?.trim()) {
        // ck_svi_batch_split — a split only means anything when the line is
        // split BY BATCH.
        errors.push({
          field,
          message: `Line ${line.lineNo} split ${splitNo} needs a batch number.`,
        });
      }

      if (line.mfgDate && line.expiryDate && line.expiryDate < line.mfgDate) {
        // ck_svi_expiry_order
        errors.push({
          field,
          message: `Line ${line.lineNo}: expiry ${line.expiryDate} is before manufacture ${line.mfgDate}.`,
        });
      }

      if (rules.isInward && this.toDecimalNumber(line.costRate ?? 0) === 0 && !header.rateSource) {
        errors.push({
          field,
          message: `Line ${line.lineNo} brings stock in at cost 0 and the document names no rate source. Set a cost rate, or a rateSource for the engine to derive one from.`,
        });
      }
    });

    if (errors.length) {
      throwStockUnprocessable<StockErrorDetail, StockErrorResponse>(
        `This ${rules.displayName.toLowerCase()} cannot be saved`,
        errors,
      );
    }
  }

  /**
   * svi_to_base_factor is READ, never trusted.
   *
   * A wrong factor in a payload does not produce a wrong line — it multiplies
   * the opening quantity of the entire branch, silently, in the base unit
   * everything downstream reports in.
   */
  private async resolveConversions(
    lines: readonly SaveStockVoucherItemDto[],
  ): Promise<Map<string, UomConversion>> {
    const uomIds = [...new Set(lines.map((line) => line.uomId))];
    if (!uomIds.length) {
      return new Map();
    }
    const rows = await this.prisma.itemUnitConversion.findMany({
      where: { iucId: { in: uomIds }, iucIsDeleted: false },
      select: {
        iucId: true,
        iucItemId: true,
        iucToBaseFactor: true,
        iucBaseUnitId: true,
        item: {
          select: {
            unitConversions: {
              where: { iucIsBaseUnit: true, iucIsDeleted: false },
              select: { iucId: true },
              take: 1,
            },
          },
        },
      },
    });
    const map = new Map<string, UomConversion>();
    for (const row of rows) {
      map.set(row.iucId, {
        iucId: row.iucId,
        itemId: row.iucItemId,
        toBaseFactor: toNumber(row.iucToBaseFactor),
        baseIucId: row.item?.unitConversions[0]?.iucId ?? null,
      });
    }
    return map;
  }

  /**
   * svi_uom_id and svi_base_uom_id are item_unit_conversion.iuc_id, NOT
   * item_unit_master.unit_id. The foreign key catches a unit_id — but only
   * after the user has typed forty lines, and with a message that names a
   * constraint rather than a row.
   */
  private assertUnitsBelongToItems(
    lines: readonly SaveStockVoucherItemDto[],
    conversions: ReadonlyMap<string, UomConversion>,
  ): void {
    const errors: StockErrorDetail[] = [];
    lines.forEach((line, index) => {
      const conversion = conversions.get(line.uomId);
      if (!conversion) {
        errors.push({
          field: `lines.${index}`,
          message: `Line ${line.lineNo}: no item_unit_conversion row ${line.uomId}. uomId is an iuc_id, not a unit_id.`,
        });
        return;
      }
      if (conversion.itemId !== line.itemId) {
        errors.push({
          field: `lines.${index}`,
          message: `Line ${line.lineNo}: the unit does not belong to this item.`,
        });
      }
      if (!conversion.baseIucId && !line.baseUomId) {
        errors.push({
          field: `lines.${index}`,
          message: `Line ${line.lineNo}: the item has no base unit in item_unit_conversion, so svi_base_uom_id cannot be resolved. Send baseUomId, or set a base unit on the item.`,
        });
      }
    });
    if (errors.length) {
      throwStockUnprocessable<StockErrorDetail, StockErrorResponse>('Unit resolution failed', errors);
    }
  }

  private async createDraft(
    tx: Prisma.TransactionClient,
    rules: StockVoucherTypeRules,
    dto: SaveStockVoucherDto,
    actor: string,
  ): Promise<string> {
    const { header } = dto;
    const scope: StockVoucherNumberScope = {
      companyId: header.companyId,
      branchId: header.branchId,
      accYear: header.accYear,
      voucherType: rules.voucherType,
      deviceId: header.deviceId,
    };
    const { slno, refno } = await allocateStockVoucherNumber(tx, scope, rules.typeCode, {
      slno: header.slno,
      refno: header.refno,
    });

    const created = await tx.stockVoucher.create({
      data: {
        // svh_line_count / svh_total_qty / svh_total_value / svh_total_value_wot
        // are ABSENT on purpose. tr_svi_refresh_header re-sums them on every
        // line write and fn_svh_recompute does it again at post. They are not
        // generated columns, so Prisma *can* write them — which is the danger.
        // The screen never sums its own grid either.
        svhCompanyId: header.companyId,
        svhBranchId: header.branchId,
        svhTenantId: header.tenantId ?? null,
        svhAccYear: header.accYear,
        svhDeviceId: header.deviceId,
        svhSessionId: header.sessionId ?? null,
        svhVoucherType: rules.voucherType,
        svhSlno: slno,
        svhRefno: refno,
        svhUsrRefno: header.usrRefno ?? null,
        svhDocDate: new Date(`${header.docDate}T00:00:00Z`),
        svhFromGodownId: header.fromGodownId ?? null,
        svhToGodownId: header.toGodownId ?? null,
        svhSupplierId: header.supplierId ?? null,
        svhRateSource: header.rateSource ?? null,
        svhRemarks: header.remarks ?? null,
        // Post is §7, not a status field. Nothing may create a POSTED document.
        svhStatus: 'DRAFT',
        svhCreatedBy: actor === DEFAULT_ACTOR ? null : actor,
      },
      select: { svhId: true, svhAccYear: true, svhRefno: true },
    });

    await this.replaceLines(tx, rules, dto, created.svhId, actor);

    await this.auditLogService.logEntityChange(
      {
        action: 'insert',
        tableName: STOCK_VOUCHER_TABLE_NAME,
        screenName: rules.auditScreenName,
        screenType: 'transaction',
        pk: created.svhId,
        displayName: created.svhRefno,
        originalRecord: null,
        modifiedRecord: { svhId: created.svhId, svhRefno: created.svhRefno, svhStatus: 'DRAFT' },
        userId: actor,
        notes: `${rules.displayName} draft created`,
      },
      tx,
    );

    return created.svhId;
  }

  private async updateDraft(
    tx: Prisma.TransactionClient,
    rules: StockVoucherTypeRules,
    dto: SaveStockVoucherDto,
    actor: string,
  ): Promise<string> {
    const { header } = dto;
    const svhId = header.svhId as string;
    const existing = await this.loadForWrite(tx, rules, svhId, header.accYear);

    // tr_svh_post_lock and tr_svi_post_lock refuse every edit once the status
    // leaves DRAFT, and tr_sml_immutable refuses every UPDATE and DELETE of the
    // ledger. Checking here is what turns a 500 from a trigger into a 409 that
    // says which status the document is actually in.
    this.assertDraft(rules, existing);

    await tx.stockVoucher.update({
      where: { svhId_svhAccYear: { svhId, svhAccYear: header.accYear } },
      data: {
        svhTenantId: header.tenantId ?? null,
        svhDeviceId: header.deviceId,
        svhSessionId: header.sessionId ?? null,
        svhUsrRefno: header.usrRefno ?? null,
        svhDocDate: new Date(`${header.docDate}T00:00:00Z`),
        svhFromGodownId: header.fromGodownId ?? null,
        svhToGodownId: header.toGodownId ?? null,
        svhSupplierId: header.supplierId ?? null,
        svhRateSource: header.rateSource ?? null,
        svhRemarks: header.remarks ?? null,
        svhVersionNo: { increment: 1 },
        svhModifiedOn: new Date(),
        svhModifiedBy: actor === DEFAULT_ACTOR ? null : actor,
      },
    });

    await this.replaceLines(tx, rules, dto, svhId, actor);

    await this.auditLogService.logEntityChange(
      {
        action: 'update',
        tableName: STOCK_VOUCHER_TABLE_NAME,
        screenName: rules.auditScreenName,
        screenType: 'transaction',
        pk: svhId,
        displayName: existing.svhRefno,
        originalRecord: { svhId, svhRefno: existing.svhRefno, svhStatus: existing.svhStatus },
        modifiedRecord: { svhId, svhRefno: existing.svhRefno, svhStatus: 'DRAFT' },
        userId: actor,
        notes: `${rules.displayName} draft updated`,
      },
      tx,
    );

    return svhId;
  }

  /**
   * Deletes and re-inserts the lines. See save() for why a replace rather than
   * a merge.
   *
   * A hard delete, not a soft one: these lines have never reached the ledger —
   * a DRAFT moves no stock — so there is nothing to preserve and everything to
   * gain from ux_svi_line staying clean.
   */
  private async replaceLines(
    tx: Prisma.TransactionClient,
    rules: StockVoucherTypeRules,
    dto: SaveStockVoucherDto,
    svhId: string,
    actor: string,
  ): Promise<void> {
    const { header, lines } = dto;
    await tx.stockVoucherItem.deleteMany({
      where: { sviVoucherId: svhId, sviAccYear: header.accYear },
    });
    if (!lines.length) {
      return;
    }

    const conversions = await this.resolveConversions(lines);
    const data = lines.map((line) => {
      const conversion = conversions.get(line.uomId) as UomConversion;
      const factor = conversion.toBaseFactor;
      const qty = this.toDecimalNumber(line.qty);
      const freeQty = this.toDecimalNumber(line.freeQty ?? 0);
      return {
        sviVoucherId: svhId,
        // Scope is copied from the HEADER, never read off the line: a line
        // filed under a different company, branch or year than the document it
        // belongs to is a row no report will ever find again.
        sviCompanyId: header.companyId,
        sviBranchId: header.branchId,
        sviTenantId: header.tenantId ?? null,
        sviAccYear: header.accYear,
        sviLineNo: line.lineNo,
        sviSplitNo: line.splitNo ?? 1,
        sviItemId: line.itemId,
        sviUomId: line.uomId,
        sviBaseUomId: line.baseUomId ?? (conversion.baseIucId as string),
        sviToBaseFactor: new Prisma.Decimal(factor),
        sviGodownId: line.godownId,
        // svi_lot_id is ALWAYS NULL on save. fn_slt_resolve owns lot identity,
        // and only at post time: a client-chosen lot would let two documents
        // open the same holding under two different lots.
        sviLotId: null,
        sviBucket: (line.bucket ?? 'SALEABLE') satisfies StockBucket,
        sviBatchNo: line.batchNo ?? null,
        sviMfgDate: line.mfgDate ? new Date(`${line.mfgDate}T00:00:00Z`) : null,
        sviExpiryDate: line.expiryDate ? new Date(`${line.expiryDate}T00:00:00Z`) : null,
        sviMrp: this.toNullableDecimal(line.mrp),
        sviSalePrice: this.toNullableDecimal(line.salePrice),
        sviSerialNo: line.serialNo ?? null,
        sviSupplierId: line.supplierId ?? null,
        sviQty: new Prisma.Decimal(qty),
        sviBaseQty: new Prisma.Decimal(qty * factor),
        sviFreeQty: new Prisma.Decimal(freeQty),
        sviFreeBaseQty: new Prisma.Decimal(freeQty * factor),
        sviCostRate: new Prisma.Decimal(this.toDecimalNumber(line.costRate)),
        // Left at 0 when not sent: the engine derives it from svi_tax_perc at
        // post and writes it back (20 ÷ 1.05 = 19.047619).
        sviCostRateWot: new Prisma.Decimal(this.toDecimalNumber(line.costRateWot ?? 0)),
        sviTaxPerc: new Prisma.Decimal(this.toDecimalNumber(line.taxPerc ?? 0)),
        sviRemarks: line.remarks ?? null,
        sviCreatedBy: actor === DEFAULT_ACTOR ? null : actor,
        // svi_value, svi_value_wot and svi_diff_qty are GENERATED ALWAYS ...
        // STORED and are absent from this object on purpose — Postgres rejects
        // any write to them, including a write of the value it would compute.
      };
    });

    await tx.stockVoucherItem.createMany({ data });

    await this.auditLogService.logEntityChange(
      {
        action: 'update',
        tableName: STOCK_VOUCHER_ITEM_TABLE_NAME,
        screenName: rules.auditScreenName,
        screenType: 'transaction',
        pk: svhId,
        displayName: header.refno ?? svhId,
        originalRecord: null,
        modifiedRecord: { svhId, lineCount: data.length },
        userId: actor,
        notes: `${rules.displayName} lines replaced`,
      },
      tx,
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // §5 — list and load
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Q1. Scoped by company + branch + acc_year and ordered
   * (svh_doc_date DESC, svh_slno DESC) so it rides ix_svh_list.
   *
   * It reads the TRIGGER-MAINTAINED counters on the header. The list never
   * aggregates the line table — that is the whole reason those four columns
   * exist.
   *
   * NOT a configured grid: there is no grid id for these, so they do not go
   * through ConfiguredGridSqlService.
   */
  async list(
    rules: StockVoucherTypeRules,
    query: ListStockVouchersQuery,
  ): Promise<StockVoucherListResult> {
    const limit = this.clamp(query.limit, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const offset = Math.max(query.offset ?? 0, 0);
    const search = query.search?.trim();

    const rows = await this.prisma.$queryRaw<
      Array<
        Pick<
          HeaderRow,
          | 'svh_id'
          | 'svh_acc_year'
          | 'svh_refno'
          | 'svh_usr_refno'
          | 'svh_doc_date'
          | 'svh_to_godown_id'
          | 'to_godown_name'
          | 'svh_status'
          | 'svh_line_count'
          | 'svh_total_qty'
          | 'svh_total_value'
          | 'svh_total_value_wot'
          | 'svh_posted_on'
          | 'svh_rate_source'
          | 'svh_remarks'
        >
      >
    >`
      SELECT svh.svh_id,
             svh.svh_acc_year,
             svh.svh_refno,
             svh.svh_usr_refno,
             svh.svh_doc_date,
             svh.svh_to_godown_id,
             gdl.gdl_name AS to_godown_name,
             svh.svh_status,
             svh.svh_line_count,
             svh.svh_total_qty,
             svh.svh_total_value,
             svh.svh_total_value_wot,
             svh.svh_posted_on,
             svh.svh_rate_source,
             svh.svh_remarks
        FROM stock.stock_voucher svh
        LEFT JOIN inventory.godown_locations gdl ON gdl.gdl_id = svh.svh_to_godown_id
       WHERE svh.svh_company_id   = ${query.companyId}::uuid
         AND svh.svh_branch_id    = ${query.branchId}::uuid
         AND svh.svh_acc_year     = ${query.accYear}::bpchar
         AND svh.svh_voucher_type = ${rules.voucherType}
         AND svh.svh_is_deleted   = false
         AND (${query.status ?? null}::varchar IS NULL OR svh.svh_status = ${query.status ?? null}::varchar)
         AND (${query.fromDate ?? null}::date IS NULL OR svh.svh_doc_date >= ${query.fromDate ?? null}::date)
         AND (${query.toDate ?? null}::date   IS NULL OR svh.svh_doc_date <= ${query.toDate ?? null}::date)
         AND (
               ${search ?? null}::text IS NULL
            OR svh.svh_refno     ILIKE '%' || ${search ?? null}::text || '%'
            OR svh.svh_usr_refno ILIKE '%' || ${search ?? null}::text || '%'
         )
       ORDER BY svh.svh_doc_date DESC, svh.svh_slno DESC
       LIMIT ${limit} OFFSET ${offset}
    `;

    return {
      items: rows.map((row) => ({
        svhId: row.svh_id,
        accYear: row.svh_acc_year.trim(),
        refno: row.svh_refno,
        usrRefno: row.svh_usr_refno,
        docDate: this.toIsoDate(row.svh_doc_date) as string,
        godownId: row.svh_to_godown_id,
        godownName: row.to_godown_name,
        status: row.svh_status as StockVoucherStatus,
        lineCount: row.svh_line_count,
        totalQty: toNumber(row.svh_total_qty),
        totalValue: toNumber(row.svh_total_value),
        totalValueWot: toNumber(row.svh_total_value_wot),
        postedOn: row.svh_posted_on?.toISOString() ?? null,
        rateSource: row.svh_rate_source as StockRateSource | null,
        remarks: row.svh_remarks,
      })) satisfies StockVoucherListItem[],
      meta: { limit, offset, count: rows.length },
    };
  }

  /** The header row plus Q2 for its lines (ux_svi_line ordering). */
  async getById(
    rules: StockVoucherTypeRules,
    svhId: string,
    accYear: string,
    companyId: string,
    branchId: string,
  ): Promise<StockVoucherPayload> {
    const [header] = await this.prisma.$queryRaw<HeaderRow[]>`
      SELECT svh.svh_id,
             svh.svh_acc_year,
             svh.svh_company_id,
             svh.svh_branch_id,
             svh.svh_tenant_id,
             svh.svh_device_id,
             svh.svh_session_id,
             svh.svh_voucher_type,
             svh.svh_slno,
             svh.svh_refno,
             svh.svh_usr_refno,
             svh.svh_doc_date,
             svh.svh_doc_datetime,
             svh.svh_from_godown_id,
             fgd.gdl_name AS from_godown_name,
             svh.svh_to_godown_id,
             tgd.gdl_name AS to_godown_name,
             svh.svh_supplier_id,
             svh.svh_status,
             svh.svh_line_count,
             svh.svh_total_qty,
             svh.svh_total_value,
             svh.svh_total_value_wot,
             svh.svh_posted_on,
             svh.svh_posted_by,
             usr.usr_display_name AS posted_by_name,
             svh.svh_cancelled_on,
             svh.svh_cancel_reason,
             svh.svh_rate_source,
             svh.svh_remarks,
             svh.svh_is_deleted
        FROM stock.stock_voucher svh
        LEFT JOIN inventory.godown_locations fgd ON fgd.gdl_id = svh.svh_from_godown_id
        LEFT JOIN inventory.godown_locations tgd ON tgd.gdl_id = svh.svh_to_godown_id
        LEFT JOIN public.user_master usr         ON usr.usr_id = svh.svh_posted_by
       WHERE svh.svh_id          = ${svhId}::uuid
         AND svh.svh_acc_year    = ${accYear}::bpchar
         AND svh.svh_company_id  = ${companyId}::uuid
         AND svh.svh_branch_id   = ${branchId}::uuid
         AND svh.svh_voucher_type = ${rules.voucherType}
    `;

    if (!header) {
      throwStockNotFound<StockErrorDetail, StockErrorResponse>(
        `${rules.displayName} not found`,
        'svhId',
        `No ${rules.voucherType} voucher ${svhId} in ${accYear} for this company and branch.`,
      );
    }

    const lines = await this.prisma.$queryRaw<LineRow[]>`
      SELECT svi.svi_id,
             svi.svi_line_no,
             svi.svi_split_no,
             svi.svi_item_id,
             itm.item_code,
             itm.item_name_en AS item_name,
             unt.unit_name,
             svi.svi_uom_id,
             svi.svi_base_uom_id,
             svi.svi_to_base_factor,
             svi.svi_godown_id,
             gdl.gdl_name AS godown_name,
             svi.svi_bucket,
             svi.svi_batch_no,
             svi.svi_mfg_date,
             svi.svi_expiry_date,
             svi.svi_mrp,
             svi.svi_sale_price,
             svi.svi_serial_no,
             svi.svi_supplier_id,
             svi.svi_qty,
             svi.svi_base_qty,
             svi.svi_free_qty,
             svi.svi_free_base_qty,
             svi.svi_cost_rate,
             svi.svi_cost_rate_wot,
             svi.svi_tax_perc,
             svi.svi_value,
             svi.svi_value_wot,
             svi.svi_lot_id,
             svi.svi_remarks
        FROM stock.stock_voucher_item svi
        JOIN inventory.item_master itm            ON itm.item_id = svi.svi_item_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = svi.svi_uom_id
        LEFT JOIN inventory.item_unit_master unt  ON unt.unit_id = iuc.iuc_unit_id
        LEFT JOIN inventory.godown_locations gdl  ON gdl.gdl_id = svi.svi_godown_id
       WHERE svi.svi_voucher_id = ${svhId}::uuid
         AND svi.svi_acc_year   = ${accYear}::bpchar
         AND svi.svi_is_deleted = false
       ORDER BY svi.svi_line_no, svi.svi_split_no
    `;

    return { header: this.toHeaderPayload(header), lines: lines.map((row) => this.toLinePayload(row)) };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // §6 — the preflight
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Q3. The query that makes this screen usable.
   *
   * It resolves the lot exactly the way fn_slt_resolve would — blanking
   * whatever the effective StockTrackPolicy does not track, then matching on
   * stock_lot's GENERATED key columns — WITHOUT creating anything. That is the
   * only way to answer "has this holding already been opened?" before the lot
   * exists, because the lot is what the answer is keyed on.
   *
   * Every line comes back, `problem` null on the clean ones, so the screen can
   * show the failures and tick the rest in one pass.
   *
   * ADVISORY, not authoritative. §7 still handles the engine raising: another
   * till can post the same holding between this check and the post.
   */
  async validate(
    rules: StockVoucherTypeRules,
    svhId: string,
    accYear: string,
    companyId: string,
    branchId: string,
  ): Promise<StockVoucherLineProblem[]> {
    // Presence check first: Q3 on a voucher that does not exist returns zero
    // rows, which reads identically to "no problems".
    await this.loadHeaderOrThrow(rules, svhId, accYear, companyId, branchId);

    return this.prisma.$queryRaw<StockVoucherLineProblem[]>`
      WITH doc AS (
        SELECT svh.svh_id,
               svh.svh_acc_year,
               svh.svh_company_id,
               svh.svh_branch_id,
               svh.svh_doc_date,
               svh.svh_rate_source
          FROM stock.stock_voucher svh
         WHERE svh.svh_id       = ${svhId}::uuid
           AND svh.svh_acc_year = ${accYear}::bpchar
      ),
      line AS (
        SELECT svi.*, doc.svh_doc_date, doc.svh_rate_source, doc.svh_company_id, doc.svh_branch_id
          FROM stock.stock_voucher_item svi
          JOIN doc ON doc.svh_id = svi.svi_voucher_id AND doc.svh_acc_year = svi.svi_acc_year
         WHERE svi.svi_is_deleted = false
      ),
      -- The effective policy, most-specific-first, resolved against the
      -- DOCUMENT's date and not today's — see the StockTrackPolicy model note.
      -- No row at all is a complete answer: track nothing, WAVG, FEFO, ALLOW.
      policy AS (
        SELECT line.svi_id,
               COALESCE(stp.stp_track_batch,      false) AS track_batch,
               COALESCE(stp.stp_track_mrp,        false) AS track_mrp,
               COALESCE(stp.stp_track_sale_price, false) AS track_sale_price,
               COALESCE(stp.stp_track_expiry,     false) AS track_expiry,
               COALESCE(stp.stp_track_serial,     false) AS track_serial,
               COALESCE(stp.stp_track_supplier,   false) AS track_supplier
          FROM line
          JOIN inventory.item_master itm ON itm.item_id = line.svi_item_id
          LEFT JOIN LATERAL (
            SELECT p.*
              FROM stock.stock_track_policy p
             WHERE p.stp_is_active  = true
               AND p.stp_is_deleted = false
               AND line.svh_doc_date BETWEEN p.stp_effective_from AND p.stp_effective_to
               AND (p.stp_company_id IS NULL OR p.stp_company_id = line.svh_company_id)
               AND (p.stp_branch_id  IS NULL OR p.stp_branch_id  = line.svh_branch_id)
               AND (
                     (p.stp_scope = 'ITEM'    AND p.stp_scope_id = line.svi_item_id)
                  OR (p.stp_scope = 'GROUP'   AND p.stp_scope_id = itm.item_group_id)
                  OR  p.stp_scope = 'COMPANY'
               )
             ORDER BY (p.stp_branch_id IS NOT NULL) DESC,
                      (p.stp_company_id IS NOT NULL) DESC,
                      CASE p.stp_scope WHEN 'ITEM' THEN 0 WHEN 'GROUP' THEN 1 ELSE 2 END,
                      p.stp_effective_from DESC
             LIMIT 1
          ) stp ON true
      ),
      -- The identity fn_slt_resolve would key on: each dimension blanked when
      -- the policy does not track it, then collapsed to the same sentinels
      -- ux_slt_identity is built over ('~', -1, 0001-01-01, the nil uuid).
      keyed AS (
        SELECT line.*,
               policy.track_batch, policy.track_mrp, policy.track_sale_price,
               policy.track_expiry, policy.track_serial, policy.track_supplier,
               COALESCE(CASE WHEN policy.track_batch       THEN NULLIF(line.svi_batch_no, '') END, '~')          AS key_batch,
               COALESCE(CASE WHEN policy.track_mrp         THEN line.svi_mrp        END, -1)                     AS key_mrp,
               COALESCE(CASE WHEN policy.track_sale_price  THEN line.svi_sale_price END, -1)                     AS key_sp,
               COALESCE(CASE WHEN policy.track_expiry      THEN line.svi_expiry_date END, DATE '0001-01-01')     AS key_expiry,
               COALESCE(CASE WHEN policy.track_serial      THEN NULLIF(line.svi_serial_no, '') END, '~')         AS key_serial,
               COALESCE(CASE WHEN policy.track_supplier    THEN line.svi_supplier_id END, ${NIL_UUID}::uuid)     AS key_supplier
          FROM line
          JOIN policy ON policy.svi_id = line.svi_id
      ),
      -- Has this holding already been opened this year? Matched through the
      -- lot's generated key columns and the OPENING rows in the ledger, NOT
      -- through the documents: a cancelled opening is reversed in the ledger
      -- and must correctly read as "not opened".
      opened AS (
        SELECT keyed.svi_id,
               EXISTS (
                 SELECT 1
                   FROM stock.stock_lot slt
                   JOIN stock.stock_ledger sml ON sml.sml_lot_id = slt.slt_id
                  WHERE slt.slt_company_id  = keyed.svh_company_id
                    AND slt.slt_item_id     = keyed.svi_item_id
                    AND slt.slt_key_batch    = keyed.key_batch
                    AND slt.slt_key_mrp      = keyed.key_mrp
                    AND slt.slt_key_sp       = keyed.key_sp
                    AND slt.slt_key_expiry   = keyed.key_expiry
                    AND slt.slt_key_serial   = keyed.key_serial
                    AND slt.slt_key_supplier = keyed.key_supplier
                    AND sml.sml_company_id  = keyed.svh_company_id
                    AND sml.sml_branch_id   = keyed.svh_branch_id
                    AND sml.sml_acc_year    = keyed.svi_acc_year
                    AND sml.sml_godown_id   = keyed.svi_godown_id
                    AND sml.sml_txn_type    = 'OPENING'
                    AND sml.sml_is_deleted  = false
                    AND sml.sml_src_doc_id <> keyed.svi_voucher_id
               ) AS already_opened
          FROM keyed
      )
      SELECT keyed.svi_id                             AS "sviId",
             keyed.svi_line_no                        AS "lineNo",
             keyed.svi_split_no                       AS "splitNo",
             keyed.svi_item_id                        AS "itemId",
             itm.item_code                            AS "itemCode",
             itm.item_name_en                         AS "itemName",
             CASE
               WHEN keyed.svi_qty = 0 AND keyed.svi_free_qty = 0
                 THEN 'this line has no quantity'
               WHEN iuc.iuc_id IS NULL OR iuc.iuc_item_id <> keyed.svi_item_id
                 THEN 'the unit does not belong to this item'
               WHEN keyed.track_batch      AND COALESCE(keyed.svi_batch_no, '') = ''
                 THEN 'this item is batch-tracked and the line has no batch number'
               WHEN keyed.track_expiry     AND keyed.svi_expiry_date IS NULL
                 THEN 'this item is expiry-tracked and the line has no expiry date'
               WHEN keyed.track_mrp        AND keyed.svi_mrp IS NULL
                 THEN 'this item is MRP-tracked and the line has no MRP'
               WHEN keyed.track_sale_price AND keyed.svi_sale_price IS NULL
                 THEN 'this item is sale-price-tracked and the line has no sale price'
               WHEN keyed.track_serial     AND COALESCE(keyed.svi_serial_no, '') = ''
                 THEN 'this item is serial-tracked and the line has no serial number'
               WHEN keyed.track_supplier   AND keyed.svi_supplier_id IS NULL
                 THEN 'this item is supplier-tracked and the line has no supplier'
               WHEN ${rules.isInward}::boolean AND keyed.svi_cost_rate = 0 AND keyed.svh_rate_source IS NULL
                 THEN 'this line brings stock in with no cost rate and the document names no rate source'
               WHEN keyed.svh_rate_source = 'AVG_COST' AND sic.sic_avg_cost_rate IS NULL
                 THEN 'the rate source is AVG_COST and this item has no average cost yet'
               WHEN opened.already_opened
                 THEN 'this holding already has an opening in this year'
               ELSE NULL
             END                                      AS "problem"
        FROM keyed
        JOIN opened ON opened.svi_id = keyed.svi_id
        JOIN inventory.item_master itm ON itm.item_id = keyed.svi_item_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = keyed.svi_uom_id
        LEFT JOIN stock.stock_item_cost sic
               ON sic.sic_company_id = keyed.svh_company_id
              AND sic.sic_branch_id  = keyed.svh_branch_id
              AND sic.sic_item_id    = keyed.svi_item_id
              AND sic.sic_is_deleted = false
       ORDER BY keyed.svi_line_no, keyed.svi_split_no
    `;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // §7 — post
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * The whole engine, one statement.
   *
   * WHAT THIS DELIBERATELY DOES NOT DO around that statement: no application
   * lock, no pre-UPDATE of the status, no ledger insert, no balance touch.
   * fn_svh_post takes FOR UPDATE on the header itself, so two simultaneous
   * posts are already serialised and the loser is told the voucher is POSTED.
   * A lock on top of that buys nothing and can deadlock against the function's
   * own.
   *
   * What happens inside, in order — worth knowing when reading a stack trace:
   * fn_slt_resolve creates the lots → stock_ledger rows are inserted →
   * tr_sml_apply builds stock_balance, slt_total_on_hand and the moving average
   * in stock_item_cost → the lines get their lot_id and resolved rates written
   * back → fn_svh_recompute → status POSTED.
   */
  async post(
    rules: StockVoucherTypeRules,
    svhId: string,
    accYear: string,
    companyId: string,
    branchId: string,
    userId?: string,
  ): Promise<StockVoucherPostResult> {
    const actor = resolveActor(userId, this.requestContextService.getUserId());
    const existing = await this.loadHeaderOrThrow(rules, svhId, accYear, companyId, branchId);
    this.assertDraft(rules, existing);

    // Q3 first, and refuse without calling the function when any row has a
    // problem. Post is the button a user presses forty lines in; letting the
    // engine raise on the first bad one and roll back the rest hands them one
    // error at a time.
    const problems = (await this.validate(rules, svhId, accYear, companyId, branchId)).filter(
      (row) => row.problem !== null,
    );
    if (problems.length) {
      throwStockUnprocessable<StockErrorDetail, StockErrorResponse>(
        `This ${rules.displayName.toLowerCase()} cannot be posted`,
        problems.map((row) => ({
          field: `lines.${row.lineNo}`,
          message: `Line ${row.lineNo}${row.splitNo > 1 ? ` split ${row.splitNo}` : ''} (${row.itemName}): ${row.problem}`,
        })),
      );
    }

    const rowsPosted = await this.prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<Array<{ rows: number }>>`
        SELECT stock.fn_svh_post(${svhId}::uuid, ${accYear}::bpchar, ${actor}::uuid) AS rows
      `;
      return Number(row?.rows ?? 0);
    });

    // Reload: the post changed lotId, costRateWot and every total on rows the
    // client is still holding.
    const document = await this.getById(rules, svhId, accYear, companyId, branchId);

    await this.auditLogService.logEntityChange({
      action: 'update',
      tableName: STOCK_VOUCHER_TABLE_NAME,
      screenName: rules.auditScreenName,
      screenType: 'transaction',
      pk: svhId,
      displayName: document.header.refno,
      originalRecord: { svhId, svhStatus: 'DRAFT' },
      modifiedRecord: { svhId, svhStatus: document.header.status, rowsPosted },
      userId: actor,
      notes: `${rules.displayName} posted — ${rowsPosted} ledger rows`,
    });

    return {
      ...document,
      rowsPosted,
      status: document.header.status,
      postedOn: document.header.postedOn,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // §8 — cancel
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Reversal rows, never a delete. Two properties worth holding on to:
   *
   *   * A reversal carries the ORIGINAL doc_date and acc_year, so an
   *     as-on-date report reads "this document never moved stock".
   *     sml_posted_on is the audit trail of when the cancellation happened.
   *   * It can LEGITIMATELY fail. Cancelling an opening after stock has been
   *     sold from it drives the holding negative, and fn_sml_apply refuses that
   *     under stp_allow_negative = 'BLOCK'. That is correct behaviour, not a
   *     bug to route around — it surfaces as a 409 naming the item, and the fix
   *     is an ADJUSTMENT with a reason.
   *
   * `reason` is required here even though svh_cancel_reason is nullable: a
   * cancelled opening with no reason is unanswerable three months later.
   */
  async cancel(
    rules: StockVoucherTypeRules,
    svhId: string,
    accYear: string,
    reason: string,
    companyId: string,
    branchId: string,
    userId?: string,
  ): Promise<StockVoucherCancelResult> {
    const actor = resolveActor(userId, this.requestContextService.getUserId());
    const trimmedReason = reason?.trim();
    if (!trimmedReason) {
      throwStockUnprocessable<StockErrorDetail, StockErrorResponse>('Cancellation needs a reason', [
        {
          field: 'reason',
          message: 'A cancelled document with no reason is unanswerable three months later.',
        },
      ]);
    }

    const existing = await this.loadHeaderOrThrow(rules, svhId, accYear, companyId, branchId);
    if (existing.svhStatus === 'CANCELLED') {
      throwStockConflict<StockErrorDetail, StockErrorResponse>(
        `${rules.displayName} already cancelled`,
        [
          {
            field: 'svhId',
            message: `${existing.svhRefno} was cancelled on ${existing.svhCancelledOn?.toISOString() ?? 'an earlier date'}.`,
          },
        ],
      );
    }
    if (existing.svhStatus === 'DRAFT') {
      throwStockConflict<StockErrorDetail, StockErrorResponse>(
        `${rules.displayName} is a draft`,
        [
          {
            field: 'svhId',
            message: `${existing.svhRefno} is DRAFT and has moved no stock, so there is nothing to reverse. Delete it instead.`,
          },
        ],
      );
    }

    const rowsReversed = await this.prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<Array<{ rows: number }>>`
        SELECT stock.fn_svh_cancel(${svhId}::uuid, ${accYear}::bpchar, ${trimmedReason}, ${actor}::uuid) AS rows
      `;
      return Number(row?.rows ?? 0);
    });

    const document = await this.getById(rules, svhId, accYear, companyId, branchId);

    await this.auditLogService.logEntityChange({
      action: 'cancel',
      tableName: STOCK_VOUCHER_TABLE_NAME,
      screenName: rules.auditScreenName,
      screenType: 'transaction',
      pk: svhId,
      displayName: document.header.refno,
      originalRecord: { svhId, svhStatus: existing.svhStatus },
      modifiedRecord: { svhId, svhStatus: document.header.status, rowsReversed },
      userId: actor,
      notes: `${rules.displayName} cancelled: ${trimmedReason}`,
    });

    return {
      ...document,
      rowsReversed,
      status: document.header.status,
      cancelledOn: document.header.cancelledOn,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // §9 — soft delete
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * DRAFT only.
   *
   * A POSTED voucher is CANCELLED, never deleted. svh_is_deleted is not read by
   * fn_svh_cancel's ledger scan and fn_svh_post refuses a deleted voucher — so
   * soft-deleting a posted document hides it from every list while its ledger
   * rows go on affecting stock for ever. That is the one state this module must
   * not be able to reach.
   */
  async softDelete(
    rules: StockVoucherTypeRules,
    svhId: string,
    accYear: string,
    companyId: string,
    branchId: string,
    userId?: string,
  ): Promise<StockVoucherDeleteResult> {
    const actor = resolveActor(userId, this.requestContextService.getUserId());
    const existing = await this.loadHeaderOrThrow(rules, svhId, accYear, companyId, branchId);
    if (existing.svhStatus !== 'DRAFT') {
      throwStockConflict<StockErrorDetail, StockErrorResponse>(
        `${rules.displayName} is ${existing.svhStatus}`,
        [
          {
            field: 'svhId',
            message: `${existing.svhRefno} is ${existing.svhStatus} and has ledger rows. Cancel it — a cancellation reverses the movement; a soft delete would only hide the document while its stock stayed.`,
          },
        ],
      );
    }

    const modifiedOn = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.stockVoucher.update({
        where: { svhId_svhAccYear: { svhId, svhAccYear: accYear } },
        data: {
          svhIsDeleted: true,
          svhModifiedOn: modifiedOn,
          svhModifiedBy: actor === DEFAULT_ACTOR ? null : actor,
        },
      });
      // The lines cascade on the FK, but a soft delete is not a delete: without
      // this, ix_svi_voucher keeps serving them to anything that reads lines by
      // voucher id.
      await tx.stockVoucherItem.updateMany({
        where: { sviVoucherId: svhId, sviAccYear: accYear },
        data: {
          sviIsDeleted: true,
          sviModifiedOn: modifiedOn,
          sviModifiedBy: actor === DEFAULT_ACTOR ? null : actor,
        },
      });
      await this.auditLogService.logEntityChange(
        {
          // audit.audit_log_action has no 'delete' member — every module here
          // logs a soft delete as 'cancel'.
          action: 'cancel',
          tableName: STOCK_VOUCHER_TABLE_NAME,
          screenName: rules.auditScreenName,
          screenType: 'transaction',
          pk: svhId,
          displayName: existing.svhRefno,
          originalRecord: { svhId, svhIsDeleted: false, svhStatus: existing.svhStatus },
          modifiedRecord: { svhId, svhIsDeleted: true, svhStatus: existing.svhStatus },
          userId: actor,
          notes: `${rules.displayName} draft soft deleted`,
        },
        tx,
      );
    });

    return { svhId, accYear, deleted: true };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // §10 — the two go-live reports
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Q4 — every stockable item with no OPENING movement in this branch and year.
   *
   * On go-live day this is the work list. A week later it should be the items
   * that genuinely started at zero, which is a different and much shorter list.
   */
  async pendingItems(
    rules: StockVoucherTypeRules,
    companyId: string,
    branchId: string,
    accYear: string,
    limit?: number,
    offset?: number,
  ): Promise<PagedResult<PendingOpeningItem>> {
    const take = this.clamp(limit, DEFAULT_REPORT_LIMIT, MAX_REPORT_LIMIT);
    const skip = Math.max(offset ?? 0, 0);
    const items = await this.prisma.$queryRaw<PendingOpeningItem[]>`
      SELECT itm.item_id                        AS "itemId",
             itm.item_code                      AS "itemCode",
             itm.item_name_en                   AS "itemName",
             base.iuc_id                        AS "baseUomId",
             unt.unit_name                      AS "unitName",
             stp.stp_track_signature            AS "trackSignature"
        FROM inventory.item_master itm
        LEFT JOIN inventory.item_unit_conversion base
               ON base.iuc_item_id = itm.item_id
              AND base.iuc_is_base_unit = true
              AND base.iuc_is_deleted = false
        LEFT JOIN inventory.item_unit_master unt ON unt.unit_id = base.iuc_unit_id
        LEFT JOIN stock.stock_track_policy stp
               ON stp.stp_scope = 'ITEM'
              AND stp.stp_scope_id = itm.item_id
              AND stp.stp_is_active = true
              AND stp.stp_is_deleted = false
       WHERE itm.item_is_deleted = false
         AND itm.item_is_active  = true
         AND itm.item_is_service = false
         AND (itm.item_company_id IS NULL OR itm.item_company_id = ${companyId}::uuid)
         AND NOT EXISTS (
           SELECT 1
             FROM stock.stock_ledger sml
            WHERE sml.sml_item_id    = itm.item_id
              AND sml.sml_company_id = ${companyId}::uuid
              AND sml.sml_branch_id  = ${branchId}::uuid
              AND sml.sml_acc_year   = ${accYear}::bpchar
              AND sml.sml_txn_type   = ${rules.ledgerTxnType}
              AND sml.sml_is_deleted = false
         )
       ORDER BY itm.item_code NULLS LAST, itm.item_name_en
       LIMIT ${take} OFFSET ${skip}
    `;
    return { items, meta: { limit: take, offset: skip, count: items.length } };
  }

  /**
   * Q5 — what the branch started with, what it holds now, the difference.
   *
   * The opening figure comes from the LEDGER, not from the document, so a
   * cancelled opening correctly reads as zero: the reversal row nets it out
   * where a document-level read would still show the original quantity.
   */
  async reconcile(
    rules: StockVoucherTypeRules,
    companyId: string,
    branchId: string,
    accYear: string,
    limit?: number,
    offset?: number,
  ): Promise<PagedResult<OpeningReconcileRow>> {
    const take = this.clamp(limit, DEFAULT_REPORT_LIMIT, MAX_REPORT_LIMIT);
    const skip = Math.max(offset ?? 0, 0);
    const items = await this.prisma.$queryRaw<OpeningReconcileRow[]>`
      WITH opening AS (
        SELECT sml.sml_item_id                                    AS item_id,
               SUM(sml.sml_signed_base_qty)                       AS opening_qty,
               -- sml_cost_value is a MAGNITUDE; the sign lives in
               -- sml_direction alone, which is why a reversal nets out here.
               SUM(sml.sml_cost_value * sml.sml_direction)        AS opening_value
          FROM stock.stock_ledger sml
         WHERE sml.sml_company_id = ${companyId}::uuid
           AND sml.sml_branch_id  = ${branchId}::uuid
           AND sml.sml_acc_year   = ${accYear}::bpchar
           AND sml.sml_txn_type   = ${rules.ledgerTxnType}
           AND sml.sml_is_deleted = false
         GROUP BY sml.sml_item_id
      ),
      current AS (
        SELECT sbl.sbl_item_id            AS item_id,
               SUM(sbl.sbl_on_hand_qty)   AS current_qty,
               SUM(sbl.sbl_stock_value)   AS current_value
          FROM stock.stock_balance sbl
         WHERE sbl.sbl_company_id = ${companyId}::uuid
           AND sbl.sbl_branch_id  = ${branchId}::uuid
           AND sbl.sbl_is_deleted = false
         GROUP BY sbl.sbl_item_id
      ),
      merged AS (
        SELECT COALESCE(opening.item_id, current.item_id)      AS item_id,
               COALESCE(opening.opening_qty,   0)              AS opening_qty,
               COALESCE(opening.opening_value, 0)              AS opening_value,
               COALESCE(current.current_qty,   0)              AS current_qty,
               COALESCE(current.current_value, 0)              AS current_value
          FROM opening
          FULL OUTER JOIN current ON current.item_id = opening.item_id
      )
      SELECT merged.item_id                                    AS "itemId",
             itm.item_code                                     AS "itemCode",
             itm.item_name_en                                  AS "itemName",
             unt.unit_name                                     AS "unitName",
             merged.opening_qty                                AS "openingQty",
             merged.opening_value                              AS "openingValue",
             merged.current_qty                                AS "currentQty",
             merged.current_value                              AS "currentValue",
             merged.current_qty   - merged.opening_qty         AS "diffQty",
             merged.current_value - merged.opening_value       AS "diffValue"
        FROM merged
        JOIN inventory.item_master itm ON itm.item_id = merged.item_id
        LEFT JOIN inventory.item_unit_conversion base
               ON base.iuc_item_id = itm.item_id
              AND base.iuc_is_base_unit = true
              AND base.iuc_is_deleted = false
        LEFT JOIN inventory.item_unit_master unt ON unt.unit_id = base.iuc_unit_id
       ORDER BY itm.item_code NULLS LAST, itm.item_name_en
       LIMIT ${take} OFFSET ${skip}
    `;
    return {
      items: items.map((row) => ({
        ...row,
        openingQty: toNumber(row.openingQty as unknown as Prisma.Decimal),
        openingValue: toNumber(row.openingValue as unknown as Prisma.Decimal),
        currentQty: toNumber(row.currentQty as unknown as Prisma.Decimal),
        currentValue: toNumber(row.currentValue as unknown as Prisma.Decimal),
        diffQty: toNumber(row.diffQty as unknown as Prisma.Decimal),
        diffValue: toNumber(row.diffValue as unknown as Prisma.Decimal),
      })),
      meta: { limit: take, offset: skip, count: items.length },
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────────

  private async loadForWrite(
    tx: Prisma.TransactionClient,
    rules: StockVoucherTypeRules,
    svhId: string,
    accYear: string,
  ) {
    const existing = await tx.stockVoucher.findUnique({
      where: { svhId_svhAccYear: { svhId, svhAccYear: accYear } },
      select: {
        svhId: true,
        svhRefno: true,
        svhStatus: true,
        svhIsDeleted: true,
        svhVoucherType: true,
        svhCancelledOn: true,
      },
    });
    if (!existing || existing.svhVoucherType !== rules.voucherType) {
      throwStockNotFound<StockErrorDetail, StockErrorResponse>(
        `${rules.displayName} not found`,
        'svhId',
        `No ${rules.voucherType} voucher ${svhId} in ${accYear}.`,
      );
    }
    return existing;
  }

  private async loadHeaderOrThrow(
    rules: StockVoucherTypeRules,
    svhId: string,
    accYear: string,
    companyId: string,
    branchId: string,
  ) {
    const existing = await this.prisma.stockVoucher.findUnique({
      where: { svhId_svhAccYear: { svhId, svhAccYear: accYear } },
      select: {
        svhId: true,
        svhRefno: true,
        svhStatus: true,
        svhIsDeleted: true,
        svhVoucherType: true,
        svhCompanyId: true,
        svhBranchId: true,
        svhCancelledOn: true,
      },
    });
    if (
      !existing ||
      existing.svhVoucherType !== rules.voucherType ||
      existing.svhCompanyId !== companyId ||
      existing.svhBranchId !== branchId
    ) {
      throwStockNotFound<StockErrorDetail, StockErrorResponse>(
        `${rules.displayName} not found`,
        'svhId',
        `No ${rules.voucherType} voucher ${svhId} in ${accYear} for this company and branch.`,
      );
    }
    return existing;
  }

  private assertDraft(
    rules: StockVoucherTypeRules,
    existing: { svhRefno: string; svhStatus: string; svhIsDeleted: boolean },
  ): void {
    if (existing.svhIsDeleted) {
      throwStockConflict<StockErrorDetail, StockErrorResponse>(
        `${rules.displayName} is deleted`,
        [{ field: 'svhId', message: `${existing.svhRefno} has been deleted.` }],
      );
    }
    if (existing.svhStatus !== 'DRAFT') {
      throwStockConflict<StockErrorDetail, StockErrorResponse>(
        `${rules.displayName} is ${existing.svhStatus}`,
        [
          {
            field: 'svhId',
            message: `${existing.svhRefno} is ${existing.svhStatus}; only a DRAFT voucher can be edited or posted. A posted document accepts only cancel and print.`,
          },
        ],
      );
    }
  }

  private toHeaderPayload(row: HeaderRow): StockVoucherHeaderPayload {
    return {
      svhId: row.svh_id,
      accYear: row.svh_acc_year.trim(),
      companyId: row.svh_company_id,
      branchId: row.svh_branch_id,
      tenantId: row.svh_tenant_id,
      deviceId: row.svh_device_id,
      sessionId: row.svh_session_id,
      voucherType: row.svh_voucher_type as StockVoucherHeaderPayload['voucherType'],
      // bigint has no JSON representation — every other module here serialises
      // one as a string rather than risking a silent precision loss.
      slno: row.svh_slno.toString(),
      refno: row.svh_refno,
      usrRefno: row.svh_usr_refno,
      docDate: this.toIsoDate(row.svh_doc_date) as string,
      docDatetime: row.svh_doc_datetime.toISOString(),
      fromGodownId: row.svh_from_godown_id,
      fromGodownName: row.from_godown_name,
      godownId: row.svh_to_godown_id,
      godownName: row.to_godown_name,
      supplierId: row.svh_supplier_id,
      status: row.svh_status as StockVoucherStatus,
      lineCount: row.svh_line_count,
      totalQty: toNumber(row.svh_total_qty),
      totalValue: toNumber(row.svh_total_value),
      totalValueWot: toNumber(row.svh_total_value_wot),
      postedOn: row.svh_posted_on?.toISOString() ?? null,
      postedBy: row.svh_posted_by,
      postedByName: row.posted_by_name,
      cancelledOn: row.svh_cancelled_on?.toISOString() ?? null,
      cancelReason: row.svh_cancel_reason,
      rateSource: row.svh_rate_source as StockRateSource | null,
      remarks: row.svh_remarks,
      isDeleted: row.svh_is_deleted,
    };
  }

  private toLinePayload(row: LineRow): StockVoucherLinePayload {
    return {
      sviId: row.svi_id,
      lineNo: row.svi_line_no,
      splitNo: row.svi_split_no,
      itemId: row.svi_item_id,
      itemCode: row.item_code,
      itemName: row.item_name,
      unitName: row.unit_name,
      uomId: row.svi_uom_id,
      baseUomId: row.svi_base_uom_id,
      toBaseFactor: toNumber(row.svi_to_base_factor),
      godownId: row.svi_godown_id,
      godownName: row.godown_name,
      bucket: row.svi_bucket as StockBucket,
      batchNo: row.svi_batch_no,
      mfgDate: this.toIsoDate(row.svi_mfg_date),
      expiryDate: this.toIsoDate(row.svi_expiry_date),
      mrp: toNullableNumber(row.svi_mrp),
      salePrice: toNullableNumber(row.svi_sale_price),
      serialNo: row.svi_serial_no,
      supplierId: row.svi_supplier_id,
      qty: toNumber(row.svi_qty),
      baseQty: toNumber(row.svi_base_qty),
      freeQty: toNumber(row.svi_free_qty),
      freeBaseQty: toNumber(row.svi_free_base_qty),
      costRate: toNumber(row.svi_cost_rate),
      costRateWot: toNumber(row.svi_cost_rate_wot),
      taxPerc: toNumber(row.svi_tax_perc),
      value: toNullableNumber(row.svi_value) ?? 0,
      valueWot: toNullableNumber(row.svi_value_wot) ?? 0,
      lotId: row.svi_lot_id,
      remarks: row.svi_remarks,
    };
  }

  /** `yyyy-MM-dd` — NexJson::date on the Qt side reads the first ten characters. */
  private toIsoDate(value: Date | null): string | null {
    return value ? value.toISOString().slice(0, 10) : null;
  }

  private toDecimalNumber(value: string | number | null | undefined): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toNullableDecimal(value: string | number | null | undefined): Prisma.Decimal | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? new Prisma.Decimal(parsed) : null;
  }

  private clamp(value: number | undefined, fallback: number, max: number): number {
    if (value === undefined || !Number.isFinite(value) || value <= 0) {
      return fallback;
    }
    return Math.min(Math.trunc(value), max);
  }
}
