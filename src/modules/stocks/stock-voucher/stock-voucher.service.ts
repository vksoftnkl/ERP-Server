import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { looseSearchSql } from 'src/common/search/loose-search';
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
import { IST_CLOCK_SQL_FORMAT, istClockText } from 'src/common/utils/ist-clock.util';
import { SaveStockVoucherDto } from './dto/save-stock-voucher.dto';
import { SaveStockVoucherItemDto } from './dto/save-stock-voucher-item.dto';
import {
  allocateStockVoucherNumber,
  type StockVoucherNumberScope,
} from './stock-voucher-numbering.helper';
import { resolveImportedLines } from './stock-voucher-import.helper';
import { assignAutoBatchNumbers } from './stock-voucher-batch-numbering.helper';
import { softDeleteBatchDetailsOf, syncBatchDetails } from '../batch-detail/batch-detail.helper';
import {
  cancelDraftVoucher,
  effectivePolicyCte,
  effectivePolicyLateral,
  lineDirectionColumn,
  lineReasonJoin,
  lockVoucherItems,
  lotIdentityKeyColumns,
  issueNarrowing,
  lotlessOutwardLine,
  unreversedLedgerRow,
} from './stock-voucher-posting.helper';
// §3.1 — the one stock engine. postStockVoucher / cancelStockVoucher are no
// longer called from here: StockPostingService owns the phases AND the freeze
// guard, so every document that moves stock goes through the same door.
import { StockPostingService } from '../posting/stock-posting.service';
import { StockVoucherSource } from '../posting/stock-voucher.source';
import { StockErrorCode } from '../types/stock-error-codes';
import {
  appendTxnStatusLog,
  TxnStatusEvent,
  TxnStatusSrcModule,
} from 'src/common/txn-status-log/txn-status-log.helper';
import {
  DERIVABLE_RATE_SOURCES,
  type OpeningReconcileRow,
  type PagedResult,
  type PendingOpeningItem,
  type StockBookChange,
  type StockBucket,
  type StockCountSheetRow,
  type StockErrorDetail,
  type StockErrorResponse,
  type StockRateSource,
  type StockVoucherCancelResult,
  type StockTransferRecallResult,
  type StockVoucherDeleteResult,
  type StockVoucherHeaderPayload,
  type StockVoucherLinePayload,
  type StockVoucherLineProblem,
  type StockVoucherLoadingPayload,
  type StockVoucherListItem,
  type StockVoucherListResult,
  type StockVoucherPayload,
  type StockVoucherImportResult,
  type StockVoucherPostResult,
  type StockVoucherSaveResult,
  type StockVoucherStatus,
  type StockVoucherTypeRules,
  type StockVarianceRow,
  type StockPostHooks,
} from './types/stock-voucher.types';
const STOCK_VOUCHER_TABLE_NAME = 'stock_voucher';
/**
 * Notes 89 — where a renumbered line waits while the others move: above any
 * real line number (ck_svi_line_no only asks for >= 1), so ux_svi_line, which
 * is not deferrable, never sees two live rows on one number mid-save.
 */
const PARKED_LINE_NO = 1_000_000;
/** §10 — both reports can cover a 40,000-row item master, so they page. */
const DEFAULT_REPORT_LIMIT = 200;
const MAX_REPORT_LIMIT = 1000;
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 500;
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
/** §4 — one raw row of the generated count sheet. */
interface CountSheetRow {
  sbl_item_id: string;
  item_code: string | null;
  item_name: string;
  sbl_lot_id: string;
  sbl_godown_id: string;
  godown_name: string | null;
  sbl_bucket: string;
  sbl_base_uom_id: string;
  unit_name: string | null;
  sbl_batch_no: string | null;
  slt_mfg_date: Date | null;
  sbl_expiry_date: Date | null;
  sbl_mrp: Prisma.Decimal | null;
  sbl_sale_price: Prisma.Decimal | null;
  slt_serial_no: string | null;
  sbl_supplier_id: string | null;
  sbl_on_hand_qty: Prisma.Decimal | null;
  sbl_avg_cost_rate: Prisma.Decimal;
  sbl_stock_value: Prisma.Decimal;
  sbd_size_id: string | null;
  size_name: string | null;
  sbd_colour_id: string | null;
  colour_name: string | null;
  sbd_model: string | null;
}
/** §12 — one raw ledger row of the variance report. */
interface VarianceRow {
  sml_line_no: number;
  sml_split_no: number;
  sml_item_id: string;
  item_code: string | null;
  item_name: string;
  sml_batch_no: string | null;
  sml_txn_type: string;
  sml_direction: number;
  sml_qty: Prisma.Decimal;
  sml_signed_base_qty: Prisma.Decimal | null;
  sml_cost_rate: Prisma.Decimal;
  sml_cost_value: Prisma.Decimal;
  sml_reason_id: string | null;
  reason_name: string | null;
}
/** §4 — what the count sheet is generated for. */
export interface CountSheetQuery {
  companyId: string;
  branchId: string;
  /**
   * Accepted for compatibility and never read (notes 150, minor): the sheet is
   * drawn from stock_balance, which is not partitioned by year.
   */
  accYear?: string;
  godownId: string;
  bucket?: StockBucket;
  itemGroupId?: string;
  /** Notes 157 — item_master.item_brand_id / item_category_id / item_section_id; each only when sent. */
  itemBrandId?: string;
  itemCategoryId?: string;
  itemSectionId?: string;
  /** Notes 157 — only holdings below zero on the book. Default false. */
  negativeOnly?: boolean;
  /**
   * Default TRUE. A holding the book says is empty is exactly where a count
   * finds something.
   */
  includeZero?: boolean;
  limit?: number;
  offset?: number;
}
/** What stock_balance answers for one holding a count line names — §3.4. */
/**
 * Notes 150 #3 — HOW FAR A DOCUMENT MAY DATE ITSELF FROM THE SERVER CLOCK.
 *
 * The freeze (§11) and the till's day cut-off trust svh_doc_datetime, the
 * movement's OWN time, so that an offline device's documents land at the moment
 * they were keyed rather than the moment they synced. Trusted without a bound,
 * an online screen can key "three hours ago" and step round a freeze that was
 * on. The server keeps no record of which device was offline, so the bound is
 * this: a document that declares no offline sync (no syncDate) may differ from
 * now() by clock skew only; one that declares one may trail ITS SYNC by up to a
 * week (a device offline for longer re-syncs in parts) and never postdate it,
 * and the sync itself is no later than now. Both fields are the client's — but
 * the claim is now explicit, stored on the row, and bounded.
 */
const DOC_DATETIME_ONLINE_SKEW_MS = 15 * 60_000;
const DOC_DATETIME_OFFLINE_MAX_MS = 7 * 24 * 3_600_000;
/** The lines a save wrote, as writeHeaderTotals sums them and save() reports them. */
interface WrittenLines {
  rows: TotalsLine[];
  holdings: Map<string, CountHolding> | null;
  bookChanges: StockBookChange[];
}
/** The columns of a written line that the header totals are summed from. */
interface TotalsLine {
  sviLotId: string | null;
  sviGodownId: string;
  sviBucket: string;
  sviBaseQty: Prisma.Decimal;
  sviFreeBaseQty?: Prisma.Decimal;
  sviCostRate: Prisma.Decimal;
  sviCostRateWot: Prisma.Decimal;
  sviDirection: 1 | -1 | null;
  sviBookQty: Prisma.Decimal | null;
  sviCountedQty: Prisma.Decimal | null;
  /** Notes 153 — the loading charges are Σ (sviQty + sviFreeQty) × rate (loadingCharges). */
  sviQty: Prisma.Decimal;
  sviFreeQty: Prisma.Decimal;
  sviLoadRate: Prisma.Decimal;
  sviUnloadRate: Prisma.Decimal;
}
interface CountHoldingRow {
  sbl_lot_id: string;
  sbl_item_id: string;
  sbl_godown_id: string;
  sbl_bucket: string;
  sbl_base_uom_id: string;
  sbl_on_hand_qty: Prisma.Decimal | null;
  sbl_avg_cost_rate: Prisma.Decimal | null;
  sbl_avg_cost_rate_wot: Prisma.Decimal | null;
  sbl_batch_no: string | null;
  sbl_expiry_date: Date | null;
  sbl_mrp: Prisma.Decimal | null;
  sbl_sale_price: Prisma.Decimal | null;
  sbl_supplier_id: string | null;
  slt_mfg_date: Date | null;
  slt_serial_no: string | null;
}
/** The same row as the line writer needs it. */
interface CountHolding {
  itemId: string;
  baseUomId: string;
  bookQty: Prisma.Decimal;
  /** The holding's moving average, for a draft count's provisional net-variance value. */
  avgCostRate: Prisma.Decimal;
  avgCostRateWot: Prisma.Decimal;
  batchNo: string | null;
  mfgDate: Date | null;
  expiryDate: Date | null;
  mrp: Prisma.Decimal | null;
  salePrice: Prisma.Decimal | null;
  serialNo: string | null;
  supplierId: string | null;
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
  supplier_name: string | null;
  svh_to_branch_id: string | null;
  to_branch_name: string | null;
  svh_party_ref: string | null;
  svh_reason_id: string | null;
  reason_name: string | null;
  svh_link_src_module: string | null;
  svh_link_src_doc_type: string | null;
  svh_link_src_doc_id: string | null;
  svh_link_src_acc_year: string | null;
  svh_freeze_stock: boolean;
  svh_freeze_from: Date | null;
  svh_freeze_to: Date | null;
  svh_sync_date: Date | null;
  svh_status: string;
  svh_line_count: number;
  svh_total_qty: Prisma.Decimal;
  svh_total_value: Prisma.Decimal;
  svh_total_value_wot: Prisma.Decimal;
  // Not columns on stock_voucher any more: the header keeps svh_status alone and
  // these come from the public.txn_status_log laterals in the header query.
  posted_on: Date | null;
  posted_by: string | null;
  posted_by_name: string | null;
  cancelled_on: Date | null;
  cancel_reason: string | null;
  svh_created_on: Date;
  svh_created_by: string | null;
  created_by_name: string | null;
  svh_modified_on: Date | null;
  svh_rate_source: string | null;
  svh_remarks: string | null;
  svh_is_deleted: boolean;
  // Notes 153 — read on every type, mapped on a transfer only.
  svh_load_enabled: boolean;
  svh_load_datetime: Date | null;
  svh_loadman_id: string[] | null;
  loadman_names: (string | null)[] | null;
  svh_driver_id: string | null;
  driver_name: string | null;
  svh_supervisor_id: string | null;
  supervisor_name: string | null;
  svh_vehicle_id: string | null;
  svh_vehicle_no: string | null;
  svh_loading_charge: Prisma.Decimal;
  svh_unload_enabled: boolean;
  svh_unload_datetime: Date | null;
  svh_unloadman_id: string[] | null;
  unloadman_names: (string | null)[] | null;
  svh_unload_supervisor_id: string | null;
  unload_supervisor_name: string | null;
  svh_unloading_charge: Prisma.Decimal;
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
  svi_to_bucket: string | null;
  svi_barcode: string | null;
  svi_batch_no: string | null;
  svi_mfg_date: Date | null;
  svi_expiry_date: Date | null;
  svi_mrp: Prisma.Decimal | null;
  svi_sale_price: Prisma.Decimal | null;
  svi_serial_no: string | null;
  svi_supplier_id: string | null;
  line_supplier_name: string | null;
  svi_qty: Prisma.Decimal;
  svi_base_qty: Prisma.Decimal;
  svi_free_qty: Prisma.Decimal;
  svi_free_base_qty: Prisma.Decimal;
  svi_weight_qty: Prisma.Decimal;
  svi_book_qty: Prisma.Decimal | null;
  svi_counted_qty: Prisma.Decimal | null;
  svi_diff_qty: Prisma.Decimal | null;
  svi_cost_rate: Prisma.Decimal;
  svi_cost_rate_wot: Prisma.Decimal;
  svi_landed_rate: Prisma.Decimal;
  svi_tax_perc: Prisma.Decimal;
  svi_reason_id: string | null;
  line_reason_name: string | null;
  svi_direction: number | null;
  svi_sync_date: Date | null;
  svi_value: Prisma.Decimal | null;
  svi_value_wot: Prisma.Decimal | null;
  svi_lot_id: string | null;
  svi_remarks: string | null;
  svi_load_rate: Prisma.Decimal;
  svi_unload_rate: Prisma.Decimal;
  track_signature: string;
  sbd_size_id: string | null;
  size_name: string | null;
  sbd_colour_id: string | null;
  colour_name: string | null;
  sbd_model: string | null;
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
 * and stock_voucher_item — and hands the document to ONE engine. The lot, the
 * ledger row, the balance, the moving average, the transit rows and the header
 * totals at post are written by `StockPostingService` (the phases in
 * stock-voucher-posting.helper.ts). Nothing here inserts into stock_ledger,
 * touches stock_balance, or computes a posted header total; see the write
 * rules on the Prisma models.
 */
@Injectable()
export class StockVoucherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
    /**
     * §3.1 — the ONE stock engine. This module hands it a
     * `StockVoucherSource` and the service runs the seven phases, so a
     * delivery challan and a stock voucher move stock through exactly the
     * same code. The freeze guard lives there too, and now tests the
     * MOVEMENT's own timestamp rather than `now()`.
     */
    private readonly stockPosting: StockPostingService,
  ) {}
  // ──────────────────────────────────────────────────────────────────────────
  // §4 — save a draft
  // ──────────────────────────────────────────────────────────────────────────
  /**
   * Create when `header.svhId` is absent, update when present.
   *
   * ON UPDATE THE LINES ARE MATCHED BY ID, never by line number (notes 89). A
   * line that sends its `sviId` updates that row, a line without one is
   * inserted, and a stored line whose id is not sent is deleted — merging by
   * line number over a grid the user can insert into the middle of is exactly
   * where numbers drift apart from the rows they name. Lines only ever change
   * while the document is a DRAFT, which has no ledger rows, so nothing
   * downstream depends on a line's identity yet; History does.
   *
   * Every save writes ONE audit row holding the whole document before and after
   * it (AuditLogService.logDocumentRevision), instead of a header row plus a
   * "lines replaced" row that said nothing about the lines.
   */
  async save(
    rules: StockVoucherTypeRules,
    dto: SaveStockVoucherDto,
    /** Notes 151 #5 — run inside the save-and-post transaction, as post() runs them. */
    hooks?: StockPostHooks,
  ): Promise<StockVoucherSaveResult> {
    const { header } = dto;
    const actor = this.actorOf(header.userId);
    this.assertPayloadRules(rules, dto);
    await this.assertReasons(rules, dto);
    await this.assertCrew(rules, dto);
    // NOTHING HERE READS inventory.item_unit_conversion ANY MORE. uomId,
    // baseUomId and toBaseFactor arrive on the line and are written verbatim,
    // so there is no factor to look up and no base unit to resolve. The base
    // quantities must still equal qty × that factor (assertPayloadRules,
    // notes 143 #3), and the post's preflight refuses a unit or base unit that
    // is not the item's own.
    //
    // A COUNT still names no unit at all: svi_uom_id, svi_base_uom_id and the
    // factor are read from the balance row's sbl_base_uom_id with factor 1,
    // because the book figure the count is measured against is in the base
    // unit. Its route has its own line DTO, which omits all three.
    // 'POSTED' on the payload is an INSTRUCTION, not a column value — see the
    // DTO's status field. Anything else, including nothing, saves a draft.
    // `post: true` is the same instruction spelt the way every other document's
    // save body spells it (notes 94 B / 106).
    const postAfterSave = header.status === 'POSTED' || header.post === true;
    // ONE instant for the whole request. The CREATED row and the POSTED row of a
    // save-and-post used to take two clocks fifty milliseconds apart, with the
    // CREATED row stamped LATER — and a day-end query ordering by time then
    // called every posted opening a draft. Both rows take this one.
    const postedOn = new Date();
    const { svhId, rowsPosted, bookChanges } = await this.prisma.$transaction(async (tx) => {
      // Notes 143 #1 — THE ROW LOCK FIRST, and the DRAFT check under it. Read
      // without a lock, a save could pass its check, wait on a /post that held
      // the row, and then rewrite the lines and totals of a document that had
      // just POSTED. Under FOR UPDATE it waits, then reads POSTED and is refused.
      if (header.svhId) {
        const existing = await this.loadForWrite(
          tx,
          rules,
          header.svhId,
          header.accYear,
          header.companyId,
          header.branchId,
        );
        this.assertDraft(rules, existing);
      }
      // Notes 150 #2 — ONE FREEZE PER GODOWN AT A TIME, refused at save. The
      // preflight and the posting guard each exclude only the document being
      // posted, so two frozen drafts on one godown refuse each other's post
      // for good, until someone cancels one. Checked under the row lock, in
      // this transaction, so two saves racing for the same godown serialise.
      if (rules.allowsCount && header.freezeStock && header.freezeFrom && header.freezeTo) {
        await this.assertFreezeNotHeld(tx, header);
      }
      // Notes 89 — the document BEFORE this save, read before anything is
      // touched and in the shape /get returns; null on a create.
      const before = header.svhId
        ? await this.getById(
            rules,
            header.svhId,
            header.accYear,
            header.companyId,
            header.branchId,
            tx,
          )
        : null;
      // Textile plan D3 — a blank batch on a batch-tracked line gets its
      // number here, under the lock and in this transaction, so the lines are
      // written with it and /get shows it straight after the save.
      const batches = rules.autoBatchNo
        ? await assignAutoBatchNumbers(
            tx,
            {
              companyId: header.companyId,
              branchId: header.branchId,
              accYear: header.accYear,
              docDate: header.docDate,
              svhId: header.svhId,
            },
            dto.lines,
          )
        : null;
      const saved: SaveStockVoucherDto = batches ? { ...dto, lines: batches.lines } : dto;
      const { svhId: id, bookChanges } = header.svhId
        ? await this.updateDraft(tx, rules, saved, actor, postedOn)
        : await this.createDraft(tx, rules, saved, actor, postedOn);
      // Addendum 2 E2 — each auto-numbered line's size / colour / model, once
      // its line has an id.
      if (batches) {
        await syncBatchDetails(
          tx,
          {
            companyId: header.companyId,
            accYear: header.accYear,
            srcDocType: rules.voucherType,
            srcDocId: id,
            actor: this.auditActor(actor),
          },
          saved.lines,
          batches.numbered,
        );
      }
      if (!postAfterSave) {
        await this.logRevision(tx, rules, id, header, before, actor, false);
        return { svhId: id, rowsPosted: null as number | null, bookChanges };
      }
      // IN THE SAME TRANSACTION AS THE SAVE, and that is the whole point of
      // doing it here rather than calling post() afterwards: a document that
      // saved and then failed to post would be a draft the user believes is
      // posted, and one that posted and then failed to save cannot exist at
      // all. Either the lines are stored AND the stock moved, or neither.
      //
      // Both reads below are handed the transaction because the draft they are
      // about to check has not committed yet.
      //
      // Notes 143 #2 — and under the item locks, as post() does: see
      // lockForPreflight.
      await this.lockForPreflight(tx, rules, id, header.accYear);
      // Notes 151 #5 — the type's own rules, under the locks and over the
      // rows this save just wrote; the same hook post() runs.
      await hooks?.beforePost?.(tx, id);
      await this.assertPostable(rules, id, header.accYear, header.companyId, header.branchId, tx);
      const posted = await this.stockPosting.post(
        tx,
        new StockVoucherSource({
          svhId: id,
          accYear: header.accYear,
          companyId: header.companyId,
          branchId: header.branchId,
          rules,
        }),
        { actor, postedOn },
      );
      await hooks?.afterPost?.(tx, posted.rowsPosted, id);
      await this.logStatusChange(tx, {
        rules,
        svhId: id,
        accYear: header.accYear,
        companyId: header.companyId,
        branchId: header.branchId,
        tenantId: header.tenantId ?? null,
        refno: (await this.loadRefno(tx, id, header.accYear)) ?? id,
        // DRAFT whichever way in: createDraft wrote one a moment ago and
        // updateDraft refuses anything else, so the trail reads DRAFT → POSTED
        // even when the two steps arrived in one request.
        fromStatus: 'DRAFT',
        toStatus: posted.status,
        actor,
        changedOn: postedOn,
        remarks: `${rules.displayName} saved and posted — ${posted.rowsPosted} ledger rows`,
        deviceId: header.deviceId,
        sessionId: header.sessionId ?? null,
      });
      // After the post, so the revision records the document this request left
      // behind — posted, with the engine's totals.
      await this.logRevision(tx, rules, id, header, before, actor, true);
      return { svhId: id, rowsPosted: posted.rowsPosted, bookChanges };
    });
    const document = await this.getById(
      rules,
      svhId,
      header.accYear,
      header.companyId,
      header.branchId,
    );
    // Notes 150 #4 — each line says whether THIS save re-based its book figure,
    // so the screen's "stock moved since these lines were drawn" warning rests
    // on what the server did, not on what the client remembers.
    const rebased = new Map(bookChanges.map((change) => [change.sviId, change]));
    return {
      ...document,
      lines: document.lines.map((line) => ({
        ...line,
        bookChanged: rebased.has(line.sviId),
        previousBookQty: rebased.get(line.sviId)?.previousBookQty ?? null,
      })),
      rowsPosted,
      bookChanges,
    };
  }
  /**
   * Notes 89 — the ONE audit row of a save: the document after it, read inside
   * the transaction so the uncommitted lines are seen, beside the `before` the
   * save read first. History diffs the two; nothing here lists the changes.
   */
  private async logRevision(
    tx: Prisma.TransactionClient,
    rules: StockVoucherTypeRules,
    svhId: string,
    header: SaveStockVoucherDto['header'],
    before: StockVoucherPayload | null,
    actor: string,
    posted: boolean,
  ): Promise<void> {
    const after = await this.getById(
      rules,
      svhId,
      header.accYear,
      header.companyId,
      header.branchId,
      tx,
    );
    await this.auditLogService.logDocumentRevision(
      {
        screenName: rules.auditScreenName,
        tableName: STOCK_VOUCHER_TABLE_NAME,
        docId: svhId,
        displayName: after.header.refno,
        before,
        after,
        userId: actor,
        branchId: header.branchId,
        deviceId: header.deviceId,
        notes: `${rules.displayName} ${before ? 'updated' : 'created'}${posted ? ' and posted' : ''}`,
      },
      tx,
    );
  }
  /** The printed number, for a trail row written in the same breath as the post. */
  private async loadRefno(
    tx: Prisma.TransactionClient,
    svhId: string,
    accYear: string,
  ): Promise<string | null> {
    const row = await tx.stockVoucher.findUnique({
      where: { svhId_svhAccYear: { svhId, svhAccYear: accYear } },
      select: { svhRefno: true },
    });
    return row?.svhRefno ?? null;
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
            code: StockErrorCode.VOUCHER_TYPE_NOT_ALLOWED,
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
        code: StockErrorCode.TO_GODOWN_REQUIRED,
        message: `A ${rules.displayName} must name the godown the stock arrives in.`,
      });
    }
    if (rules.requiresFromGodown && !header.fromGodownId) {
      errors.push({
        field: 'fromGodownId',
        code: StockErrorCode.FROM_GODOWN_REQUIRED,
        message: `A ${rules.displayName} must name the godown the stock leaves from.`,
      });
    }
    // The DTO is shared by all eleven document types, so the fields that belong
    // to only one of them are gated here rather than being absent from it.
    if (rules.lineDirection !== 'REASON') {
      const signed = lines.findIndex(
        (line) => line.direction !== undefined && line.direction !== null,
      );
      if (signed >= 0) {
        errors.push({
          field: `lines.${signed}`,
          code: StockErrorCode.LINE_DIRECTION_NOT_ALLOWED,
          message: `Line ${lines[signed].lineNo}: only a stock adjustment states a direction per line; a ${rules.displayName.toLowerCase()} moves every line the same way.`,
        });
      }
    }
    // "Move stock" (postShape BUCKET_MOVE) is the one document whose lines name
    // a second bucket. Everywhere else the field would be a move the engine
    // never writes; on a move, a line without it would be a write-off with no
    // ledger row to say where the stock went.
    if (rules.postShape === 'BUCKET_MOVE') {
      lines.forEach((line, index) => {
        if (!line.toBucket) {
          errors.push({
            field: `lines.${index}.toBucket`,
            code: StockErrorCode.MOVE_TO_BUCKET_REQUIRED,
            message: `Line ${line.lineNo}: a stock move names the bucket the stock moves to.`,
          });
        } else if (line.toBucket === (line.bucket ?? 'SALEABLE')) {
          errors.push({
            field: `lines.${index}.toBucket`,
            code: StockErrorCode.MOVE_SAME_BUCKET,
            message: `Line ${line.lineNo}: moves stock from ${line.toBucket} into ${line.toBucket}. Pick a different bucket.`,
          });
        }
      });
    } else {
      const moved = lines.findIndex(
        (line) => line.toBucket !== undefined && line.toBucket !== null,
      );
      if (moved >= 0) {
        errors.push({
          field: `lines.${moved}.toBucket`,
          code: StockErrorCode.TO_BUCKET_NOT_ALLOWED,
          message: `Line ${lines[moved].lineNo}: only a stock move names a destination bucket; a ${rules.displayName.toLowerCase()} keeps the stock where it is.`,
        });
      }
    }
    if (!rules.allowsToBranch && header.toBranchId) {
      errors.push({
        field: 'toBranchId',
        code: StockErrorCode.TO_BRANCH_NOT_ALLOWED,
        message: `Only a transfer names the branch stock is going to; a ${rules.displayName.toLowerCase()} does not leave the branch.`,
      });
    }
    if (!rules.allowsCount) {
      if (header.freezeStock || header.freezeFrom || header.freezeTo) {
        errors.push({
          field: 'freezeStock',
          code: StockErrorCode.FREEZE_NOT_ALLOWED,
          message: `Only a physical count freezes stock; a ${rules.displayName.toLowerCase()} counts nothing.`,
        });
      }
      const counted = lines.findIndex(
        (line) => line.bookQty !== undefined && line.bookQty !== null,
      );
      const shelf = lines.findIndex(
        (line) => line.countedQty !== undefined && line.countedQty !== null,
      );
      const at = counted >= 0 ? counted : shelf;
      if (at >= 0) {
        // svi_diff_qty is GENERATED as counted − book and is what POSTS. On a
        // document that counted nothing it would post a variance nobody
        // entered, which is the one thing a generated column cannot be argued
        // out of afterwards.
        errors.push({
          field: `lines.${at}`,
          code: StockErrorCode.COUNT_FIELDS_NOT_ALLOWED,
          message: `Line ${lines[at].lineNo}: bookQty and countedQty belong to a physical count. A ${rules.displayName.toLowerCase()} states a quantity, it does not reconcile one.`,
        });
      }
    } else if (header.freezeStock && !(header.freezeFrom && header.freezeTo)) {
      // ck_svh_freeze refuses a freeze with no window, and would say so as a
      // constraint name rather than as a field.
      errors.push({
        field: 'freezeStock',
        code: StockErrorCode.FREEZE_WINDOW_REQUIRED,
        message:
          'A freeze needs both freezeFrom and freezeTo — without a window the count measures a moving target.',
      });
    }
    // Notes 153 — the Loading / Unloading boxes belong to a transfer. On any
    // other type they are a crew nothing moved and a charge nothing posts.
    if (!rules.allowsLoading) {
      const sent = loadingFieldSent(header);
      if (sent) {
        errors.push({
          field: sent,
          code: StockErrorCode.LOADING_NOT_ALLOWED,
          message: `Only a transfer records loading and unloading; a ${rules.displayName.toLowerCase()} names no crew, vehicle or loading charge.`,
        });
      }
      const rated = lines.findIndex(
        (line) =>
          this.toDecimalNumber(line.loadRate ?? 0) !== 0 ||
          this.toDecimalNumber(line.unloadRate ?? 0) !== 0,
      );
      if (rated >= 0) {
        errors.push({
          field: `lines.${rated}.loadRate`,
          code: StockErrorCode.LOADING_NOT_ALLOWED,
          message: `Line ${lines[rated].lineNo}: loading and unloading rates belong to a transfer line.`,
        });
      }
    } else {
      // "Not earlier than the doc date": the instant against the start of
      // that day on the shop's clock, so 00:30 IST on the doc date passes.
      const dayStart = Date.parse(`${header.docDate}T00:00:00+05:30`);
      for (const [field, value] of [
        ['loadDatetime', header.loadDatetime],
        ['unloadDatetime', header.unloadDatetime],
      ] as const) {
        const at = this.toInstant(value);
        if (at !== null && !Number.isNaN(dayStart) && at < dayStart) {
          errors.push({
            field,
            code: StockErrorCode.LOADING_BEFORE_DOC_DATE,
            message: `${field} ${istClockText(at)} is before the document date ${header.docDate}. Goods are loaded and unloaded on or after the day the transfer is dated.`,
          });
        }
      }
    }
    // ck_svh_link is all-or-nothing across the four source columns.
    const linkParts = [
      header.linkSrcModule,
      header.linkSrcDocType,
      header.linkSrcDocId,
      header.linkSrcAccYear,
    ];
    const linkGiven = linkParts.filter(
      (part) => part !== undefined && part !== null && part !== '',
    );
    if (linkGiven.length > 0 && linkGiven.length < linkParts.length) {
      errors.push({
        field: 'linkSrcModule',
        code: StockErrorCode.LINK_INCOMPLETE,
        message:
          'The source document is all four of linkSrcModule, linkSrcDocType, linkSrcDocId and linkSrcAccYear, or none of them (ck_svh_link).',
      });
    }
    if (!lines.length) {
      // A draft with no lines is allowed to EXIST — a user opens the screen,
      // fills the header and walks away — but not to be created empty by an
      // importer that resolved nothing.
      errors.push({ field: 'lines', code: StockErrorCode.LINES_REQUIRED, message: 'A document must have at least one line.' });
    }
    // Notes 143 #6 — the date must fall in the year the document is filed under.
    // "Already opened" keys on the YEAR, so an opening filed under 2027-2028 but
    // dated 2026-04-01 passed beside an opening of the same holding in
    // 2026-2027, and the holding was opened twice for one date.
    const dateYear = accYearOfDate(header.docDate);
    if (dateYear !== header.accYear.trim()) {
      errors.push({
        field: 'docDate',
        code: StockErrorCode.DOC_DATE_OUTSIDE_YEAR,
        message: `${header.docDate} falls in ${dateYear}, not in ${header.accYear.trim()}, the year this document is filed under.`,
      });
    }
    // ck_svh_freeze refuses a freeze with no window, and it refuses it from
    // Postgres with a constraint name. Caught here it is a 422 that says which
    // two fields are missing, BEFORE the check fires.
    if (header.freezeStock && (!header.freezeFrom || !header.freezeTo)) {
      errors.push({
        field: 'freezeFrom',
        code: StockErrorCode.FREEZE_WINDOW_REQUIRED,
        message:
          'A stock freeze needs a window: send freezeFrom and freezeTo as instants with an offset. The guard compares them to now(), not to the document date.',
      });
    }
    // Notes 150 #3 — see DOC_DATETIME_ONLINE_SKEW_MS. A movement's own time is
    // what the freeze and the day cut-off trust, so it may not wander from the
    // server clock unless the document declares the offline sync that explains
    // it, and then only within a week and never past the sync itself.
    const docDatetime = this.toInstant(header.docDatetime);
    if (docDatetime !== null) {
      const now = Date.now();
      const syncedAt = this.toInstant(header.syncDate);
      const skewMinutes = DOC_DATETIME_ONLINE_SKEW_MS / 60_000;
      if (syncedAt === null) {
        if (Math.abs(docDatetime - now) > DOC_DATETIME_ONLINE_SKEW_MS) {
          errors.push({
            field: 'docDatetime',
            code: StockErrorCode.DOC_DATETIME_OUT_OF_RANGE,
            message:
              `docDatetime ${istClockText(docDatetime)} is more than ${skewMinutes} minutes from the ` +
              `server clock (${istClockText(now)}). Leave it out to take the server's time; a device ` +
              'that keyed the document offline sends syncDate with it.',
          });
        }
      } else if (
        docDatetime > syncedAt + DOC_DATETIME_ONLINE_SKEW_MS ||
        syncedAt > now + DOC_DATETIME_ONLINE_SKEW_MS ||
        syncedAt - docDatetime > DOC_DATETIME_OFFLINE_MAX_MS
      ) {
        errors.push({
          field: 'docDatetime',
          code: StockErrorCode.DOC_DATETIME_OUT_OF_RANGE,
          message:
            `An offline document is keyed before it syncs, syncs no later than now, and trails its ` +
            `sync by at most 7 days: docDatetime ${istClockText(docDatetime)}, syncDate ` +
            `${istClockText(syncedAt)}, server clock ${istClockText(now)}.`,
        });
      }
    }
    // Compared as INSTANTS, not as strings: '…T20:00+05:30' sorts after
    // '…T23:00Z' lexically and before it in fact.
    const freezeFrom = this.toInstant(header.freezeFrom);
    const freezeTo = this.toInstant(header.freezeTo);
    if (freezeFrom !== null && freezeTo !== null && freezeTo <= freezeFrom) {
      errors.push({ field: 'freezeTo', code: StockErrorCode.FREEZE_WINDOW_ORDER, message: 'freezeTo must be after freezeFrom.' });
    }
    const isCount = rules.quantityMode === 'COUNT';
    // §17 open item 1: the counted godown is named ONCE, on the header, and
    // every line must be in it. Whichever side fn_svh_post reads, a count sheet
    // whose lines span two godowns is a sheet that counted one of them by
    // halves — and stock_balance is keyed per godown, so the book figures would
    // come from a different shelf than the header claims to have frozen.
    const countedGodownId = isCount ? (header.toGodownId ?? header.fromGodownId ?? null) : null;
    const derivableSource =
      header.rateSource !== null &&
      header.rateSource !== undefined &&
      (DERIVABLE_RATE_SOURCES as readonly string[]).includes(header.rateSource);
    const seen = new Map<string, number>();
    const holdingSeen = new Map<string, number>();
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
          code: StockErrorCode.LINE_DUPLICATE,
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
          code: StockErrorCode.LINE_QTY_NEGATIVE,
          message: `Line ${line.lineNo}: quantities are magnitudes and cannot be negative. A negative opening is an ADJUSTMENT.`,
        });
      } else if (!isCount && qty === 0 && freeQty === 0) {
        // UNDER COUNT THIS RULE INVERTS, which is why it is gated rather than
        // relaxed. A count sends qty 0 on every line, always — left as written
        // this refuses the whole document at save, one error per line.
        errors.push({
          field,
          code: StockErrorCode.LINE_QTY_REQUIRED,
          message: `Line ${line.lineNo} has no quantity.`,
        });
      }
      if (!isCount) {
        // Notes 143 #3 — THE BASE QUANTITY IS WHAT MOVES, so it must be the one
        // the line states. The ledger moves svi_base_qty (and skips a row at 0),
        // and nothing else re-derived it: {qty 5, baseQty 0} posted nothing,
        // {qty 1, factor 12, baseQty 1000} opened 1000, and a freeQty without
        // freeBaseQty posted no free goods. The line's OWN factor is the
        // reference — a document keeps the conversion it was keyed with (notes
        // 138) — and the product is compared at the columns' numeric(18,6).
        // Refused, never overwritten: the grid that computed it is told which line.
        const factor = this.toDecimalColumn(line.toBaseFactor);
        const baseQty = this.toDecimalColumn(line.qty).mul(factor).toDecimalPlaces(6);
        if (!this.toDecimalColumn(line.baseQty).toDecimalPlaces(6).equals(baseQty)) {
          errors.push({
            field: `${field}.baseQty`,
            code: StockErrorCode.LINE_BASE_QTY_MISMATCH,
            message: `Line ${line.lineNo}: baseQty ${line.baseQty} is not qty ${line.qty} × toBaseFactor ${line.toBaseFactor} = ${baseQty.toString()}.`,
          });
        }
        const freeBaseQty = this.toDecimalColumn(line.freeQty ?? 0).mul(factor).toDecimalPlaces(6);
        if (!this.toDecimalColumn(line.freeBaseQty ?? 0).toDecimalPlaces(6).equals(freeBaseQty)) {
          errors.push({
            field: `${field}.freeBaseQty`,
            code: StockErrorCode.LINE_FREE_BASE_QTY_MISMATCH,
            message: `Line ${line.lineNo}: freeBaseQty ${line.freeBaseQty ?? '(not sent)'} is not freeQty ${line.freeQty ?? 0} × toBaseFactor ${line.toBaseFactor} = ${freeBaseQty.toString()}.`,
          });
        }
      }
      if (!isCount && !line.uomId) {
        // uomId is optional on the SHARED DTO so that a count can omit it —
        // see SaveStockVoucherItemDto. On every other type svi_uom_id is NOT
        // NULL and nothing fills it in, so its absence is refused here rather
        // than reaching Postgres as a NOT NULL violation naming a column.
        errors.push({
          field,
          code: StockErrorCode.LINE_UNIT_REQUIRED,
          message: `Line ${line.lineNo} names no unit. uomId is an item_unit_conversion iuc_id, not a unit_id.`,
        });
      }
      if (isCount) {
        if (line.uomId) {
          // A count is taken in the BASE unit, because the book figure it is
          // measured against is held in the base unit. The unit therefore comes
          // from the balance row, and a unit in the payload is a client that
          // could point the line at a different one than the book figure.
          errors.push({
            field,
            code: StockErrorCode.COUNT_UNIT_NOT_ALLOWED,
            message: `Line ${line.lineNo}: a count line names no unit. It is counted in the base unit the book figure is held in, read from the balance row.`,
          });
        }
        if (qty !== 0 || freeQty !== 0) {
          // Refused, not silently zeroed: a client sending a quantity on a
          // count line thinks it is writing an adjustment, and an adjustment
          // that posts as a count is a variance nobody typed.
          errors.push({
            field,
            code: StockErrorCode.COUNT_QTY_NOT_ALLOWED,
            message: `Line ${line.lineNo}: a count line states what was FOUND, not a quantity to move. Send countedQty and leave qty at 0 — a quantity to move is an ADJUSTMENT.`,
          });
        }
        if (this.toDecimalNumber(line.costRate ?? 0) !== 0) {
          // §3.3 — the engine decides both directions. See the cost rule below.
          errors.push({
            field,
            code: StockErrorCode.COUNT_COST_NOT_ALLOWED,
            message: `Line ${line.lineNo}: a count line carries no cost rate. An overage is valued from the document's rate source; a shortage at what the stock cost us, stamped by the engine.`,
          });
        }
        if (this.readRefusedBookQty(line) !== undefined) {
          // svi_book_qty is an ordinary writable numeric column, so nothing in
          // the database stops a client sending its own book figure — and a
          // book figure the client chose turns a variance into a wish.
          errors.push({
            field,
            code: StockErrorCode.COUNT_BOOK_QTY_NOT_ALLOWED,
            message: `Line ${line.lineNo}: bookQty is read from stock_balance at save time and is never taken from the payload.`,
          });
        }
        if (line.countedQty === undefined || line.countedQty === null || line.countedQty === '') {
          // ABSENT IS NOT "0 FOUND", it is NOT COUNTED YET — and posting an
          // uncounted line as a total shortage is the single most expensive
          // mistake this screen can make.
          errors.push({
            field,
            code: StockErrorCode.COUNT_NOT_COUNTED,
            message: `Line ${line.lineNo} has not been counted yet. Send countedQty: 0 to record that nothing was found — absent means the counter has not reached this line.`,
          });
        } else if (this.toDecimalNumber(line.countedQty) < 0) {
          // What the operator TYPES is a count, so it is a magnitude. Only the
          // derived svi_diff_qty is signed.
          errors.push({
            field,
            code: StockErrorCode.COUNT_QTY_NEGATIVE,
            message: `Line ${line.lineNo}: countedQty is a count and cannot be negative. Only the derived difference is signed.`,
          });
        }
        if (!line.lotId) {
          // §3.4 — the lot is where the book figure came from, so a count line
          // cannot be typed from scratch. This is the "regenerate the count
          // sheet" path, caught before the balance lookup.
          errors.push({
            field,
            code: StockErrorCode.COUNT_HOLDING_REQUIRED,
            message: `Line ${line.lineNo} names no holding. A count line comes from the count sheet, which carries the lotId its book figure was read from.`,
          });
        }
        if (countedGodownId && line.godownId !== countedGodownId) {
          errors.push({
            field,
            code: StockErrorCode.COUNT_GODOWN_MISMATCH,
            message: `Line ${line.lineNo} is in a different godown than the one this count names. A count is per godown.`,
          });
        }
        // Notes 150 #1 — ONE LINE PER HOLDING. stock_balance's grain is godown
        // × lot × bucket, and two lines counting one holding post two variances
        // against one shelf: 3 and 3 against book 0 put +6 on a shelf holding
        // 3. ux_svi_line knows only line numbers, so this is the only guard.
        if (line.lotId) {
          const holding = this.holdingKey(line.lotId, line.godownId, line.bucket);
          const firstHoldingAt = holdingSeen.get(holding);
          if (firstHoldingAt !== undefined) {
            errors.push({
              field,
              code: StockErrorCode.COUNT_HOLDING_DUPLICATE,
              message: `Line ${line.lineNo} counts the same holding (lot, godown and bucket) as row ${firstHoldingAt + 1}. A holding is one line on a count sheet — put the whole count on that line.`,
            });
          } else {
            holdingSeen.set(holding, index);
          }
        }
      }
      // THE SAME COLUMN, REFUSED ON ONE TYPE AND REQUIRED ON THE NEXT.
      // fn_slt_resolve owns lot identity on an OPENING, so a client-chosen lot
      // there lets two documents open one holding under two lots. A TRANSFER is
      // the mirror image: it moves stock that already has an identity, the
      // destination keeps the same slt_id so ageing does not reset, and
      // fn_slt_resolve is never called on this path at all.
      if (rules.requiresLot) {
        if (!line.lotId) {
          errors.push({
            field,
            code: StockErrorCode.LINE_LOT_REQUIRED,
            message: `Line ${line.lineNo} names no lot. A ${rules.displayName.toLowerCase()} moves existing stock — pick the holding from the balance, which carries its lotId.`,
          });
        }
      } else if (!isCount && !rules.allowsLot && line.lotId) {
        // allowsLot (the adjustment family): an outward line picked from the
        // balance names its holding; an inward one leaves the engine to it.
        errors.push({
          field,
          code: StockErrorCode.LINE_LOT_NOT_ALLOWED,
          message: `Line ${line.lineNo}: a ${rules.displayName.toLowerCase()} does not choose its own lot. The engine resolves it at post.`,
        });
      }
      if (this.toDecimalNumber(line.weightQty ?? 0) < 0) {
        errors.push({
          field,
          code: StockErrorCode.LINE_WEIGHT_NEGATIVE,
          message: `Line ${line.lineNo}: weight is a magnitude and cannot be negative.`,
        });
      }
      // Notes 153 — ck_svi_load_rates, refused here per field so the grid can
      // mark the cell rather than read a constraint name.
      if (rules.allowsLoading) {
        for (const rate of ['loadRate', 'unloadRate'] as const) {
          if (this.toDecimalNumber(line[rate] ?? 0) < 0) {
            errors.push({
              field: `${field}.${rate}`,
              code: StockErrorCode.LOADING_RATE_NEGATIVE,
              message: `Line ${line.lineNo}: ${rate} ${line[rate]} is negative. A rate is what the crew is paid per unit, 0 or more.`,
            });
          }
        }
      }
      if (splitNo > 1 && !line.batchNo?.trim()) {
        // ck_svi_batch_split — a split only means anything when the line is
        // split BY BATCH.
        errors.push({
          field,
          code: StockErrorCode.LINE_SPLIT_BATCH_REQUIRED,
          message: `Line ${line.lineNo} split ${splitNo} needs a batch number.`,
        });
      }
      if (line.mfgDate && line.expiryDate && line.expiryDate < line.mfgDate) {
        // ck_svi_expiry_order
        errors.push({
          field,
          code: StockErrorCode.LINE_EXPIRY_BEFORE_MFG,
          message: `Line ${line.lineNo}: expiry ${line.expiryDate} is before manufacture ${line.mfgDate}.`,
        });
      }
      // Stripped in replaceLines, and REPORTED here — silently zeroing a rate
      // the user typed would leave the screen showing a cost the document does
      // not have. On a transfer there is nothing to type: the engine stamps the
      // policy cost on the OUT row and it travels to the IN row and the transit
      // row unchanged.
      if (
        rules.zeroesLineCost &&
        !isCount &&
        (this.toDecimalNumber(line.costRate ?? 0) !== 0 ||
          this.toDecimalNumber(line.costRateWot ?? 0) !== 0)
      ) {
        errors.push({
          field,
          code: StockErrorCode.LINE_COST_NOT_ALLOWED,
          message: `Line ${line.lineNo}: a ${rules.displayName.toLowerCase()} carries no cost rate. The stock is valued at what it cost where it came from, stamped by the engine, and that figure travels with it.`,
        });
      }
      // MANUAL does NOT excuse a zero cost — see DERIVABLE_RATE_SOURCES. The
      // plan words this check as "no cost rate and no rate source", which reads
      // as though all five sources excuse it; MANUAL derives nothing, so a
      // MANUAL document at cost 0 is an inward valued at nothing.
      //
      // AND IT IS A DOCUMENT-WIDE FLAG, which is right for an opening — inward
      // on every line — and wrong for a count, which moves stock BOTH ways at
      // once. Only an overage needs a rate, only the engine knows which lines
      // those are (svi_diff_qty is generated), and a shortage must be left at 0
      // on purpose so fn_sml_cost_default can stamp it. So under COUNT the
      // check moves to the preflight, where the difference exists — §3.5.
      //
      // AND IT MUST NOT FIRE WHERE THE COST IS THE ENGINE'S TO SUPPLY. A
      // TRANSFER_IN is inward — it is why `isInward` is true on it — but its
      // rate comes from `stt_cost_rate`, the figure stamped on the OUT row
      // weeks earlier, and the line is stripped to 0 on purpose so the engine
      // can. Left ungated, this check refuses every receipt line for having no
      // cost the receiving branch is not allowed to type.
      if (
        !isCount &&
        !rules.zeroesLineCost &&
        rules.isInward &&
        this.toDecimalNumber(line.costRate ?? 0) === 0 &&
        !derivableSource
      ) {
        errors.push({
          field,
          code: StockErrorCode.LINE_COST_REQUIRED,
          message: header.rateSource
            ? `Line ${line.lineNo} brings stock in at cost 0 and the rate source is ${header.rateSource}, which derives nothing. Type the cost rate.`
            : `Line ${line.lineNo} brings stock in at cost 0 and the document names no rate source. Set a cost rate, or a rateSource for the engine to derive one from.`,
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
   * Validates every `reasonId` the payload cites, header and lines together.
   *
   * `stock_reason_master` is LOAD-BEARING, not a dropdown label:
   * `fn_svh_txn_map` reads `srm_direction` to turn an ADJUSTMENT into
   * ADJUST_PLUS or ADJUST_MINUS, and believes a reason that names exactly one
   * txn type — an ISSUE citing SAMPLE posts as SAMPLE_ISSUE, not a bare
   * ADJUST_MINUS. So a reason that does not permit this voucher type does not
   * merely mislabel the document, it changes what the ledger records.
   *
   * COMPANY SCOPING IS A MERGE here, uniquely in this module: `srm_company_id`
   * NULL means SHARED with every company, and a company's own row with the same
   * code overrides the shared one. The lookup therefore accepts either, and the
   * override is resolved by preferring the company row.
   *
   * `srm_allowed_txn_types` empty means "any movement may cite it" — the
   * DEFAULT is `'{}'`, so an empty array is the permissive case, not a
   * misconfigured one.
   */
  private async assertReasons(
    rules: StockVoucherTypeRules,
    dto: SaveStockVoucherDto,
  ): Promise<void> {
    // Each reason is remembered with WHERE it was cited and whether that place
    // carried a remark, because srm_require_remarks is checked per citation:
    // the same "Damage" reason may be fine on the header and missing its
    // explanation on line 4.
    const cited = new Map<string, Array<{ field: string; remarks?: string | null }>>();
    const cite = (reasonId: string, field: string, remarks?: string | null) => {
      const at = cited.get(reasonId);
      if (at) {
        at.push({ field, remarks });
      } else {
        cited.set(reasonId, [{ field, remarks }]);
      }
    };
    if (dto.header.reasonId) {
      cite(dto.header.reasonId, 'reasonId', dto.header.remarks);
    }
    dto.lines.forEach((line, index) => {
      if (line.reasonId) {
        // A line with no remark of its own falls back to the document's: a
        // count explained once on the header has explained its lines too.
        cite(line.reasonId, `lines.${index}`, line.remarks ?? dto.header.remarks);
      }
    });
    if (!cited.size) {
      return;
    }
    const rows = await this.prisma.stockReasonMaster.findMany({
      where: {
        srmId: { in: [...cited.keys()] },
        srmIsDeleted: false,
        // The merge: the company's own rows and the shared ones together.
        OR: [{ srmCompanyId: dto.header.companyId }, { srmCompanyId: null }],
      },
      select: {
        srmId: true,
        srmCode: true,
        srmName: true,
        srmIsActive: true,
        srmAllowedTxnTypes: true,
        srmRequireRemarks: true,
      },
    });
    const byId = new Map(rows.map((row) => [row.srmId, row]));
    const errors: StockErrorDetail[] = [];
    for (const [reasonId, citations] of cited) {
      const [first] = citations;
      const reason = byId.get(reasonId);
      if (!reason) {
        errors.push({
          field: first.field,
          code: StockErrorCode.REASON_NOT_FOUND,
          message: `No stock reason ${reasonId} visible to this company. A reason is either the company's own or one shared with every company.`,
        });
        continue;
      }
      if (!reason.srmIsActive) {
        // Retired deliberately by an admin; quietly honouring it would undo
        // that decision one document at a time.
        errors.push({
          field: first.field,
          code: StockErrorCode.REASON_INACTIVE,
          message: `Stock reason ${reason.srmCode} (${reason.srmName}) is inactive.`,
        });
        continue;
      }
      const allowed = reason.srmAllowedTxnTypes ?? [];
      // MATCHED AGAINST THE LEDGER'S VOCABULARY, NOT THE DOCUMENT'S.
      //
      // srm_allowed_txn_types holds sml_txn_type values — the seed scopes its
      // count reasons to PHYSICAL_PLUS / PHYSICAL_MINUS and its adjustment
      // reasons to ADJUST_PLUS / ADJUST_MINUS. Compared against
      // rules.voucherType instead, EVERY seeded reason would be refused for the
      // document type it was written for; the mismatch went unnoticed only
      // because OPENING — whose document and ledger names coincide — cites no
      // reasons at all. rules.ledgerTxnTypes exists for exactly this, and a
      // PHYSICAL genuinely has two of them.
      //
      // An empty array is the PERMISSIVE case, not a misconfigured one: the
      // column defaults to '{}' and means "any movement may cite this".
      if (allowed.length && !allowed.some((txnType) => rules.ledgerTxnTypes.includes(txnType))) {
        errors.push({
          field: first.field,
          code: StockErrorCode.REASON_NOT_ALLOWED,
          message: `Stock reason ${reason.srmCode} (${reason.srmName}) may not be cited by a ${rules.displayName.toLowerCase()}; it is restricted to ${allowed.join(', ')}.`,
        });
        continue;
      }
      if (reason.srmRequireRemarks) {
        // The master says which reasons need explaining, so the rule is read
        // from it rather than reinvented as a second list in TypeScript. A
        // "Damage" line with no note is the row nobody can answer for later.
        for (const citation of citations) {
          if (!citation.remarks?.trim()) {
            errors.push({
              field: citation.field,
              code: StockErrorCode.REASON_REMARK_REQUIRED,
              message: `Stock reason ${reason.srmCode} (${reason.srmName}) requires a remark saying what happened.`,
            });
          }
        }
      }
    }
    if (errors.length) {
      throwStockUnprocessable<StockErrorDetail, StockErrorResponse>(
        'This document cites a stock reason it may not use',
        errors,
      );
    }
  }
  /**
   * Notes 153 — every crew member and the vehicle a transfer names is a live
   * row of the DOCUMENT's company, the check the sales documents make of their
   * crew (assertSalesmen). One read per table for the whole header, and each
   * refusal names its field. A crew list names a person once.
   */
  private async assertCrew(
    rules: StockVoucherTypeRules,
    dto: SaveStockVoucherDto,
  ): Promise<void> {
    if (!rules.allowsLoading) {
      return;
    }
    const { header } = dto;
    const one = (id: string | null | undefined) => (id ? [id] : []);
    const crew: Array<{ field: string; ids: string[] }> = [
      { field: 'loadmanIds', ids: header.loadmanIds ?? [] },
      { field: 'driverId', ids: one(header.driverId) },
      { field: 'supervisorId', ids: one(header.supervisorId) },
      { field: 'unloadmanIds', ids: header.unloadmanIds ?? [] },
      { field: 'unloadSupervisorId', ids: one(header.unloadSupervisorId) },
    ];
    const errors: StockErrorDetail[] = [];
    for (const { field, ids } of crew) {
      const twice = ids.find((id, at) => ids.indexOf(id) !== at);
      if (twice) {
        errors.push({
          field,
          code: StockErrorCode.LOADING_EMPLOYEE_INVALID,
          message: `${field} names ${twice} twice — one person is one member of a crew.`,
        });
      }
    }
    const named = [...new Set(crew.flatMap((entry) => entry.ids))];
    if (named.length) {
      const found = await this.prisma.$queryRaw<{ emp_id: string }[]>`
        SELECT emp_id
          FROM public.employee_master
         WHERE emp_id         = ANY(${named}::uuid[])
           AND emp_is_deleted = false
           AND emp_company_id = ${header.companyId}::uuid`;
      const live = new Set(found.map((row) => row.emp_id));
      for (const { field, ids } of crew) {
        const bad = ids.filter((id) => !live.has(id));
        if (bad.length) {
          errors.push({
            field,
            code: StockErrorCode.LOADING_EMPLOYEE_INVALID,
            message:
              `${field} names ${bad.length === 1 ? 'an employee' : 'employees'} that do not exist, ` +
              `are deleted, or belong to another company: ${bad.join(', ')}`,
          });
        }
      }
    }
    if (header.vehicleId) {
      const [vehicle] = await this.prisma.$queryRaw<{ veh_id: string }[]>`
        SELECT veh_id
          FROM public.vehicle_master
         WHERE veh_id         = ${header.vehicleId}::uuid
           AND veh_is_deleted = false
           AND veh_company_id = ${header.companyId}::uuid`;
      if (!vehicle) {
        errors.push({
          field: 'vehicleId',
          code: StockErrorCode.LOADING_VEHICLE_INVALID,
          message: `vehicleId ${header.vehicleId} is not a vehicle of this company (missing, deleted, or another company's).`,
        });
      }
    }
    if (errors.length) {
      throwStockUnprocessable<StockErrorDetail, StockErrorResponse>(
        `This ${rules.displayName.toLowerCase()} names a crew or vehicle it may not`,
        errors,
      );
    }
  }
  private async createDraft(
    tx: Prisma.TransactionClient,
    rules: StockVoucherTypeRules,
    dto: SaveStockVoucherDto,
    actor: string,
    /** The request's one instant — see save(). */
    now: Date,
  ): Promise<{ svhId: string; bookChanges: StockBookChange[] }> {
    const { header } = dto;
    const scope: StockVoucherNumberScope = {
      companyId: header.companyId,
      branchId: header.branchId,
      accYear: header.accYear,
      voucherType: rules.voucherType,
      deviceId: header.deviceId,
    };
    const { slno, refno } = await allocateStockVoucherNumber(
      tx,
      scope,
      rules.typeCode,
      { slno: header.slno, refno: header.refno },
      rules.refnoVchrTypeId,
    );
    const created = await tx.stockVoucher.create({
      data: {
        // svh_line_count / svh_total_qty / svh_total_value / svh_total_value_wot
        // are absent HERE but no longer absent from the document: they are
        // written from the payload by writeHeaderTotals, AFTER the lines. See
        // that method for why the order matters.
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
        svhToBranchId: header.toBranchId ?? null,
        svhSupplierId: header.supplierId ?? null,
        svhPartyRef: header.partyRef ?? null,
        svhReasonId: header.reasonId ?? null,
        svhRateSource: this.resolveRateSource(rules, header),
        svhRemarks: header.remarks ?? null,
        ...this.docDatetimeData(header),
        ...this.linkSourceData(header),
        ...this.freezeData(header),
        ...this.loadingData(rules, header),
        svhSyncDate: header.syncDate ? new Date(header.syncDate) : null,
        // THE PAYLOAD'S header.status IS NOT IGNORED — it is applied one step
        // later. Every document is INSERTED as a draft; when the caller asked
        // for 'POSTED', save() then posts it inside this same transaction and
        // the post is what writes svh_status and appends the POSTED step to
        // public.txn_status_log.
        //
        // The order is the guarantee, not an accident of layering: a row that
        // said POSTED here would be claiming stock had moved before a single
        // stock_ledger row existed, and if the preflight then refused a line
        // the caller would have watched a POSTED document appear and vanish.
        // Written this way the document only ever says POSTED after the ledger
        // and the balances behind it are there.
        svhStatus: 'DRAFT',
        // A CREATE writes created_by and nothing else — see the DTO's field.
        svhCreatedBy: this.actorFor(header.createdBy, actor),
      },
      select: { svhId: true, svhAccYear: true, svhRefno: true },
    });
    const written = await this.replaceLines(tx, rules, dto, created.svhId, actor, header.createdBy, now);
    await this.writeHeaderTotals(tx, rules, created.svhId, header, written);
    // The audit row is save()'s: one revision holding the whole document.
    // The first row of the voucher's trail. fromStatus NULL says the document
    // did not exist before this step; tslToStatus says what it was born as.
    await this.logStatusChange(tx, {
      rules,
      svhId: created.svhId,
      accYear: header.accYear,
      companyId: header.companyId,
      branchId: header.branchId,
      tenantId: header.tenantId ?? null,
      refno: created.svhRefno,
      fromStatus: null,
      toStatus: 'DRAFT',
      actor,
      changedOn: now,
      remarks: `${rules.displayName} created`,
      deviceId: header.deviceId,
      sessionId: header.sessionId ?? null,
    });
    return { svhId: created.svhId, bookChanges: written.bookChanges };
  }
  /**
   * THE TOTALS ARE THE SERVER'S (notes 150 #5; notes 143 asked first). Until
   * now svh_line_count / svh_total_qty / svh_total_value / svh_total_value_wot
   * were written verbatim from the header payload — a draft could claim 77
   * lines over 2 and a total of 999999 — and only a post corrected them. Every
   * save now sums the lines it just wrote, the way the post sums the ledger
   * (recomputeHeaderTotals), and the four header fields on the payload are
   * accepted for older clients and ignored.
   *
   * A DRAFT'S FIGURES ARE STILL PROVISIONAL — nothing has been valued by the
   * engine yet — but they are now the document's own:
   *   COUNT                 the NET variance: Σ (counted − book), valued at each
   *                         holding's moving average. May be negative.
   *   adjustment family     signed per line by the reason's direction.
   *   everything else       every line as a magnitude; value as svi_value is
   *                         GENERATED: round((base + free) × rate, 2).
   * A POST then overwrites all four from the ledger rows it wrote.
   *
   * Notes 153 — a transfer's two loading charges are written here too, from
   * the same lines (loadingCharges). Unlike the four totals a post leaves
   * them alone: what posts to accounts is what the saved document says.
   */
  private async writeHeaderTotals(
    tx: Prisma.TransactionClient,
    rules: StockVoucherTypeRules,
    svhId: string,
    header: SaveStockVoucherDto['header'],
    written: WrittenLines,
  ): Promise<void> {
    const totals = this.documentTotals(rules, written);
    await tx.stockVoucher.update({
      where: { svhId_svhAccYear: { svhId, svhAccYear: header.accYear } },
      data: {
        svhLineCount: totals.lineCount,
        svhTotalQty: totals.totalQty,
        svhTotalValue: totals.totalValue,
        svhTotalValueWot: totals.totalValueWot,
        ...(rules.allowsLoading ? this.loadingCharges(header, written) : {}),
      },
    });
  }
  /**
   * Notes 153 — svh_loading_charge / svh_unloading_charge, NEVER from the
   * body: round(Σ (qty + freeQty) × the line's rate, 2) while the box is
   * ticked, else 0. The labour is paid on what was CARRIED, so a free unit
   * counts; both quantities are in the line's own unit, as the rate is.
   * Rounded once, on the sum.
   */
  private loadingCharges(
    header: SaveStockVoucherDto['header'],
    written: WrittenLines,
  ): { svhLoadingCharge: Prisma.Decimal; svhUnloadingCharge: Prisma.Decimal } {
    const carried = (row: TotalsLine) => new Prisma.Decimal(row.sviQty).plus(row.sviFreeQty);
    const charge = (enabled: boolean | undefined, rate: 'sviLoadRate' | 'sviUnloadRate') =>
      enabled
        ? written.rows
            .reduce((sum, row) => sum.plus(carried(row).mul(row[rate])), new Prisma.Decimal(0))
            .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
        : new Prisma.Decimal(0);
    return {
      svhLoadingCharge: charge(header.loadEnabled, 'sviLoadRate'),
      svhUnloadingCharge: charge(header.unloadEnabled, 'sviUnloadRate'),
    };
  }
  /** The four header figures, summed from the lines a save wrote — see writeHeaderTotals. */
  private documentTotals(
    rules: StockVoucherTypeRules,
    written: WrittenLines,
  ): {
    lineCount: number;
    totalQty: Prisma.Decimal;
    totalValue: Prisma.Decimal;
    totalValueWot: Prisma.Decimal;
  } {
    const isCount = rules.quantityMode === 'COUNT';
    // As recomputeHeaderTotals nets them: a count and the per-line-reason
    // adjustment family carry a signed net; a move (BUCKET_MOVE) and every
    // other type carry a magnitude.
    const netted = rules.lineDirection === 'REASON' && rules.postShape !== 'BUCKET_MOVE';
    let totalQty = new Prisma.Decimal(0);
    let totalValue = new Prisma.Decimal(0);
    let totalValueWot = new Prisma.Decimal(0);
    for (const row of written.rows) {
      if (isCount) {
        const holding = written.holdings?.get(
          this.holdingKey(row.sviLotId, row.sviGodownId, row.sviBucket),
        );
        const diff = new Prisma.Decimal(row.sviCountedQty ?? 0).minus(row.sviBookQty ?? 0);
        totalQty = totalQty.plus(diff);
        totalValue = totalValue.plus(diff.mul(holding?.avgCostRate ?? 0).toDecimalPlaces(2));
        totalValueWot = totalValueWot.plus(
          diff.mul(holding?.avgCostRateWot ?? 0).toDecimalPlaces(2),
        );
        continue;
      }
      const sign = netted && row.sviDirection === -1 ? -1 : 1;
      const base = new Prisma.Decimal(row.sviBaseQty).plus(row.sviFreeBaseQty ?? 0);
      totalQty = totalQty.plus(base.mul(sign));
      totalValue = totalValue.plus(base.mul(row.sviCostRate).toDecimalPlaces(2).mul(sign));
      totalValueWot = totalValueWot.plus(
        base.mul(row.sviCostRateWot).toDecimalPlaces(2).mul(sign),
      );
    }
    return { lineCount: written.rows.length, totalQty, totalValue, totalValueWot };
  }
  /**
   * Notes 150 #2 — refuses a freeze on a godown another DRAFT count already
   * holds frozen over an overlapping window. Two open freezes block each
   * other's post for good: the preflight and StockPostingService.assertNotFrozen
   * each exclude only the document being posted.
   */
  private async assertFreezeNotHeld(
    tx: Prisma.TransactionClient,
    header: SaveStockVoucherDto['header'],
  ): Promise<void> {
    const godownId = header.toGodownId ?? header.fromGodownId ?? null;
    if (!godownId) {
      return;
    }
    const [held] = await tx.$queryRaw<
      { svh_refno: string; svh_freeze_from: Date; svh_freeze_to: Date }[]
    >`
      SELECT svh.svh_refno, svh.svh_freeze_from, svh.svh_freeze_to
        FROM stock.stock_voucher svh
       WHERE svh.svh_company_id   = ${header.companyId}::uuid
         AND svh.svh_branch_id    = ${header.branchId}::uuid
         -- ix_svh_freeze_open covers these four.
         AND svh.svh_voucher_type = 'PHYSICAL'
         AND svh.svh_freeze_stock = true
         AND svh.svh_status       = 'DRAFT'
         AND svh.svh_is_deleted   = false
         AND COALESCE(svh.svh_from_godown_id, svh.svh_to_godown_id) = ${godownId}::uuid
         -- Windows that touch: the other's start is before this end, and its
         -- end after this start.
         AND svh.svh_freeze_from <= ${header.freezeTo}::timestamptz
         AND svh.svh_freeze_to   >= ${header.freezeFrom}::timestamptz
         AND (${header.svhId ?? null}::uuid IS NULL OR svh.svh_id <> ${header.svhId ?? null}::uuid)
       ORDER BY svh.svh_freeze_from
       LIMIT 1`;
    if (!held) {
      return;
    }
    throwStockConflict<StockErrorDetail, StockErrorResponse>(
      `Godown already frozen for physical count ${held.svh_refno}`,
      [
        {
          field: 'freezeStock',
          code: StockErrorCode.FREEZE_GODOWN_HELD,
          message:
            `This godown is already frozen for physical count ${held.svh_refno} from ` +
            `${istClockText(held.svh_freeze_from)} to ${istClockText(held.svh_freeze_to)}. ` +
            'Two open freezes would refuse each other\'s post for good — count on that sheet, ' +
            'or post or cancel it first.',
        },
      ],
    );
  }
  /**
   * Notes 150 #8 — a POSTED count may not be cancelled once a LATER count has
   * posted on any of its holdings: the later count measured a book figure that
   * included this variance, and reversing it now would leave the shelf
   * disagreeing with the newer count. The answer is another count. A later
   * count that merely agreed with the book counts too — it posted no ledger
   * row, but it confirmed the figure this cancel would change — so the test
   * is on the documents' lines and their POSTED steps, not on the ledger.
   */
  private async assertCountNotSuperseded(
    tx: Prisma.TransactionClient,
    svhId: string,
    accYear: string,
    refno: string,
  ): Promise<void> {
    const [later] = await tx.$queryRaw<
      { later_refno: string; line_no: number; later_posted_on: Date }[]
    >`
      SELECT later.svh_refno   AS later_refno,
             mine.svi_line_no  AS line_no,
             lp.tsl_changed_on AS later_posted_on
        FROM stock.stock_voucher_item mine
        JOIN LATERAL (
          SELECT t.tsl_changed_on
            FROM public.txn_status_log t
           WHERE t.tsl_src_doc_id = mine.svi_voucher_id
             AND t.tsl_to_status  = 'POSTED'
             AND t.tsl_is_deleted = false
           ORDER BY t.tsl_changed_on DESC
           LIMIT 1
        ) mp ON true
        JOIN stock.stock_voucher_item other
          ON other.svi_lot_id     = mine.svi_lot_id
         AND other.svi_godown_id  = mine.svi_godown_id
         AND other.svi_bucket     = mine.svi_bucket
         AND other.svi_voucher_id <> mine.svi_voucher_id
         AND other.svi_is_deleted = false
        JOIN stock.stock_voucher later
          ON later.svh_id           = other.svi_voucher_id
         AND later.svh_acc_year     = other.svi_acc_year
         AND later.svh_voucher_type = 'PHYSICAL'
         AND later.svh_status       = 'POSTED'
         AND later.svh_is_deleted   = false
        JOIN LATERAL (
          SELECT t.tsl_changed_on
            FROM public.txn_status_log t
           WHERE t.tsl_src_doc_id = later.svh_id
             AND t.tsl_to_status  = 'POSTED'
             AND t.tsl_is_deleted = false
           ORDER BY t.tsl_changed_on DESC
           LIMIT 1
        ) lp ON true
       WHERE mine.svi_voucher_id = ${svhId}::uuid
         AND mine.svi_acc_year   = ${accYear}::bpchar
         AND mine.svi_is_deleted = false
         AND mine.svi_lot_id IS NOT NULL
         AND lp.tsl_changed_on > mp.tsl_changed_on
       ORDER BY mine.svi_line_no
       LIMIT 1`;
    if (!later) {
      return;
    }
    throwStockConflict<StockErrorDetail, StockErrorResponse>(
      `${refno} has been counted again by ${later.later_refno}`,
      [
        {
          field: 'svhId',
          code: StockErrorCode.COUNT_SUPERSEDED,
          message:
            `Line ${later.line_no} of ${refno} was counted again by ${later.later_refno}, posted ` +
            `${istClockText(later.later_posted_on)}. Cancelling ${refno} would undo an old variance ` +
            `under a newer count. Count the holding again instead.`,
        },
      ],
    );
  }
  private async updateDraft(
    tx: Prisma.TransactionClient,
    rules: StockVoucherTypeRules,
    dto: SaveStockVoucherDto,
    actor: string,
    /** The request's one instant — see save(). */
    now: Date,
  ): Promise<{ svhId: string; bookChanges: StockBookChange[] }> {
    const { header } = dto;
    const svhId = header.svhId as string;
    // Lines are written only while the header is DRAFT (the service discipline
    // that replaced tr_svh_post_lock / tr_svi_post_lock): IN_TRANSIT and
    // RECEIVED are as frozen as POSTED. save() has already locked the row and
    // checked that, so the update below cannot land on a document another
    // request posted in the meantime (notes 143 #1).
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
        svhToBranchId: header.toBranchId ?? null,
        svhSupplierId: header.supplierId ?? null,
        svhPartyRef: header.partyRef ?? null,
        svhReasonId: header.reasonId ?? null,
        svhRateSource: this.resolveRateSource(rules, header),
        svhRemarks: header.remarks ?? null,
        ...this.docDatetimeData(header),
        ...this.linkSourceData(header),
        ...this.freezeData(header),
        ...this.loadingData(rules, header),
        svhSyncDate: header.syncDate ? new Date(header.syncDate) : null,
        svhVersionNo: { increment: 1 },
        svhModifiedOn: now,
        // An UPDATE writes modified_by and NEVER touches created_by: who raised
        // the document is not something a later edit gets to change.
        svhModifiedBy: this.actorFor(header.modifiedBy, actor),
      },
    });
    const written = await this.replaceLines(tx, rules, dto, svhId, actor, header.modifiedBy, now);
    await this.writeHeaderTotals(tx, rules, svhId, header, written);
    // The audit row is save()'s: one revision holding the whole document.
    return { svhId, bookChanges: written.bookChanges };
  }
  /**
   * Writes the lines BY ID (notes 89; see save()): a line with `sviId` updates
   * that row — and only when one of its columns actually differs, so an
   * untouched line keeps its modified stamp — a line without one is inserted,
   * and a stored line the payload no longer names is deleted.
   *
   * A hard delete, not a soft one: these lines have never reached the ledger —
   * a DRAFT moves no stock — so there is nothing to preserve and everything to
   * gain from ux_svi_line staying clean.
   *
   * ux_svi_line is not deferrable, so a renumber is done in two steps: every
   * moving line is first parked above any real line number, then given its
   * final one. Swapping lines 1 and 2 would otherwise collide half way.
   */
  private async replaceLines(
    tx: Prisma.TransactionClient,
    rules: StockVoucherTypeRules,
    dto: SaveStockVoucherDto,
    svhId: string,
    actor: string,
    /**
     * Who is writing THESE lines — the header's createdBy on a create, its
     * modifiedBy on an update.
     *
     * It is not simply `header.createdBy`, and the difference shows on an
     * update: a save REPLACES the lines, so every row is inserted afresh and
     * takes a created_by from this save. Falling back to the header's createdBy
     * there would stamp the lines with the ORIGINAL author's name on an edit
     * somebody else made — the header keeps its created_by precisely so that
     * cannot happen, and the lines must not undo it.
     */
    author: string | null | undefined,
    /** The request's one instant — see save(). Stamps svi_modified_on on an updated line. */
    now: Date,
  ): Promise<WrittenLines> {
    const { header, lines } = dto;
    const stored = header.svhId
      ? await tx.stockVoucherItem.findMany({
          where: { sviVoucherId: svhId, sviAccYear: header.accYear, sviIsDeleted: false },
        })
      : null;
    this.assertLineIds(rules, lines, stored === null ? null : new Set(stored.map((r) => r.sviId)));
    const kept = new Set(lines.map((line) => line.sviId).filter((id): id is string => !!id));
    const dropped = (stored ?? []).filter((row) => !kept.has(row.sviId)).map((row) => row.sviId);
    if (dropped.length) {
      await tx.stockVoucherItem.deleteMany({
        where: { sviVoucherId: svhId, sviAccYear: header.accYear, sviId: { in: dropped } },
      });
    }
    if (!lines.length) {
      return { rows: [], holdings: null, bookChanges: [] };
    }
    const isCount = rules.quantityMode === 'COUNT';
    const zeroCost = isCount || rules.zeroesLineCost === true;
    const holdings = isCount ? await this.loadCountHoldings(tx, header, lines) : null;
    const data = lines.map((line) => {
      const holding = holdings?.get(this.holdingKey(line.lotId, line.godownId, line.bucket));
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
        sviUomId: isCount ? (holding as CountHolding).baseUomId : (line.uomId as string),
        // TAKEN FROM THE PAYLOAD, not resolved. The screen holds the
        // conversion it priced the line with; item_unit_conversion is not read.
        // A count is still the exception in both columns — it names no unit,
        // and is taken in the base unit the book figure is held in, at factor 1.
        sviBaseUomId: isCount ? (holding as CountHolding).baseUomId : line.baseUomId,
        sviToBaseFactor: isCount ? new Prisma.Decimal(1) : this.toDecimalColumn(line.toBaseFactor),
        sviGodownId: line.godownId,
        // svi_lot_id is ALWAYS NULL on save. fn_slt_resolve owns lot identity,
        // and only at post time: a client-chosen lot would let two documents
        // open the same holding under two different lots.
        // fn_slt_resolve owns lot identity on every QTY document — a
        // client-chosen lot on an OPENING would let two documents open the same
        // holding under two different lots. A COUNT is the exception: its line
        // comes from a count sheet that already names the holding whose book
        // figure it is reconciling, and re-resolving would find a different one.
        // A TRANSFER supplies it for the third reason again: the lot is the
        // thing being moved, and the destination must receive the SAME one.
        sviLotId: isCount || rules.requiresLot || rules.allowsLot ? (line.lotId ?? null) : null,
        sviBucket: (line.bucket ?? 'SALEABLE') satisfies StockBucket,
        // A move's destination; assertPayloadRules refuses it on every other shape.
        sviToBucket: rules.postShape === 'BUCKET_MOVE' ? (line.toBucket ?? null) : null,
        // Stored as scanned. The line was already identified by itemId /
        // batchNo / serialNo, so nothing here re-resolves through it.
        sviBarcode: line.barcode ?? null,
        // §5.2 — on a COUNT every one of these is a property of the HOLDING the
        // line already named by lotId, so they are copied from it rather than
        // taken from the payload: a count sheet with a client-supplied batch
        // number is a count sheet that can be pointed at the wrong lot, and the
        // printed sheet and the stored document would then disagree.
        sviBatchNo: isCount ? (holding as CountHolding).batchNo : (line.batchNo ?? null),
        sviMfgDate: isCount
          ? (holding as CountHolding).mfgDate
          : line.mfgDate
            ? new Date(`${line.mfgDate}T00:00:00Z`)
            : null,
        sviExpiryDate: isCount
          ? (holding as CountHolding).expiryDate
          : line.expiryDate
            ? new Date(`${line.expiryDate}T00:00:00Z`)
            : null,
        sviMrp: isCount ? (holding as CountHolding).mrp : this.toNullableDecimal(line.mrp),
        sviSalePrice: isCount
          ? (holding as CountHolding).salePrice
          : this.toNullableDecimal(line.salePrice),
        sviSerialNo: isCount ? (holding as CountHolding).serialNo : (line.serialNo ?? null),
        sviSupplierId: isCount ? (holding as CountHolding).supplierId : (line.supplierId ?? null),
        sviQty: isCount ? new Prisma.Decimal(0) : this.toDecimalColumn(line.qty),
        // The base quantities come from the payload as the grid computed them,
        // after assertPayloadRules has held them to qty × factor (notes 143
        // #3) — svi_value is GENERATED from these two, so they are what the
        // document is valued on. A count carries neither: its quantity is the
        // variance, and svi_diff_qty is GENERATED.
        sviBaseQty: isCount ? new Prisma.Decimal(0) : this.toDecimalColumn(line.baseQty),
        sviFreeQty: isCount ? new Prisma.Decimal(0) : this.toDecimalColumn(line.freeQty ?? 0),
        // On a QTY document this is OMITTED rather than defaulted when the
        // payload does not send it, so the column's own DEFAULT 0 applies. A
        // server-side `?? 0` here would be exactly the fallback that hides a
        // grid which forgot to fill it. A COUNT still writes an explicit 0:
        // its line carries no free quantity in either unit, and that is the
        // engine's contract rather than a missing payload value.
        ...(isCount
          ? { sviFreeBaseQty: new Prisma.Decimal(0) }
          : line.freeBaseQty === undefined
            ? {}
            : { sviFreeBaseQty: this.toDecimalColumn(line.freeBaseQty) }),
        // Weight is NOT derived from the quantity: a 10kg bag that weighs 9.7kg
        // opens at what the scale said, and no conversion factor knows that.
        sviWeightQty: this.toDecimalColumn(line.weightQty ?? 0),
        // PHYSICAL only, and refused for every other type in assertPayloadRules.
        // svi_diff_qty is GENERATED from the pair and is never sent.
        //
        // THE BOOK FIGURE IS READ, NEVER TAKEN. svi_book_qty is an ordinary
        // writable numeric column, so nothing in the database stops a client
        // sending its own — and a book figure the client chose turns a variance
        // into a wish. It is also a SNAPSHOT: never refreshed at post, never
        // recomputed on load, because it is what lets a variance be defended a
        // year later when stock_balance has moved on.
        sviBookQty: isCount
          ? (holding as CountHolding).bookQty
          : this.toNullableDecimal(line.bookQty),
        sviCountedQty: this.toNullableDecimal(line.countedQty),
        // §3.3 — 0 on a count, in both directions and on purpose. The overage
        // is valued from svh_rate_source inside fn_svh_post; the shortage is
        // left at 0 so the BEFORE trigger fn_sml_cost_default can stamp it from
        // the item's valuation policy.
        // §3.3 on a count; MUST-FIX 5 on a transfer. STRIPPED, not merely
        // undocumented: a nonzero rate on a TRANSFER_OUT line makes
        // fn_sml_cost_default bail — it only fills gaps — and 20's OUT insert
        // omits the value columns, so the ledger row lands at the typed rate
        // with value 0. Cost travels with the stock; nobody re-enters it.
        sviCostRate: zeroCost ? new Prisma.Decimal(0) : this.toDecimalColumn(line.costRate),
        // Left at 0 when not sent: the engine derives it from svi_tax_perc at
        // post and writes it back (20 ÷ 1.05 = 19.047619).
        sviCostRateWot: zeroCost
          ? new Prisma.Decimal(0)
          : this.toDecimalColumn(line.costRateWot ?? 0),
        sviLandedRate: zeroCost
          ? new Prisma.Decimal(0)
          : this.toDecimalColumn(line.landedRate ?? 0),
        sviTaxPerc: zeroCost ? new Prisma.Decimal(0) : this.toDecimalColumn(line.taxPerc ?? 0),
        // Notes 153 — a transfer line's per-unit rates, as the user left them;
        // 0 on every other type, where assertPayloadRules refuses them. At the
        // column's numeric(18,4) here, so the charge is summed from the rate
        // the line will actually hold.
        sviLoadRate: rules.allowsLoading
          ? this.toDecimalColumn(line.loadRate ?? 0).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP)
          : new Prisma.Decimal(0),
        sviUnloadRate: rules.allowsLoading
          ? this.toDecimalColumn(line.unloadRate ?? 0).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP)
          : new Prisma.Decimal(0),
        sviReasonId: line.reasonId ?? null,
        // The line's OWN sign, only where the rule record lets the reason
        // decide per line (the adjustment family); assertPayloadRules refuses
        // it everywhere else.
        sviDirection: rules.lineDirection === 'REASON' ? (line.direction ?? null) : null,
        sviSyncDate: line.syncDate ? new Date(line.syncDate) : null,
        sviRemarks: line.remarks ?? null,
        sviCreatedBy: this.actorFor(line.createdBy ?? author, actor),
        // Only when something actually supplies one — a line inserted by this
        // save that carried a modified_by would claim an edit that never
        // happened.
        ...this.lineModifiedByData(line.modifiedBy ?? header.modifiedBy, actor),
        // svi_value, svi_value_wot and svi_diff_qty are GENERATED ALWAYS ...
        // STORED and are absent from this object on purpose — Postgres rejects
        // any write to them, including a write of the value it would compute.
      };
    });
    const storedById = new Map((stored ?? []).map((row) => [row.sviId, row]));
    // Notes 150 #4 — a re-saved count line re-reads its book figure; when the
    // figure moved, say which line and from what, so the screen can warn.
    const bookChanges: StockBookChange[] = [];
    if (isCount) {
      lines.forEach((line, index) => {
        const row = line.sviId ? storedById.get(line.sviId) : undefined;
        const next = data[index].sviBookQty;
        if (!row || row.sviBookQty === null || next === null) {
          return;
        }
        if (!new Prisma.Decimal(row.sviBookQty).equals(next)) {
          bookChanges.push({
            sviId: row.sviId,
            lineNo: line.lineNo,
            previousBookQty: toNumber(row.sviBookQty),
            bookQty: toNumber(next),
          });
        }
      });
    }
    const changed: Array<{
      sviId: string;
      next: (typeof data)[number];
      line: SaveStockVoucherItemDto;
    }> = [];
    const moving: string[] = [];
    lines.forEach((line, index) => {
      const row = line.sviId ? storedById.get(line.sviId) : undefined;
      if (!row || !this.lineDiffers(row, data[index])) {
        return;
      }
      changed.push({ sviId: row.sviId, next: data[index], line });
      if (row.sviLineNo !== data[index].sviLineNo || row.sviSplitNo !== data[index].sviSplitNo) {
        moving.push(row.sviId);
      }
    });
    const key = (sviId: string) => ({ sviId_sviAccYear: { sviId, sviAccYear: header.accYear } });
    for (const [index, sviId] of moving.entries()) {
      await tx.stockVoucherItem.update({
        where: key(sviId),
        data: { sviLineNo: PARKED_LINE_NO + index },
      });
    }
    for (const { sviId, next, line } of changed) {
      // created_by is the line's author and stays; this save is its modifier.
      const fields: Record<string, unknown> = { ...next };
      delete fields.sviCreatedBy;
      await tx.stockVoucherItem.update({
        where: key(sviId),
        data: {
          ...(fields as Prisma.StockVoucherItemUncheckedUpdateInput),
          sviModifiedOn: now,
          sviModifiedBy: this.actorFor(line.modifiedBy ?? author, actor),
        },
      });
    }
    const inserted = data.filter((_, index) => !lines[index].sviId);
    if (inserted.length) {
      await tx.stockVoucherItem.createMany({ data: inserted });
    }
    return { rows: data, holdings, bookChanges };
  }
  /**
   * Notes 89 — a line id must name a live line of THIS document, once. A create
   * has no lines to name; a stale grid (lines another save dropped) is told to
   * reload rather than silently re-inserting what someone deleted.
   */
  private assertLineIds(
    rules: StockVoucherTypeRules,
    lines: readonly SaveStockVoucherItemDto[],
    stored: ReadonlySet<string> | null,
  ): void {
    const errors: StockErrorDetail[] = [];
    const seen = new Set<string>();
    lines.forEach((line, index) => {
      const id = line.sviId;
      if (!id) {
        return;
      }
      const field = `lines.${index}.sviId`;
      if (stored === null) {
        errors.push({
          field,
          code: StockErrorCode.LINE_ID_ON_NEW,
          message: `Line ${line.lineNo} sends line id ${id}, but a new ${rules.displayName.toLowerCase()} has no lines yet. Send it without sviId.`,
        });
      } else if (seen.has(id)) {
        errors.push({
          field,
          code: StockErrorCode.LINE_ID_REPEATED,
          message: `Line ${line.lineNo} repeats line id ${id}: one stored line cannot become two.`,
        });
      } else if (!stored.has(id)) {
        errors.push({
          field,
          code: StockErrorCode.LINE_ID_STALE,
          message: `Line ${line.lineNo} names line ${id}, which is not a line of this document any more. Reload it and save again.`,
        });
      }
      seen.add(id);
    });
    if (errors.length) {
      throwStockUnprocessable<StockErrorDetail, StockErrorResponse>(
        `This ${rules.displayName.toLowerCase()} cannot be saved`,
        errors,
      );
    }
  }
  /** Whether the line about to be written differs from the stored row in any column it sets. */
  private lineDiffers(stored: object, next: object): boolean {
    const row = stored as Record<string, unknown>;
    return Object.entries(next).some(
      ([column, value]) =>
        value !== undefined &&
        column !== 'sviCreatedBy' &&
        column !== 'sviModifiedBy' &&
        !this.sameColumnValue(row[column], value),
    );
  }
  private sameColumnValue(left: unknown, right: unknown): boolean {
    if (left === null || left === undefined || right === null || right === undefined) {
      return (left ?? null) === (right ?? null);
    }
    if (Prisma.Decimal.isDecimal(left) || Prisma.Decimal.isDecimal(right)) {
      return new Prisma.Decimal(left as Prisma.Decimal.Value).equals(
        new Prisma.Decimal(right as Prisma.Decimal.Value),
      );
    }
    if (left instanceof Date && right instanceof Date) {
      return left.getTime() === right.getTime();
    }
    return left === right;
  }
  /**
   * §3.4 — the holdings a count's lines name, read back from `stock_balance`
   * in ONE query, inside the same transaction that writes the lines.
   *
   * The client tells the server WHICH HOLDING, never how much was in it. Every
   * `lotId` must come back from a live balance row for this company, branch,
   * godown, item and bucket; the book quantity, the base unit and every
   * identity column of the line are then read off that row.
   *
   * A lotId with no matching balance row is a 422 rather than a silent null,
   * and the message says what to do about it. It is not a hypothetical: it is
   * exactly what happens when someone sells the last of a lot mid-count, and
   * the sheet the operator is holding is then a sheet about a holding that no
   * longer exists.
   *
   * One query with `= ANY(...)`, not one per line: a warehouse sheet is a
   * thousand lines, and a thousand round trips inside an open transaction is
   * how a save holds locks for a minute.
   */
  private async loadCountHoldings(
    tx: Prisma.TransactionClient,
    header: SaveStockVoucherDto['header'],
    lines: readonly SaveStockVoucherItemDto[],
  ): Promise<Map<string, CountHolding>> {
    const lotIds = [...new Set(lines.map((line) => line.lotId).filter((id): id is string => !!id))];
    const rows = lotIds.length
      ? await tx.$queryRaw<CountHoldingRow[]>`
          SELECT sbl.sbl_lot_id,
                 sbl.sbl_item_id,
                 sbl.sbl_godown_id,
                 sbl.sbl_bucket,
                 sbl.sbl_base_uom_id,
                 sbl.sbl_on_hand_qty,
                 sbl.sbl_avg_cost_rate,
                 sbl.sbl_avg_cost_rate_wot,
                 sbl.sbl_batch_no,
                 sbl.sbl_expiry_date,
                 sbl.sbl_mrp,
                 sbl.sbl_sale_price,
                 sbl.sbl_supplier_id,
                 -- stock_balance carries neither, and a count line must still
                 -- reprint what the sheet showed: both live on the lot.
                 slt.slt_mfg_date,
                 slt.slt_serial_no
            FROM stock.stock_balance sbl
            JOIN stock.stock_lot slt ON slt.slt_id = sbl.sbl_lot_id
           WHERE sbl.sbl_company_id = ${header.companyId}::uuid
             AND sbl.sbl_branch_id  = ${header.branchId}::uuid
             AND sbl.sbl_lot_id     = ANY (${lotIds}::uuid[])
             AND sbl.sbl_is_deleted = false
        `
      : [];
    const byHolding = new Map<string, CountHolding>();
    for (const row of rows) {
      byHolding.set(this.holdingKey(row.sbl_lot_id, row.sbl_godown_id, row.sbl_bucket), {
        itemId: row.sbl_item_id,
        baseUomId: row.sbl_base_uom_id,
        // sbl_on_hand_qty is GENERATED (in − out), so it is never null on a
        // live row; the coalesce is for the type, not for the data.
        bookQty: new Prisma.Decimal(row.sbl_on_hand_qty ?? 0),
        avgCostRate: new Prisma.Decimal(row.sbl_avg_cost_rate ?? 0),
        avgCostRateWot: new Prisma.Decimal(row.sbl_avg_cost_rate_wot ?? 0),
        batchNo: row.sbl_batch_no,
        mfgDate: row.slt_mfg_date,
        expiryDate: row.sbl_expiry_date,
        mrp: row.sbl_mrp,
        salePrice: row.sbl_sale_price,
        serialNo: row.slt_serial_no,
        supplierId: row.sbl_supplier_id,
      });
    }
    const errors: StockErrorDetail[] = [];
    lines.forEach((line, index) => {
      const holding = byHolding.get(this.holdingKey(line.lotId, line.godownId, line.bucket));
      if (!holding) {
        errors.push({
          field: `lines.${index}`,
          code: StockErrorCode.COUNT_HOLDING_GONE,
          message: `Line ${line.lineNo} names a holding this godown no longer has — regenerate the count sheet. (Someone may have sold the last of this lot while the count was being taken.)`,
        });
        return;
      }
      if (holding.itemId !== line.itemId) {
        // The lot is the holding's identity, so an item that disagrees with it
        // means the line was assembled from two different sheets.
        errors.push({
          field: `lines.${index}`,
          code: StockErrorCode.COUNT_HOLDING_OTHER_ITEM,
          message: `Line ${line.lineNo} names a holding that belongs to another item — regenerate the count sheet.`,
        });
      }
    });
    if (errors.length) {
      throwStockUnprocessable<StockErrorDetail, StockErrorResponse>(
        'This count sheet is out of date',
        errors,
      );
    }
    return byHolding;
  }
  /** stock_balance's own grain: one holding per godown × lot × bucket. */
  private holdingKey(
    lotId: string | null | undefined,
    godownId: string,
    bucket: string | null | undefined,
  ): string {
    return `${lotId ?? ''}|${godownId}|${bucket ?? 'SALEABLE'}`;
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
          | 'posted_on'
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
             posted.tsl_changed_on AS posted_on,
             svh.svh_rate_source,
             svh.svh_remarks
        FROM stock.stock_voucher svh
        LEFT JOIN inventory.godown_locations gdl ON gdl.gdl_id = svh.svh_to_godown_id
        -- WHEN it was posted lives on the trail, not on the header. Keyed on
        -- (doc type, doc id, acc year) so ux_tsl_doc_seq serves the lookup; a
        -- re-post after a cancellation appends a second POSTED row, and the
        -- LATEST one is the answer the list wants.
        LEFT JOIN LATERAL (
          SELECT tsl.tsl_changed_on
            FROM public.txn_status_log tsl
           WHERE tsl.tsl_src_doc_type = ${rules.statusDocType}
             AND tsl.tsl_src_doc_id   = svh.svh_id
             AND tsl.tsl_acc_year     = svh.svh_acc_year
             AND tsl.tsl_to_status    = 'POSTED'
             AND tsl.tsl_is_deleted   = false
           ORDER BY tsl.tsl_seq_no DESC
           LIMIT 1
        ) posted ON true
       WHERE svh.svh_company_id   = ${query.companyId}::uuid
         AND svh.svh_branch_id    = ${query.branchId}::uuid
         AND svh.svh_acc_year     = ${query.accYear}::bpchar
         AND svh.svh_voucher_type = ${rules.voucherType}
         AND svh.svh_is_deleted   = false
         AND (${query.status ?? null}::varchar IS NULL OR svh.svh_status = ${query.status ?? null}::varchar)
         AND (${query.fromDate ?? null}::date IS NULL OR svh.svh_doc_date >= ${query.fromDate ?? null}::date)
         AND (${query.toDate ?? null}::date   IS NULL OR svh.svh_doc_date <= ${query.toDate ?? null}::date)
         AND ${looseSearchSql(['svh.svh_refno', 'svh.svh_usr_refno'], query.search)}
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
        postedOn: row.posted_on?.toISOString() ?? null,
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
    /** The save's transaction, so a revision snapshot sees its uncommitted lines (notes 89). */
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<StockVoucherPayload> {
    const [header] = await client.$queryRaw<HeaderRow[]>`
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
             sup.sup_name AS supplier_name,
             svh.svh_to_branch_id,
             tbr.br_name AS to_branch_name,
             svh.svh_party_ref,
             svh.svh_reason_id,
             srm.srm_name AS reason_name,
             svh.svh_link_src_module,
             svh.svh_link_src_doc_type,
             svh.svh_link_src_doc_id,
             svh.svh_link_src_acc_year,
             svh.svh_freeze_stock,
             svh.svh_freeze_from,
             svh.svh_freeze_to,
             svh.svh_sync_date,
             svh.svh_status,
             svh.svh_line_count,
             svh.svh_total_qty,
             svh.svh_total_value,
             svh.svh_total_value_wot,
             posted.tsl_changed_on AS posted_on,
             posted.tsl_changed_by AS posted_by,
             usr.usr_display_name  AS posted_by_name,
             cancelled.tsl_changed_on AS cancelled_on,
             cancelled.tsl_remarks    AS cancel_reason,
             svh.svh_created_on,
             svh.svh_created_by,
             cusr.usr_display_name AS created_by_name,
             svh.svh_modified_on,
             svh.svh_rate_source,
             svh.svh_remarks,
             svh.svh_is_deleted,
             -- Notes 153 — the Loading / Unloading boxes, with the names behind
             -- the ids. A crew keeps its order; an employee gone since reads NULL
             -- in its place rather than shortening the list.
             svh.svh_load_enabled,
             svh.svh_load_datetime,
             svh.svh_loadman_id,
             ARRAY(SELECT e.emp_name
                     FROM unnest(svh.svh_loadman_id) WITH ORDINALITY AS crew(id, ord)
                     LEFT JOIN public.employee_master e ON e.emp_id = crew.id
                    ORDER BY crew.ord) AS loadman_names,
             svh.svh_driver_id,
             drv.emp_name AS driver_name,
             svh.svh_supervisor_id,
             lsv.emp_name AS supervisor_name,
             svh.svh_vehicle_id,
             svh.svh_vehicle_no,
             svh.svh_loading_charge,
             svh.svh_unload_enabled,
             svh.svh_unload_datetime,
             svh.svh_unloadman_id,
             ARRAY(SELECT e.emp_name
                     FROM unnest(svh.svh_unloadman_id) WITH ORDINALITY AS crew(id, ord)
                     LEFT JOIN public.employee_master e ON e.emp_id = crew.id
                    ORDER BY crew.ord) AS unloadman_names,
             svh.svh_unload_supervisor_id,
             usv.emp_name AS unload_supervisor_name,
             svh.svh_unloading_charge
        FROM stock.stock_voucher svh
        LEFT JOIN inventory.godown_locations fgd ON fgd.gdl_id = svh.svh_from_godown_id
        LEFT JOIN inventory.godown_locations tgd ON tgd.gdl_id = svh.svh_to_godown_id
        LEFT JOIN purchase.suppliers sup ON sup.sup_id = svh.svh_supplier_id
        -- Notes 154 #4 — the branch a transfer goes to, by name.
        LEFT JOIN public.branch_master tbr ON tbr.br_id = svh.svh_to_branch_id
        -- Who posted or cancelled this, when, and why: public.txn_status_log is
        -- the only record of it — the header carries svh_status alone. Both
        -- laterals take the LATEST matching step, so a voucher posted, cancelled
        -- and posted again reads back its current post, not its first.
        LEFT JOIN LATERAL (
          SELECT tsl.tsl_changed_on, tsl.tsl_changed_by
            FROM public.txn_status_log tsl
           WHERE tsl.tsl_src_doc_type = ${rules.statusDocType}
             AND tsl.tsl_src_doc_id   = svh.svh_id
             AND tsl.tsl_acc_year     = svh.svh_acc_year
             AND tsl.tsl_to_status    = 'POSTED'
             AND tsl.tsl_is_deleted   = false
           ORDER BY tsl.tsl_seq_no DESC
           LIMIT 1
        ) posted ON true
        LEFT JOIN LATERAL (
          SELECT tsl.tsl_changed_on, tsl.tsl_remarks
            FROM public.txn_status_log tsl
           WHERE tsl.tsl_src_doc_type = ${rules.statusDocType}
             AND tsl.tsl_src_doc_id   = svh.svh_id
             AND tsl.tsl_acc_year     = svh.svh_acc_year
             AND tsl.tsl_to_status    = 'CANCELLED'
             AND tsl.tsl_is_deleted   = false
           ORDER BY tsl.tsl_seq_no DESC
           LIMIT 1
        ) cancelled ON true
        LEFT JOIN public.user_master usr         ON usr.usr_id = posted.tsl_changed_by
        -- svh_created_by is free TEXT (a user id, a till, an import job), so the
        -- match is on text: a value that is not a uuid finds no user, not a 500.
        LEFT JOIN public.user_master cusr        ON cusr.usr_id::text = svh.svh_created_by
        LEFT JOIN stock.stock_reason_master srm  ON srm.srm_id = svh.svh_reason_id
        LEFT JOIN public.employee_master drv     ON drv.emp_id = svh.svh_driver_id
        LEFT JOIN public.employee_master lsv     ON lsv.emp_id = svh.svh_supervisor_id
        LEFT JOIN public.employee_master usv     ON usv.emp_id = svh.svh_unload_supervisor_id
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
        StockErrorCode.VOUCHER_NOT_FOUND,
      );
    }
    // Notes 153 E5 — a transfer line names the LOT it moves and keys no
    // identity of its own, so its batch / dates / MRP / serial are read from
    // that lot (the lot first, as the engine attaches a picked lot), and a
    // reopened transfer shows which batch moved. Other types read the line.
    const identityFromLot = rules.requiresLot === true;
    const lines = await client.$queryRaw<LineRow[]>`
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
             svi.svi_to_bucket,
             svi.svi_barcode,
             COALESCE(lot.slt_batch_no, svi.svi_batch_no)       AS svi_batch_no,
             COALESCE(lot.slt_mfg_date, svi.svi_mfg_date)       AS svi_mfg_date,
             COALESCE(lot.slt_expiry_date, svi.svi_expiry_date) AS svi_expiry_date,
             COALESCE(lot.slt_mrp, svi.svi_mrp)                 AS svi_mrp,
             COALESCE(lot.slt_sale_price, svi.svi_sale_price)   AS svi_sale_price,
             COALESCE(lot.slt_serial_no, svi.svi_serial_no)     AS svi_serial_no,
             svi.svi_supplier_id,
             sup.sup_name AS line_supplier_name,
             svi.svi_qty,
             svi.svi_base_qty,
             svi.svi_free_qty,
             svi.svi_free_base_qty,
             svi.svi_weight_qty,
             svi.svi_book_qty,
             svi.svi_counted_qty,
             svi.svi_diff_qty,
             svi.svi_cost_rate,
             svi.svi_cost_rate_wot,
             svi.svi_landed_rate,
             svi.svi_tax_perc,
             svi.svi_reason_id,
             srm.srm_name AS line_reason_name,
             svi.svi_direction,
             svi.svi_sync_date,
             svi.svi_value,
             svi.svi_value_wot,
             svi.svi_lot_id,
             svi.svi_remarks,
             svi.svi_load_rate,
             svi.svi_unload_rate,
             -- Which identity cells the line may open, as /stock/opening/item-lookup
             -- answers it: the effective policy on the DOCUMENT's date, the one
             -- the preflight and the post key the lot by. Saves the screen a
             -- lookup per distinct item after every load (notes 66).
             COALESCE(stp.stp_track_signature, 'N') AS track_signature,
             -- Addendum 2 E2: the size / colour / model this line's auto
             -- batch carries, by the row the line wrote — retired rows too,
             -- matched on the batch the line still holds, so a cancelled
             -- draft (notes 149 #3) still reads what was keyed while a line
             -- whose batch was typed over since shows nothing. Notes 151 #8:
             -- a line that wrote no row (an adjustment, a count, an issue
             -- naming a batch an opening numbered) reads the batch's LIVE
             -- row by company + item + folded batch instead.
             sbd.sbd_size_id,
             isz.isz_name AS size_name,
             sbd.sbd_colour_id,
             icl.icl_name AS colour_name,
             sbd.sbd_model
        FROM stock.stock_voucher_item svi
        JOIN inventory.item_master itm            ON itm.item_id = svi.svi_item_id
        -- Joined on a transfer only (E5 above); elsewhere every lot.* is NULL.
        LEFT JOIN stock.stock_lot lot             ON ${identityFromLot}::boolean
                                                 AND lot.slt_id = svi.svi_lot_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = svi.svi_uom_id
        LEFT JOIN inventory.item_unit_master unt  ON unt.unit_id = iuc.iuc_unit_id
        LEFT JOIN inventory.godown_locations gdl  ON gdl.gdl_id = svi.svi_godown_id
        LEFT JOIN stock.stock_reason_master srm   ON srm.srm_id = svi.svi_reason_id
        LEFT JOIN purchase.suppliers sup          ON sup.sup_id = svi.svi_supplier_id
        LEFT JOIN LATERAL (
          SELECT d.sbd_size_id, d.sbd_colour_id, d.sbd_model
            FROM stock.stock_batch_detail d
           WHERE d.sbd_batch_no = upper(btrim(COALESCE(lot.slt_batch_no, svi.svi_batch_no)))
             AND (d.sbd_src_line_id = svi.svi_id
                  OR (d.sbd_company_id = ${companyId}::uuid
                      AND d.sbd_item_id = svi.svi_item_id
                      AND d.sbd_is_deleted = false))
           -- The line's own row first (retired or not), else the live one.
           ORDER BY (d.sbd_src_line_id = svi.svi_id) DESC NULLS LAST, d.sbd_is_deleted
           LIMIT 1
        ) sbd ON true
        LEFT JOIN inventory.item_size_master isz   ON isz.isz_id = sbd.sbd_size_id
        LEFT JOIN inventory.item_colour_master icl ON icl.icl_id = sbd.sbd_colour_id
        ${effectivePolicyLateral({
          companyId: Prisma.sql`${companyId}::uuid`,
          branchId: Prisma.sql`${branchId}::uuid`,
          itemId: Prisma.raw('svi.svi_item_id'),
          itemGroupId: Prisma.raw('itm.item_group_id'),
          onDate: Prisma.sql`${this.toIsoDate(header.svh_doc_date)}::date`,
        })}
       WHERE svi.svi_voucher_id = ${svhId}::uuid
         AND svi.svi_acc_year   = ${accYear}::bpchar
         AND svi.svi_is_deleted = false
       ORDER BY svi.svi_line_no, svi.svi_split_no
    `;
    return {
      header: this.toHeaderPayload(header, rules),
      lines: lines.map((row) => this.toLinePayload(row, rules)),
    };
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
    /** See loadHeaderOrThrow — the save-and-post path validates its own uncommitted draft. */
    tx?: Prisma.TransactionClient,
  ): Promise<StockVoucherLineProblem[]> {
    // Presence check first: Q3 on a voucher that does not exist returns zero
    // rows, which reads identically to "no problems".
    await this.loadHeaderOrThrow(rules, svhId, accYear, companyId, branchId, tx);
    const isCount = rules.quantityMode === 'COUNT';
    // Only a SIMPLE document's OUTWARD lines pick (§1.4): opening and count
    // lines carry identity by construction, and a transfer's lot is mandatory.
    // Which lines are outward is the line's direction — the document's, or
    // the reason's on an adjustment.
    const canPick = rules.postShape === 'SIMPLE' && rules.quantityMode === 'QTY';
    return (tx ?? this.prisma).$queryRaw<StockVoucherLineProblem[]>`
      WITH doc AS (
        SELECT svh.svh_id,
               svh.svh_acc_year,
               svh.svh_company_id,
               svh.svh_branch_id,
               svh.svh_doc_date,
               svh.svh_doc_datetime,
               svh.svh_rate_source,
               svh.svh_reason_id
          FROM stock.stock_voucher svh
         WHERE svh.svh_id       = ${svhId}::uuid
           AND svh.svh_acc_year = ${accYear}::bpchar
      ),
      line AS (
        -- svh_doc_datetime rides along for the freeze check below: the window
        -- is tested against the MOVEMENT's timestamp, not now().
        SELECT svi.*, doc.svh_doc_date, doc.svh_doc_datetime, doc.svh_rate_source,
               doc.svh_company_id, doc.svh_branch_id, doc.svh_reason_id
          FROM stock.stock_voucher_item svi
          JOIN doc ON doc.svh_id = svi.svi_voucher_id AND doc.svh_acc_year = svi.svi_acc_year
         WHERE svi.svi_is_deleted = false
      ),
      -- The effective policy, most-specific-first, resolved against the
      -- DOCUMENT's date and not today's — see the StockTrackPolicy model note.
      -- No row at all is a complete answer: track nothing, WAVG, FEFO, ALLOW.
      -- THE SAME FRAGMENT THE POST USES (stock-voucher-posting.helper), so the
      -- preflight and the engine cannot disagree about which policy applies.
      ${effectivePolicyCte()},
      -- The identity the post will key on: each dimension blanked when the
      -- policy does not track it, then collapsed to the same sentinels
      -- ux_slt_identity is built over ('~', -1, 0001-01-01, the nil uuid),
      -- batch and serial folded the way the generated key columns fold them.
      keyed AS (
        SELECT line.*,
               policy.track_batch, policy.track_mrp, policy.track_sale_price,
               policy.track_expiry, policy.track_serial, policy.track_supplier,
               policy.issue_strategy,
               ${lotIdentityKeyColumns()},
               ${lineDirectionColumn(rules)}
          FROM line
          JOIN policy ON policy.svi_id = line.svi_id
          ${lineReasonJoin()}
      ),
      -- §1.4 — an OUTWARD line of a lot-tracked item that names no lot and no
      -- complete identity is not refused for the missing dimension: the post
      -- PICKS its lots by the item's issue strategy (FEFO / FIFO / LIFO) from
      -- what the godown holds. What the preflight checks instead is that there
      -- IS something to pick from, and that the strategy is not MANUAL.
      pick AS (
        SELECT keyed.svi_id,
               (${canPick}::boolean AND keyed.line_direction < 0 AND ${lotlessOutwardLine()}) AS pickable,
               -- Stock the PICK could issue from: narrowed by whatever identity
               -- the line stated, exactly as pickIssueLots narrows (notes 93),
               -- so the preflight and the post agree about "nothing to pick".
               EXISTS (
                 SELECT 1
                   FROM stock.stock_balance pb
                   JOIN stock.stock_lot pl ON pl.slt_id = pb.sbl_lot_id AND pl.slt_is_deleted = false
                  WHERE pb.sbl_company_id = keyed.svh_company_id
                    AND pb.sbl_branch_id  = keyed.svh_branch_id
                    AND pb.sbl_godown_id  = keyed.svi_godown_id
                    AND pb.sbl_item_id    = keyed.svi_item_id
                    AND pb.sbl_bucket     = keyed.svi_bucket
                    AND pb.sbl_is_deleted = false
                    AND pb.sbl_available_qty > 0
                    AND pl.slt_status IN ('ACTIVE', 'CLOSED')
                    AND ${issueNarrowing('pl', {
                      trackBatch: Prisma.raw('keyed.track_batch'),
                      trackMrp: Prisma.raw('keyed.track_mrp'),
                      trackSalePrice: Prisma.raw('keyed.track_sale_price'),
                      trackExpiry: Prisma.raw('keyed.track_expiry'),
                      trackSerial: Prisma.raw('keyed.track_serial'),
                      trackSupplier: Prisma.raw('keyed.track_supplier'),
                      keyBatch: Prisma.raw('keyed.key_batch'),
                      keyMrp: Prisma.raw('keyed.key_mrp'),
                      keySp: Prisma.raw('keyed.key_sp'),
                      keyExpiry: Prisma.raw('keyed.key_expiry'),
                      keySerial: Prisma.raw('keyed.key_serial'),
                      keySupplier: Prisma.raw('keyed.key_supplier'),
                    })}
               ) AS has_stock
          FROM keyed
      ),
      -- Has this holding already been opened this year? Matched through the
      -- lot's generated key columns and the OPENING rows in the ledger, NOT
      -- through the documents: a cancelled opening is reversed in the ledger
      -- and must correctly read as "not opened".
      --
      -- A HOLDING IS godown × lot × BUCKET — stock_balance's grain, and the
      -- count's. 40 SALEABLE opened on one document and the 5 crushed ones
      -- opened DAMAGED on a second are two holdings, not a repeat; before
      -- 2026-09-30 (notes 66) the bucket was not matched and the second
      -- document was refused, though keying both on one document passed.
      opened AS (
        SELECT keyed.svi_id,
               -- Gated INSIDE the CASE rather than by omitting the CTE: a
               -- CASE whose condition is a constant false never evaluates the
               -- EXISTS, so a count pays nothing for the expensive half while
               -- the query stays one statement.
               --
               -- A HOLDING MAY BE COUNTED ANY NUMBER OF TIMES, each posting its
               -- own variance from the then-current book figure, so this branch
               -- must be off for a count. Left on it would refuse the second
               -- count of every holding — which is also the ordinary answer to
               -- "the counter miscounted".
               CASE WHEN ${!rules.allowsRepeatHolding}::boolean THEN EXISTS (
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
                    AND sml.sml_bucket      = keyed.svi_bucket
                    AND sml.sml_txn_type    = 'OPENING'
                    -- LIVE, FORWARD AND NOT REVERSED. A cancel leaves the
                    -- original row where it is and mirrors it; reading the
                    -- forward side alone made a cancelled opening hold its
                    -- holding for ever. See unreversedLedgerRow.
                    AND ${unreversedLedgerRow()}
                    AND sml.sml_src_doc_id <> keyed.svi_voucher_id
               ) ELSE false END AS already_opened
          FROM keyed
      ),
      -- §3.5 — THE DRIFT CHECK, and the count's version of "already opened".
      --
      -- svi_book_qty is a snapshot taken when the sheet was generated. A sheet
      -- generated at 18:00 and posted at 23:00 has a book figure that may no
      -- longer be true, and the difference posted is then the difference
      -- between two moments rather than a variance. With the freeze on (§11)
      -- this should never fire; it is what tells you the freeze is not working.
      bal AS (
        SELECT keyed.svi_id,
               sbl.sbl_on_hand_qty
          FROM keyed
          LEFT JOIN stock.stock_balance sbl
                 ON sbl.sbl_company_id = keyed.svh_company_id
                AND sbl.sbl_branch_id  = keyed.svh_branch_id
                AND sbl.sbl_godown_id  = keyed.svi_godown_id
                AND sbl.sbl_item_id    = keyed.svi_item_id
                AND sbl.sbl_lot_id     = keyed.svi_lot_id
                AND sbl.sbl_bucket     = keyed.svi_bucket
                AND sbl.sbl_is_deleted = false
      ),
      -- §11 — THE FREEZE, SEEN BEFORE THE POST. tr_sml_freeze_guard refuses the
      -- ledger row regardless, but as one 409 for the whole document; this
      -- names the line and the count that holds the shelf. A count never trips
      -- over its own freeze, and a second DRAFT count of the same godown is
      -- refused by the first's — one sheet holds a shelf at a time.
      --
      -- THE WINDOW IS TESTED AGAINST svh_doc_datetime, NOT now(), and that
      -- changed on 2026-09-21. The old rule was wall clock, matching the
      -- dropped fn_sml_freeze_guard — but the till posts OFFLINE and pushes on
      -- reconnect, so wall clock refuses a sale made at 10:00, before the count
      -- began, that arrives at 14:00 during it. The shelf was already short
      -- when the counter started counting; the count reconciles it. A movement
      -- that HAPPENED inside the window is still refused.
      -- offline-sync-invariants.md §7b, and StockPostingService.assertNotFrozen
      -- is the other half of the same rule.
      frozen AS (
        SELECT keyed.svi_id,
               f.svh_refno     AS frozen_by,
               f.svh_freeze_to AS frozen_until
          FROM keyed
          LEFT JOIN LATERAL (
            SELECT svh.svh_refno, svh.svh_freeze_to
              FROM stock.stock_voucher svh
             WHERE svh.svh_voucher_type = 'PHYSICAL'
               AND svh.svh_freeze_stock = true
               AND svh.svh_status       = 'DRAFT'
               AND svh.svh_is_deleted   = false
               AND svh.svh_company_id   = keyed.svh_company_id
               AND svh.svh_branch_id    = keyed.svh_branch_id
               AND COALESCE(svh.svh_from_godown_id, svh.svh_to_godown_id) = keyed.svi_godown_id
               -- THE MOVEMENT'S OWN TIMESTAMP, not now(). See the note above.
               AND keyed.svh_doc_datetime BETWEEN svh.svh_freeze_from AND svh.svh_freeze_to
               AND svh.svh_id <> keyed.svi_voucher_id
             LIMIT 1
          ) f ON true
      )
      SELECT keyed.svi_id                             AS "sviId",
             keyed.svi_line_no                        AS "lineNo",
             keyed.svi_split_no                       AS "splitNo",
             keyed.svi_item_id                        AS "itemId",
             itm.item_code                            AS "itemCode",
             itm.item_name_en                         AS "itemName",
             CASE
               -- ── Notes 143 #5: the line's item and godown are the document's ──
               -- Stored as sent, and until now checked only by the item lookup
               -- and the CSV import: a line could open stock in another
               -- branch's godown, or of another company's item, or of a service.
               -- A blank company / branch on an item means shared (notes 73).
               -- Inactive is refused only on stock a SIMPLE document brings IN
               -- (an opening, an adjustment in): an outward line may still clear
               -- what a retired item or godown holds, and a transfer receipt or
               -- a bucket move only relocates stock that already exists.
               WHEN itm.item_company_id IS NOT NULL AND itm.item_company_id <> keyed.svh_company_id
                 THEN 'this item belongs to another company'
               -- Another branch's own item is refused where the item lookup
               -- refuses it, on a SIMPLE document; a transfer receipt lands a
               -- branch-specific item the despatching branch was free to send.
               WHEN ${rules.postShape === 'SIMPLE'}::boolean
                    AND itm.item_branch_id IS NOT NULL AND itm.item_branch_id <> keyed.svh_branch_id
                 THEN 'this item belongs to another branch'
               WHEN COALESCE(itm.item_is_service, false)
                 THEN 'this is a service item; a service has no stock'
               WHEN ${rules.postShape === 'SIMPLE'}::boolean AND keyed.line_direction > 0
                    AND (itm.item_is_deleted OR NOT itm.item_is_active)
                 THEN 'this item is inactive or deleted'
               WHEN gdl.gdl_id IS NULL OR COALESCE(gdl.gdl_is_deleted, false)
                    OR gdl.gdl_branch_id IS DISTINCT FROM keyed.svh_branch_id
                 THEN 'this godown is not one of this branch''s godowns'
               WHEN ${rules.postShape === 'SIMPLE'}::boolean AND keyed.line_direction > 0
                    AND NOT COALESCE(gdl.gdl_is_active, true)
                 THEN 'this godown is inactive'
               -- Notes 151 #7 — a line that NAMES its lot names one that exists,
               -- of this company and of this item. A valid lot of another
               -- company's (shared) item used to resolve straight through the
               -- engine's l.slt_id = svi_lot_id join; the adjustment screen checks
               -- the same three, and every type that posts a named lot gets
               -- them here.
               WHEN keyed.svi_lot_id IS NOT NULL AND nl.slt_id IS NULL
                 THEN 'this line names a lot that does not exist'
               WHEN keyed.svi_lot_id IS NOT NULL AND nl.slt_company_id <> keyed.svh_company_id
                 THEN 'this line names a lot that belongs to another company'
               WHEN keyed.svi_lot_id IS NOT NULL AND nl.slt_item_id <> keyed.svi_item_id
                 THEN 'this line names a lot that belongs to a different item'

               -- OPENING-ONLY, AND IT INVERTS UNDER COUNT. A count sends
               -- svi_qty 0 on every line, always; ungated this branch reports a
               -- problem on every line of every count sheet ever taken.
               WHEN ${rules.quantityMode === 'QTY'}::boolean
                    AND keyed.svi_qty = 0 AND keyed.svi_free_qty = 0
                 THEN 'this line has no quantity'

               -- ── The four PHYSICAL branches ────────────────────────────────
               -- ABSENT IS NOT "0 FOUND", it is NOT COUNTED YET, and posting an
               -- uncounted line as a total shortage is the most expensive
               -- mistake this screen can make. Refused at save too; caught
               -- again here because a sheet can be edited between the two.
               WHEN ${isCount}::boolean AND keyed.svi_counted_qty IS NULL
                 THEN 'this line has not been counted yet'
               WHEN ${isCount}::boolean
                    AND keyed.svi_book_qty IS DISTINCT FROM COALESCE(bal.sbl_on_hand_qty, 0)
                 THEN 'the book quantity has changed since this sheet was generated'
               -- Only an OVERAGE needs a rate from the document: a shortage is
               -- relieved at what the stock cost us, stamped by
               -- fn_sml_cost_default. Which lines are which is knowable only
               -- here, because svi_diff_qty is GENERATED.
               WHEN ${isCount}::boolean AND keyed.svi_diff_qty > 0
                    AND COALESCE(keyed.svh_rate_source, '') <> ALL (${DERIVABLE_RATE_SOURCES as readonly string[]}::text[])
                 THEN 'this line found stock and the document names no rate source the engine can derive one from'
               WHEN ${isCount}::boolean AND keyed.svi_diff_qty > 0
                    AND keyed.svh_rate_source = 'AVG_COST'
                    AND sic.sic_avg_cost_rate IS NULL
                 THEN 'the rate source is AVG_COST and this item has no average cost yet'

               WHEN iuc.iuc_id IS NULL OR iuc.iuc_item_id <> keyed.svi_item_id
                 THEN 'the unit does not belong to this item'
               -- Notes 143 #3. The base unit is the conversion row the keyed
               -- unit converts INTO (its iuc_base_unit_id) — the same pointer
               -- the item lookup follows — and of this item.
               WHEN bu.iuc_id IS NULL OR bu.iuc_item_id <> keyed.svi_item_id
                    OR bu.iuc_unit_id IS DISTINCT FROM iuc.iuc_base_unit_id
                 THEN 'the base unit is not this item''s base unit'
               -- What the ledger moves is svi_base_qty; a draft saved before the
               -- save-time rule could still hold one that is not qty × factor.
               WHEN ${rules.quantityMode === 'QTY'}::boolean
                    AND (keyed.svi_base_qty <> round(keyed.svi_qty * keyed.svi_to_base_factor, 6)
                         OR keyed.svi_free_base_qty <> round(keyed.svi_free_qty * keyed.svi_to_base_factor, 6))
                 THEN 'the base quantity is not quantity × factor'
               WHEN pick.pickable AND upper(keyed.issue_strategy) = 'MANUAL'
                 THEN 'the issue strategy for this item is MANUAL: the line must name the lot it issues from'
               WHEN pick.pickable AND NOT pick.has_stock
                 THEN 'this line names no lot and the godown holds no stock of the item matching what the line states to issue from'
               -- A line that NAMES its lot (a transfer, a count) carries the
               -- holding's identity by reference; the six dimensions are the
               -- engine's to resolve only when it does not.
               -- Notes 143 #7: batch and serial blank AFTER TRIMMING, as the lot
               -- key folds them — "  " used to pass here and open the no-batch
               -- lot. And an MRP of 0 is no MRP: the item lookup seeds 0 when
               -- there is no price row, which opened an "MRP 0" lot.
               WHEN keyed.svi_lot_id IS NULL AND NOT pick.pickable AND keyed.track_batch      AND COALESCE(btrim(keyed.svi_batch_no), '') = ''
                 THEN 'this item is batch-tracked and the line has no batch number'
               WHEN keyed.svi_lot_id IS NULL AND NOT pick.pickable AND keyed.track_expiry     AND keyed.svi_expiry_date IS NULL
                 THEN 'this item is expiry-tracked and the line has no expiry date'
               WHEN keyed.svi_lot_id IS NULL AND NOT pick.pickable AND keyed.track_mrp        AND COALESCE(keyed.svi_mrp, 0) <= 0
                 THEN 'this item is MRP-tracked and the line has no MRP (0 is not an MRP)'
               WHEN keyed.svi_lot_id IS NULL AND NOT pick.pickable AND keyed.track_sale_price AND keyed.svi_sale_price IS NULL
                 THEN 'this item is sale-price-tracked and the line has no sale price'
               WHEN keyed.svi_lot_id IS NULL AND NOT pick.pickable AND keyed.track_serial     AND COALESCE(btrim(keyed.svi_serial_no), '') = ''
                 THEN 'this item is serial-tracked and the line has no serial number'
               WHEN keyed.svi_lot_id IS NULL AND NOT pick.pickable AND keyed.track_supplier   AND keyed.svi_supplier_id IS NULL
                 THEN 'this item is supplier-tracked and the line has no supplier'
               -- A receipt's cost is the transit row's, stamped when the goods
               -- left (§1.1); its line carries none and needs no rate source.
               WHEN ${rules.postShape !== 'TRANSFER_IN'}::boolean AND keyed.line_direction > 0 AND keyed.svi_cost_rate = 0
                    AND COALESCE(keyed.svh_rate_source, '') <> ALL (${DERIVABLE_RATE_SOURCES as readonly string[]}::text[])
                 THEN 'this line brings stock in with no cost rate and no rate source the engine can derive one from'
               -- Document-wide, and therefore QTY-only: a count whose every
               -- line is a shortage needs no average at all, and refusing it
               -- for want of one would refuse the shrinkage sheet that is the
               -- commonest count there is. Its COUNT counterpart above fires
               -- per line, on the overages alone.
               WHEN ${!isCount}::boolean
                    AND keyed.svh_rate_source = 'AVG_COST' AND sic.sic_avg_cost_rate IS NULL
                 THEN 'the rate source is AVG_COST and this item has no average cost yet'
               WHEN opened.already_opened
                 THEN 'this holding already has an opening in this year'
               WHEN frozen.frozen_by IS NOT NULL
                 THEN 'this godown is frozen for physical count ' || frozen.frozen_by
                      || ' until ' || to_char(frozen.frozen_until, ${IST_CLOCK_SQL_FORMAT})
               ELSE NULL
             END                                      AS "problem"
        FROM keyed
        JOIN pick   ON pick.svi_id   = keyed.svi_id
        JOIN opened ON opened.svi_id = keyed.svi_id
        JOIN bal    ON bal.svi_id    = keyed.svi_id
        JOIN frozen ON frozen.svi_id = keyed.svi_id
        JOIN inventory.item_master itm ON itm.item_id = keyed.svi_item_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = keyed.svi_uom_id
        LEFT JOIN inventory.item_unit_conversion bu  ON bu.iuc_id  = keyed.svi_base_uom_id
        LEFT JOIN inventory.godown_locations gdl     ON gdl.gdl_id = keyed.svi_godown_id
        -- The lot a line names (notes 151 #7); a deleted lot reads as none.
        LEFT JOIN stock.stock_lot nl
               ON nl.slt_id = keyed.svi_lot_id AND nl.slt_is_deleted = false
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
   * Q3 for every line, refused as ONE 422 rather than one error at a time.
   *
   * The engine refuses on the FIRST bad line and rolls the document back, which
   * is right for the database and useless as a screen message: a user forty
   * lines into an opening fixes one, presses post, and is told about the next.
   *
   * Shared by post() and by the save-and-post path, so a document refused by
   * one is refused by the other in the same words — a save that posted on
   * looser rules than the post button would be a way round the preflight.
   */
  private async assertPostable(
    rules: StockVoucherTypeRules,
    svhId: string,
    accYear: string,
    companyId: string,
    branchId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const problems = (await this.validate(rules, svhId, accYear, companyId, branchId, tx)).filter(
      (row) => row.problem !== null,
    );
    if (problems.length) {
      throwStockUnprocessable<StockErrorDetail, StockErrorResponse>(
        `This ${rules.displayName.toLowerCase()} cannot be posted`,
        problems.map((row) => ({
          field: `lines.${row.lineNo}`,
          code: StockErrorCode.LINE_NOT_POSTABLE,
          message: `Line ${row.lineNo}${row.splitNo > 1 ? ` split ${row.splitNo}` : ''} (${row.itemName}): ${row.problem}`,
        })),
      );
    }
  }
  async post(
    rules: StockVoucherTypeRules,
    svhId: string,
    accYear: string,
    companyId: string,
    branchId: string,
    userId?: string,
    /**
     * Run INSIDE the post's transaction, immediately after the engine call and
     * before the commit.
     *
     * It exists for one thing: `stt_lr_no`, `stt_vehicle_no` and
     * `stt_expected_on` are the lorry, which the engine has no opinion about
     * (§0.3 of the transfer plan). The despatch writes them itself, and
     * writing them in a SECOND transaction means a despatch can commit with the
     * lorry missing — a despatch note with no vehicle number, and no way to
     * tell afterwards whether it was never sent or lost on the way in.
     *
     * Deliberately narrow: it gets the transaction client and the row count,
     * and nothing here inspects what it does. It must not be used to write
     * svh_status — the engine owns that column.
     *
     * Notes 151 #5 — or a `StockPostHooks` object, whose `beforePost` runs
     * under the locks and before the preflight: the adjustment family's rules
     * over the rows that are about to post, not over rows read before the lock.
     */
    hooks?: StockPostHooks | ((tx: Prisma.TransactionClient, rowsPosted: number) => Promise<void>),
  ): Promise<StockVoucherPostResult> {
    const { beforePost, afterPost } = typeof hooks === 'function' ? { afterPost: hooks } : (hooks ?? {});
    const actor = this.actorOf(userId);
    const existing = await this.loadHeaderOrThrow(rules, svhId, accYear, companyId, branchId);
    this.assertDraft(rules, existing);
    // One instant for the ledger rows, the balance rows, the header stamp and
    // the status-trail row alike, so a trail sorts unambiguously against the
    // movements that produced it.
    const postedOn = new Date();
    const rowsPosted = await this.prisma.$transaction(async (tx) => {
      // Notes 143 #2 — WHAT IS CHECKED IS WHAT POSTS. The preflight used to run
      // before this transaction: a draft save committing between the two
      // posted lines nobody had checked, and two posts of one holding both
      // read "not opened". Now the row is locked and re-read as DRAFT, the
      // items are locked, and only then is Q3 run, against the locked rows.
      const locked = await this.loadForWrite(tx, rules, svhId, accYear, companyId, branchId);
      this.assertDraft(rules, locked);
      this.assertDocDateInYear(rules, locked.docDate, accYear);
      await this.lockForPreflight(tx, rules, svhId, accYear);
      // Notes 151 #5 — the type's own rules first, over the LOCKED rows.
      await beforePost?.(tx, svhId);
      // Q3 first, and refuse without calling the engine when any row has a
      // problem. Post is the button a user presses forty lines in; letting the
      // engine raise on the first bad one and roll back the rest hands them one
      // error at a time.
      await this.assertPostable(rules, svhId, accYear, companyId, branchId, tx);
      // EVERY shape posts here — SIMPLE, COUNT and both halves of a transfer.
      // The engine decides the shape from the rule record and reports the
      // status it landed on: POSTED, or IN_TRANSIT for an inter-branch
      // despatch, which never reaches POSTED (20:218-220).
      const posted = await this.stockPosting.post(
        tx,
        new StockVoucherSource({ svhId, accYear, companyId, branchId, rules }),
        { actor, postedOn },
      );
      // Inside the transaction on purpose — if this throws, the post rolls back
      // with it rather than leaving a committed despatch missing its lorry.
      await afterPost?.(tx, posted.rowsPosted, svhId);
      await this.logStatusChange(tx, {
        rules,
        svhId,
        accYear,
        companyId,
        branchId,
        tenantId: existing.svhTenantId ?? null,
        refno: existing.svhRefno,
        fromStatus: existing.svhStatus,
        toStatus: posted.status,
        actor,
        changedOn: postedOn,
        remarks:
          posted.status === 'IN_TRANSIT'
            ? `${rules.displayName} despatched — ${posted.rowsPosted} ledger rows, ${posted.transitRows} lines in transit`
            : `${rules.displayName} posted — ${posted.rowsPosted} ledger rows`,
        deviceId: existing.svhDeviceId,
        sessionId: existing.svhSessionId,
      });
      // A receipt that took the last of a despatch closed it: the OUT's trail
      // gets its RECEIVED step here, in the same transaction, under the same
      // doc type both halves file under.
      if (posted.closedOut) {
        await this.logStatusChange(tx, {
          rules,
          svhId: posted.closedOut.svhId,
          accYear: posted.closedOut.accYear,
          companyId,
          branchId,
          tenantId: existing.svhTenantId ?? null,
          refno: posted.closedOut.refno,
          fromStatus: 'IN_TRANSIT',
          toStatus: 'RECEIVED',
          actor,
          changedOn: postedOn,
          remarks: `Closed by receipt ${existing.svhRefno}`,
        });
      }
      return posted.rowsPosted;
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
   * Cancels a DRAFT or a POSTED voucher. Never a delete, in either case — the
   * document stays listed, numbered and readable, with the reason on the trail.
   *
   * WHICH WORK IS DONE DEPENDS ON THE STATUS, and only on the status:
   *
   *   * DRAFT — nothing has been written to stock_ledger, so there is nothing
   *     to reverse: `cancelDraftVoucher` moves the header and reports
   *     `rowsReversed: 0`. See that function for why a draft cancel is not the
   *     same act as `softDelete`, and for the freeze it releases on an
   *     abandoned PHYSICAL count. The TRANSFER routes are the exception and
   *     still refuse it — see the check itself.
   *   * POSTED — reversal rows. Two properties worth holding on to:
   *       - A reversal carries the ORIGINAL doc_date and acc_year, so an
   *         as-on-date report reads "this document never moved stock".
   *         sml_posted_on is the audit trail of when the cancellation happened.
   *       - It can LEGITIMATELY fail. Cancelling an opening after stock has
   *         been sold from it drives the holding negative, and the engine
   *         refuses that WHATEVER the item's stp_allow_negative says (notes
   *         143 #4 — until then an ALLOW item went to −8 and accounts reversed
   *         the whole opening). That is correct behaviour, not a bug to route
   *         around — it surfaces as a 409 STOCK_CANCEL_WOULD_GO_NEGATIVE naming
   *         the item, and the fix is an ADJUSTMENT with a reason.
   *
   * An already-CANCELLED document is refused before any of that, with the date
   * it was cancelled on.
   *
   * WHO REVERSES A POSTED ONE: `StockPostingService.cancel`, for every type.
   * A transfer is refused there by the engine's own guard when it is in flight
   * (IN_TRANSIT / RECEIVED) or is a received receipt; a same-branch POSTED pair
   * reverses both halves symmetrically.
   *
   * `reason` is required here even though the trail's tsl_remarks is nullable
   * in general: a cancelled opening with no reason is unanswerable three months
   * later. It is stored as the CANCELLED step's remark — ck_tsl_reason_required
   * would refuse the row without one anyway.
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
    const actor = this.actorOf(userId);
    const trimmedReason = reason?.trim();
    if (!trimmedReason) {
      throwStockUnprocessable<StockErrorDetail, StockErrorResponse>('Cancellation needs a reason', [
        {
          field: 'reason',
          code: StockErrorCode.CANCEL_REASON_REQUIRED,
          message: 'A cancelled document with no reason is unanswerable three months later.',
        },
      ]);
    }
    const existing = await this.loadHeaderOrThrow(rules, svhId, accYear, companyId, branchId);
    if (existing.svhStatus === 'CANCELLED') {
      // WHEN it was cancelled is on the trail, not on the header — one extra
      // read on a path that is about to 409 anyway, so the caller still gets a
      // date instead of "an earlier date".
      const cancelStep = await this.findLastStatusStep(rules, svhId, accYear, 'CANCELLED');
      throwStockConflict<StockErrorDetail, StockErrorResponse>(
        `${rules.displayName} already cancelled`,
        [
          {
            field: 'svhId',
            code: StockErrorCode.VOUCHER_ALREADY_CANCELLED,
            message: `${existing.svhRefno} was cancelled on ${cancelStep?.tslChangedOn.toISOString() ?? 'an earlier date'}.`,
          },
        ],
      );
    }
    // A DRAFT has written no ledger row, so it is cancelled by moving the
    // header: no reversal, no engine, nothing to fail on.
    //
    // NOT ON THE TRANSFER ROUTES. A draft TRANSFER_IN is the receipt half of a
    // despatch that has ALREADY moved stock into stock_transit, and cancelling
    // it would strand those rows with no document left to settle them. Those
    // routes say "delete it instead", which for them remains true (§1.1: a
    // DRAFT of either half is deleted, as today).
    const isDraft = existing.svhStatus === 'DRAFT';
    const isTransfer = rules.postShape === 'TRANSFER_OUT' || rules.postShape === 'TRANSFER_IN';
    if (isDraft && isTransfer) {
      throwStockConflict<StockErrorDetail, StockErrorResponse>(`${rules.displayName} is a draft`, [
        {
          field: 'svhId',
          code: StockErrorCode.VOUCHER_DRAFT_NOT_CANCELLABLE,
          message: `${existing.svhRefno} is DRAFT and has moved no stock of its own, so there is nothing to reverse. Delete it instead — cancelling it would strand the despatch it settles.`,
        },
      ]);
    }
    const cancelledOn = new Date();
    const rowsReversed = await this.prisma.$transaction(async (tx) => {
      let reversed: number;
      if (isDraft) {
        reversed = await cancelDraftVoucher(tx, {
          rules,
          svhId,
          accYear,
          actor,
          reason: trimmedReason,
          cancelledOn,
        });
        // Notes 149 #3 — for a draft, cancel is the delete: its auto batches
        // never became lots, so their size / colour / model rows retire with
        // it, or the next scan reads a batch that holds no stock. /get still
        // shows them against the line (its join takes retired rows by batch).
        // A POSTED cancel keeps them: the lot exists, and the rows describe it.
        await softDeleteBatchDetailsOf(tx, svhId, this.auditActor(actor));
      } else {
        // Notes 150 #8 — an older count under a newer one stays.
        if (rules.quantityMode === 'COUNT') {
          await this.assertCountNotSuperseded(tx, svhId, accYear, existing.svhRefno);
        }
        reversed = await this.stockPosting.cancel(
          tx,
          new StockVoucherSource({ svhId, accYear, companyId, branchId, rules }),
          // Notes 143 #4 — a stock voucher's cancel never leaves a holding
          // negative, whatever the item's policy.
          { actor, reason: trimmedReason, cancelledOn, refuseNegative: true },
        );
      }
      // Inside the cancellation's own transaction: a cancellation whose header
      // move (and, on a posted document, whose ledger reversal) committed and
      // whose trail row did not is a document that says CANCELLED with nothing
      // saying who cancelled it or why.
      await this.logStatusChange(tx, {
        rules,
        svhId,
        accYear,
        companyId,
        branchId,
        tenantId: existing.svhTenantId ?? null,
        refno: existing.svhRefno,
        fromStatus: existing.svhStatus,
        toStatus: 'CANCELLED',
        actor,
        changedOn: cancelledOn,
        // ck_tsl_reason_required demands one on a cancellation, and the screen
        // already collected it.
        remarks: trimmedReason,
        deviceId: existing.svhDeviceId,
        sessionId: existing.svhSessionId,
      });
      return reversed;
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
      notes: isDraft
        ? `${rules.displayName} draft cancelled: ${trimmedReason}`
        : `${rules.displayName} cancelled: ${trimmedReason}`,
    });
    return {
      ...document,
      rowsReversed,
      status: document.header.status,
      cancelledOn: document.header.cancelledOn,
    };
  }
  /**
   * Notes 160 B — recall a branch despatch that nobody received.
   *
   * `cancel` refuses an IN_TRANSIT despatch, rightly once the other branch has
   * keyed anything; a lorry that never left, or came straight back, had no way
   * back. This is that way: allowed only while the despatch is IN_TRANSIT and
   * untouched (no receipt names it, a draft one included; nothing received or
   * damaged on any transit row — the engine checks under its locks and 409s
   * STOCK_TRANSFER_RECALL_RECEIVED). The OUT rows are reversed, the transit
   * rows closed, the loading voucher reversed and the header CANCELLED, with
   * the reason on the CANCELLED trail row and the audit, as a cancel.
   */
  async recall(
    rules: StockVoucherTypeRules,
    svhId: string,
    accYear: string,
    reason: string,
    companyId: string,
    branchId: string,
    userId?: string,
  ): Promise<StockTransferRecallResult> {
    const actor = this.actorOf(userId);
    const trimmedReason = reason?.trim();
    if (!trimmedReason) {
      throwStockUnprocessable<StockErrorDetail, StockErrorResponse>('Recall needs a reason', [
        {
          field: 'reason',
          code: StockErrorCode.CANCEL_REASON_REQUIRED,
          message: 'A recalled despatch with no reason is unanswerable three months later.',
        },
      ]);
    }
    const existing = await this.loadHeaderOrThrow(rules, svhId, accYear, companyId, branchId);
    if (existing.svhStatus !== 'IN_TRANSIT') {
      const sameBranch =
        existing.svhToBranchId === null || existing.svhToBranchId === existing.svhBranchId;
      throwStockConflict<StockErrorDetail, StockErrorResponse>(
        `${rules.displayName} is ${existing.svhStatus}`,
        [
          {
            field: 'svhId',
            code:
              existing.svhStatus === 'CANCELLED'
                ? StockErrorCode.VOUCHER_ALREADY_CANCELLED
                : StockErrorCode.TRANSFER_NOT_IN_TRANSIT,
            message:
              existing.svhStatus === 'CANCELLED'
                ? `${existing.svhRefno} was already cancelled.`
                : existing.svhStatus === 'DRAFT'
                  ? `${existing.svhRefno} is DRAFT and has not been despatched. Delete it instead.`
                  : existing.svhStatus === 'RECEIVED'
                    ? `${existing.svhRefno} has been received. Transfer it back instead.`
                    : sameBranch
                      ? `${existing.svhRefno} is a godown transfer, not a branch despatch. Cancel it instead.`
                      : `${existing.svhRefno} is ${existing.svhStatus}; only a despatch in transit can be recalled.`,
          },
        ],
      );
    }
    const cancelledOn = new Date();
    const recalled = await this.prisma.$transaction(async (tx) => {
      const result = await this.stockPosting.recall(
        tx,
        new StockVoucherSource({ svhId, accYear, companyId, branchId, rules }),
        { actor, reason: trimmedReason, cancelledOn },
      );
      // In the recall's own transaction, as a cancel's: a despatch that says
      // CANCELLED with nothing saying who recalled it or why is the gap this
      // closes.
      await this.logStatusChange(tx, {
        rules,
        svhId,
        accYear,
        companyId,
        branchId,
        tenantId: existing.svhTenantId ?? null,
        refno: existing.svhRefno,
        fromStatus: existing.svhStatus,
        toStatus: 'CANCELLED',
        actor,
        changedOn: cancelledOn,
        remarks: `Recalled: ${trimmedReason}`,
        deviceId: existing.svhDeviceId,
        sessionId: existing.svhSessionId,
      });
      return result;
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
      modifiedRecord: {
        svhId,
        svhStatus: document.header.status,
        rowsReversed: recalled.rowsReversed,
        transitRowsClosed: recalled.transitRowsClosed,
      },
      userId: actor,
      notes: `${rules.displayName} recalled: ${trimmedReason}`,
    });
    return {
      ...document,
      rowsReversed: recalled.rowsReversed,
      transitRowsClosed: recalled.transitRowsClosed,
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
   * A POSTED voucher is CANCELLED, never deleted. The engine's reversal scans
   * the ledger by document id, not by svh_is_deleted — so soft-deleting a
   * posted document would hide it from every list while its ledger rows went
   * on affecting stock for ever. That is the one state this module must not be
   * able to reach.
   */
  async softDelete(
    rules: StockVoucherTypeRules,
    svhId: string,
    accYear: string,
    companyId: string,
    branchId: string,
    userId?: string,
  ): Promise<StockVoucherDeleteResult> {
    const actor = this.actorOf(userId);
    const existing = await this.loadHeaderOrThrow(rules, svhId, accYear, companyId, branchId);
    if (existing.svhStatus !== 'DRAFT') {
      throwStockConflict<StockErrorDetail, StockErrorResponse>(
        `${rules.displayName} is ${existing.svhStatus}`,
        [
          {
            field: 'svhId',
            code: StockErrorCode.VOUCHER_NOT_DELETABLE,
            message:
              existing.svhStatus === 'CANCELLED'
                ? // Reached by a cancelled DRAFT too, which has no ledger rows
                  // at all — but it is out of play either way, and deleting it
                  // would only take the reason off the list with it.
                  `${existing.svhRefno} is already cancelled, which is as far out of play as a document goes. There is nothing left to delete.`
                : `${existing.svhRefno} is ${existing.svhStatus} and has ledger rows. Cancel it — a cancellation reverses the movement; a soft delete would only hide the document while its stock stayed.`,
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
          svhModifiedBy: this.auditActor(actor),
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
          sviModifiedBy: this.auditActor(actor),
        },
      });
      // Addendum 2 E2 — the draft's batch details go with it.
      await softDeleteBatchDetailsOf(tx, svhId, this.auditActor(actor));
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
      // DELETED, not CANCELLED, and the event is passed explicitly because it
      // cannot be inferred: a soft delete leaves svh_status alone, so from and
      // to are both DRAFT. The trail says the row left play without claiming
      // the document was cancelled — which would mean stock was reversed, and
      // none was.
      await this.logStatusChange(tx, {
        rules,
        svhId,
        accYear,
        companyId,
        branchId,
        tenantId: existing.svhTenantId ?? null,
        refno: existing.svhRefno,
        fromStatus: existing.svhStatus,
        toStatus: existing.svhStatus as StockVoucherStatus,
        event: TxnStatusEvent.DELETED,
        actor,
        changedOn: modifiedOn,
        remarks: `${rules.displayName} draft deleted`,
        deviceId: existing.svhDeviceId,
        sessionId: existing.svhSessionId,
      });
    });
    return { svhId, accYear, deleted: true };
  }
  // ──────────────────────────────────────────────────────────────────────────
  // §11 — import from file
  // ──────────────────────────────────────────────────────────────────────────
  /**
   * Replaces the lines of an existing DRAFT from a CSV, and reports what the
   * preflight then makes of them.
   *
   * IT NEVER POSTS, and it never creates the document. The header — which
   * godown, which date, which rate source, which device the number came from —
   * is the operator's decision; a spreadsheet does not get to make it.
   *
   * THE IMPORT GOES THROUGH `save()`, NOT AROUND IT. Resolution turns codes into
   * ids and stops there; every rule in §4.2 — the zero-quantity check, the
   * batch/split rule, the expiry order, the duplicate line numbers, the
   * conversion factor read from `item_unit_conversion` — is then applied by the
   * ordinary save path. A second write path that skipped them would be an
   * importer that can create documents the screen cannot, which is how the two
   * disagree about what a valid line is.
   *
   * Resolution failures and validation failures are reported TOGETHER as one
   * 422. An operator fixing a 400-line file one error per upload gives up.
   */
  async importLines(
    rules: StockVoucherTypeRules,
    svhId: string,
    accYear: string,
    companyId: string,
    branchId: string,
    csvText: string,
    userId?: string,
  ): Promise<StockVoucherImportResult> {
    const existing = await this.loadHeaderOrThrow(rules, svhId, accYear, companyId, branchId);
    this.assertDraft(rules, existing);
    const header = await this.prisma.stockVoucher.findUnique({
      where: { svhId_svhAccYear: { svhId, svhAccYear: accYear } },
      select: {
        svhDeviceId: true,
        svhSessionId: true,
        svhTenantId: true,
        svhDocDate: true,
        svhFromGodownId: true,
        svhToGodownId: true,
        svhSupplierId: true,
        svhUsrRefno: true,
        svhRateSource: true,
        svhRemarks: true,
        svhSlno: true,
        svhRefno: true,
      },
    });
    if (!header) {
      throwStockNotFound<StockErrorDetail, StockErrorResponse>(
        `${rules.displayName} not found`,
        'svhId',
        `No ${rules.voucherType} voucher ${svhId} in ${accYear}.`,
        StockErrorCode.VOUCHER_NOT_FOUND,
      );
    }
    // Every row that names no godown of its own inherits the document's. For an
    // OPENING that is the to-godown; for an outward document it is the from.
    const defaultGodownId = rules.requiresToGodown
      ? header.svhToGodownId
      : (header.svhFromGodownId ?? header.svhToGodownId);
    if (!defaultGodownId) {
      throwStockUnprocessable<StockErrorDetail, StockErrorResponse>(
        'This document has no godown to import into',
        [
          {
            field: 'svhId',
            code: StockErrorCode.IMPORT_NO_GODOWN,
            message: `${header.svhRefno} names no godown, so a row without one has nowhere to go. Save the header with a godown first.`,
          },
        ],
      );
    }
    const { lines, errors, rowsRead } = await resolveImportedLines(this.prisma, csvText, {
      companyId,
      branchId,
      defaultGodownId,
    });
    if (errors.length) {
      throwStockUnprocessable<StockErrorDetail, StockErrorResponse>(
        `${errors.length} of ${rowsRead} rows could not be read`,
        errors,
      );
    }
    await this.save(rules, {
      header: {
        svhId,
        accYear,
        companyId,
        branchId,
        tenantId: header.svhTenantId,
        deviceId: header.svhDeviceId,
        sessionId: header.svhSessionId,
        // The existing number is passed straight back so the update path does
        // not renumber a document the operator may already have printed.
        slno: header.svhSlno.toString(),
        refno: header.svhRefno,
        usrRefno: header.svhUsrRefno,
        docDate: header.svhDocDate.toISOString().slice(0, 10),
        fromGodownId: header.svhFromGodownId,
        toGodownId: header.svhToGodownId,
        supplierId: header.svhSupplierId,
        rateSource: header.svhRateSource as StockRateSource | null,
        remarks: header.svhRemarks,
        userId,
      },
      lines,
    });
    const problems = await this.validate(rules, svhId, accYear, companyId, branchId);
    const document = await this.getById(rules, svhId, accYear, companyId, branchId);
    return {
      ...document,
      rowsRead,
      linesImported: lines.length,
      problems,
    };
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
              AND sml.sml_txn_type   = ANY (${rules.ledgerTxnTypes as string[]}::text[])
              -- Same rule as the preflight's: a cancelled opening is not an
              -- opening, so its item belongs back on this work list.
              AND ${unreversedLedgerRow()}
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
           AND sml.sml_txn_type   = ANY (${rules.ledgerTxnTypes as string[]}::text[])
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
  // §4 / §12 — the count's own two reads
  // ──────────────────────────────────────────────────────────────────────────
  /**
   * §4 — the count sheet. GENERATED from stock_balance, never typed.
   *
   * THE GRAIN IS stock_balance's OWN: one line per godown × lot × bucket, not
   * per item. Two batches of MILK are two lines to count, because they are two
   * holdings, and a single MILK line would have no lot to write a variance
   * against.
   *
   * IT IS A READ, NOT A DOCUMENT. It creates nothing — the operator can print
   * it and walk the aisles before any row exists. The sheet becomes a document
   * at the first save.
   *
   * ZERO-QUANTITY HOLDINGS ARE INCLUDED BY DEFAULT. A holding the book says is
   * empty is exactly where a count finds something; `includeZero: false` is
   * there for the operator who does not want them.
   *
   * AN ITEM WITH NO BALANCE ROW IS NOT HERE, AND MUST NOT BE ADDED. No book
   * quantity means no variance to have. Finding such an item on the shelf is an
   * ADJUSTMENT — a different screen, and one that does not exist yet.
   *
   * Paged, and not optional: a main warehouse is tens of thousands of holdings.
   * A count of a whole warehouse is many sheets by design, which is also how
   * counts are actually run.
   */
  async countSheet(
    rules: StockVoucherTypeRules,
    query: CountSheetQuery,
  ): Promise<PagedResult<StockCountSheetRow>> {
    if (rules.quantityMode !== 'COUNT') {
      // Exported service, and the next five screens import it.
      throwStockUnprocessable<StockErrorDetail, StockErrorResponse>(
        'A count sheet belongs to a physical count',
        [
          {
            field: 'voucherType',
            code: StockErrorCode.COUNT_SHEET_WRONG_TYPE,
            message: `A ${rules.displayName.toLowerCase()} states its own lines; only a count generates them from the book.`,
          },
        ],
      );
    }
    const take = this.clamp(query.limit, DEFAULT_REPORT_LIMIT, MAX_REPORT_LIMIT);
    const skip = Math.max(query.offset ?? 0, 0);
    const includeZero = query.includeZero ?? true;
    const negativeOnly = query.negativeOnly ?? false;
    const rows = await this.prisma.$queryRaw<CountSheetRow[]>`
      SELECT sbl.sbl_item_id,
             itm.item_code,
             itm.item_name_en           AS item_name,
             sbl.sbl_lot_id,
             sbl.sbl_godown_id,
             gdl.gdl_name               AS godown_name,
             sbl.sbl_bucket,
             sbl.sbl_base_uom_id,
             unt.unit_name,
             sbl.sbl_batch_no,
             slt.slt_mfg_date,
             sbl.sbl_expiry_date,
             sbl.sbl_mrp,
             sbl.sbl_sale_price,
             slt.slt_serial_no,
             sbl.sbl_supplier_id,
             sbl.sbl_on_hand_qty,
             sbl.sbl_avg_cost_rate,
             sbl.sbl_stock_value,
             -- Notes 150 #9: the batch's size / colour / model, by company +
             -- item + folded batch, as every other reader of the table.
             sbd.sbd_size_id,
             isz.isz_name AS size_name,
             sbd.sbd_colour_id,
             icl.icl_name AS colour_name,
             sbd.sbd_model
        FROM stock.stock_balance sbl
        JOIN stock.stock_lot slt                   ON slt.slt_id = sbl.sbl_lot_id
        JOIN inventory.item_master itm             ON itm.item_id = sbl.sbl_item_id
        LEFT JOIN inventory.godown_locations gdl   ON gdl.gdl_id = sbl.sbl_godown_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = sbl.sbl_base_uom_id
        LEFT JOIN inventory.item_unit_master unt   ON unt.unit_id = iuc.iuc_unit_id
        LEFT JOIN stock.stock_batch_detail sbd
               ON sbd.sbd_company_id = sbl.sbl_company_id
              AND sbd.sbd_item_id    = sbl.sbl_item_id
              AND sbd.sbd_batch_no   = upper(btrim(sbl.sbl_batch_no))
              AND sbd.sbd_is_deleted = false
        LEFT JOIN inventory.item_size_master   isz ON isz.isz_id = sbd.sbd_size_id
        LEFT JOIN inventory.item_colour_master icl ON icl.icl_id = sbd.sbd_colour_id
       WHERE sbl.sbl_company_id = ${query.companyId}::uuid
         AND sbl.sbl_branch_id  = ${query.branchId}::uuid
         AND sbl.sbl_godown_id  = ${query.godownId}::uuid
         AND sbl.sbl_is_deleted = false
         AND (${query.bucket ?? null}::text IS NULL OR sbl.sbl_bucket = ${query.bucket ?? null}::text)
         AND (${query.itemGroupId ?? null}::uuid IS NULL OR itm.item_group_id = ${query.itemGroupId ?? null}::uuid)
         -- Notes 157 — brand, category, section: each narrows only when sent.
         AND (${query.itemBrandId ?? null}::uuid IS NULL OR itm.item_brand_id = ${query.itemBrandId ?? null}::uuid)
         AND (${query.itemCategoryId ?? null}::uuid IS NULL OR itm.item_category_id = ${query.itemCategoryId ?? null}::uuid)
         AND (${query.itemSectionId ?? null}::uuid IS NULL OR itm.item_section_id = ${query.itemSectionId ?? null}::uuid)
         AND (${includeZero}::boolean OR sbl.sbl_on_hand_qty <> 0)
         AND (NOT ${negativeOnly}::boolean OR sbl.sbl_on_hand_qty < 0)
       ORDER BY itm.item_name_en, sbl.sbl_batch_no NULLS FIRST, sbl.sbl_expiry_date, sbl.sbl_lot_id
       LIMIT ${take} OFFSET ${skip}
    `;
    return {
      // lineNo is assigned SERVER-SIDE in the order above, and continues across
      // pages: the operator walking the aisles with page 2 in hand is holding
      // lines 201-400 of one sheet, not a second sheet numbered from 1.
      items: rows.map((row, index) => ({
        lineNo: skip + index + 1,
        splitNo: 1,
        itemId: row.sbl_item_id,
        itemCode: row.item_code,
        itemName: row.item_name,
        lotId: row.sbl_lot_id,
        godownId: row.sbl_godown_id,
        godownName: row.godown_name,
        bucket: row.sbl_bucket as StockBucket,
        baseUomId: row.sbl_base_uom_id,
        unitName: row.unit_name,
        batchNo: row.sbl_batch_no,
        mfgDate: this.toIsoDate(row.slt_mfg_date),
        expiryDate: this.toIsoDate(row.sbl_expiry_date),
        mrp: toNullableNumber(row.sbl_mrp),
        salePrice: toNullableNumber(row.sbl_sale_price),
        serialNo: row.slt_serial_no,
        supplierId: row.sbl_supplier_id,
        bookQty: toNumber(row.sbl_on_hand_qty ?? new Prisma.Decimal(0)),
        avgCostRate: toNumber(row.sbl_avg_cost_rate),
        stockValue: toNumber(row.sbl_stock_value),
        // The column the screen fills, and the only one it may.
        countedQty: null,
        sizeId: row.sbd_size_id,
        sizeName: row.size_name,
        colourId: row.sbd_colour_id,
        colourName: row.colour_name,
        model: row.sbd_model,
      })),
      meta: { limit: take, offset: skip, count: rows.length },
    };
  }
  /**
   * §12 — the count as the LEDGER recorded it, which is not the document the
   * screen holds.
   *
   * This is the row set an auditor asks for, and the only place the shortage's
   * stamped cost and the overage's derived cost sit side by side. It is also
   * the honest answer to "which lines reached the ledger": a count writes one
   * ledger row per line OR NONE AT ALL — a line that agrees leaves no trace
   * anywhere, and the evidence that it was counted lives on the document. The
   * captured run wrote rows 2 and 3; line 1 is missing, deliberately, and the
   * line numbers are kept so a variance row can be pointed back at the line it
   * came from.
   *
   * Raw, and no model: stock_ledger is append-only and nothing here writes it.
   */
  async variance(
    rules: StockVoucherTypeRules,
    svhId: string,
    accYear: string,
    companyId: string,
    branchId: string,
    limit?: number,
    offset?: number,
  ): Promise<PagedResult<StockVarianceRow>> {
    // Presence check first, and scoped: an empty result must mean "every line
    // agreed", not "that document belongs to another branch".
    await this.loadHeaderOrThrow(rules, svhId, accYear, companyId, branchId);
    const take = this.clamp(limit, DEFAULT_REPORT_LIMIT, MAX_REPORT_LIMIT);
    const skip = Math.max(offset ?? 0, 0);
    const rows = await this.prisma.$queryRaw<VarianceRow[]>`
      SELECT sml.sml_line_no,
             sml.sml_split_no,
             sml.sml_item_id,
             itm.item_code,
             itm.item_name_en  AS item_name,
             sml.sml_batch_no,
             sml.sml_txn_type,
             sml.sml_direction,
             sml.sml_qty,
             sml.sml_signed_base_qty,
             sml.sml_cost_rate,
             sml.sml_cost_value,
             sml.sml_reason_id,
             srm.srm_name      AS reason_name
        FROM stock.stock_ledger sml
        JOIN inventory.item_master itm            ON itm.item_id = sml.sml_item_id
        LEFT JOIN stock.stock_reason_master srm   ON srm.srm_id = sml.sml_reason_id
       WHERE sml.sml_src_doc_id = ${svhId}::uuid
         AND sml.sml_acc_year   = ${accYear}::bpchar
         AND sml.sml_is_deleted = false
       ORDER BY sml.sml_line_no, sml.sml_split_no
       LIMIT ${take} OFFSET ${skip}
    `;
    return {
      items: rows.map((row) => ({
        lineNo: row.sml_line_no,
        splitNo: row.sml_split_no,
        itemId: row.sml_item_id,
        itemCode: row.item_code,
        itemName: row.item_name,
        batchNo: row.sml_batch_no,
        txnType: row.sml_txn_type,
        direction: Number(row.sml_direction),
        // A MAGNITUDE. The sign lives in `direction` alone — SALT short by two
        // reads qty 2 with direction −1, not −2.
        qty: toNumber(row.sml_qty),
        signedBaseQty: toNumber(row.sml_signed_base_qty ?? new Prisma.Decimal(0)),
        costRate: toNumber(row.sml_cost_rate),
        costValue: toNumber(row.sml_cost_value),
        reasonId: row.sml_reason_id,
        reasonName: row.reason_name,
      })),
      meta: { limit: take, offset: skip, count: rows.length },
    };
  }
  // ──────────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────────
  /**
   * The header a write is about to change, read UNDER ITS ROW LOCK (notes 143
   * #1). Every later write in the transaction — the draft update, the lines,
   * the totals, the post — then acts on the state read here; a plain read let
   * a save check DRAFT, wait on a post, and rewrite a POSTED document.
   *
   * All four keys are checked, the type with them: a document of another
   * company or branch is a 404, as loadHeaderOrThrow answers it. Before this
   * a save named the svhId alone and could edit another company's draft,
   * re-filing its lines under the caller's scope.
   */
  private async loadForWrite(
    tx: Prisma.TransactionClient,
    rules: StockVoucherTypeRules,
    svhId: string,
    accYear: string,
    companyId: string,
    branchId: string,
  ) {
    const [row] = await tx.$queryRaw<
      Array<{
        svh_refno: string;
        svh_status: string;
        svh_is_deleted: boolean;
        svh_voucher_type: string;
        svh_company_id: string;
        svh_branch_id: string;
        doc_date: string;
      }>
    >`
      SELECT svh_refno, svh_status, svh_is_deleted, svh_voucher_type,
             svh_company_id, svh_branch_id,
             to_char(svh_doc_date, 'YYYY-MM-DD') AS doc_date
        FROM stock.stock_voucher
       WHERE svh_id       = ${svhId}::uuid
         AND svh_acc_year = ${accYear}::bpchar
         FOR UPDATE`;
    if (
      !row ||
      row.svh_voucher_type !== rules.voucherType ||
      row.svh_company_id !== companyId ||
      row.svh_branch_id !== branchId
    ) {
      throwStockNotFound<StockErrorDetail, StockErrorResponse>(
        `${rules.displayName} not found`,
        'svhId',
        `No ${rules.voucherType} voucher ${svhId} in ${accYear} for this company and branch.`,
        StockErrorCode.VOUCHER_NOT_FOUND,
      );
    }
    return {
      svhRefno: row.svh_refno,
      svhStatus: row.svh_status,
      svhIsDeleted: row.svh_is_deleted,
      docDate: row.doc_date,
    };
  }
  /**
   * Notes 143 #2 — the per-item locks the engine takes, taken BEFORE the
   * preflight so the two read one state of every item on the document: a
   * second opening of the same holding waits here and then sees the first's
   * ledger rows. Not on a transfer, whose preflight reads no other document's
   * rows per item and whose engine takes the destination's locks first.
   */
  private async lockForPreflight(
    tx: Prisma.TransactionClient,
    rules: StockVoucherTypeRules,
    svhId: string,
    accYear: string,
  ): Promise<void> {
    if (rules.postShape === 'TRANSFER_OUT' || rules.postShape === 'TRANSFER_IN') {
      return;
    }
    await lockVoucherItems(tx, svhId, accYear);
  }
  /**
   * Notes 143 #6 at post: a draft saved before the date rule existed may still
   * be filed under the wrong year, and posting it would open the stock there.
   */
  private assertDocDateInYear(
    rules: StockVoucherTypeRules,
    docDate: string,
    accYear: string,
  ): void {
    const dateYear = accYearOfDate(docDate);
    if (dateYear !== accYear.trim()) {
      throwStockUnprocessable<StockErrorDetail, StockErrorResponse>(
        `This ${rules.displayName.toLowerCase()} cannot be posted`,
        [
          {
            field: 'docDate',
            code: StockErrorCode.DOC_DATE_OUTSIDE_YEAR,
            message: `${docDate} falls in ${dateYear}, not in ${accYear.trim()}, the year this document is filed under. Correct the date and save it first.`,
          },
        ],
      );
    }
  }
  /**
   * Notes 143 #9 — WHO DID IT IS THE LOGIN. The body's userId used to win, so
   * any caller could post or cancel in another user's name, and that name
   * became postedBy and the accounts voucher's avh_user_id. The body's id is
   * only a fallback for a call with no request context (nothing to read a
   * login from); who AUTHORED a line is header/line createdBy, unchanged.
   */
  private actorOf(supplied: string | null | undefined): string {
    return resolveActor(this.requestContextService.getUserId(), supplied);
  }
  /**
   * One row on public.txn_status_log per status STEP — the voucher's trail is
   * the ordered set of them, and svh_status is only ever the CURRENT state.
   *
   * Written inside the CALLER'S transaction, so the step commits with the write
   * that caused it: a voucher that says POSTED with nothing saying who posted it,
   * or a cancelled one whose reversal committed and whose trail row did not, is
   * exactly what this prevents.
   *
   * ONLY A STEP IS LOGGED. An ordinary save that leaves the voucher DRAFT adds
   * nothing here — what changed field by field is audit.audit_log's job. Same
   * rule the bill and order screens follow.
   *
   * The table is LIST-partitioned by tsl_acc_year, so the accYear passed must be
   * the DOCUMENT's year: a fiscal year nobody ran
   * public.ensure_acc_year_partitions('YYYY-YYYY') against fails every insert
   * with "no partition of relation txn_status_log found for row".
   */
  private async logStatusChange(
    tx: Prisma.TransactionClient,
    step: {
      rules: StockVoucherTypeRules;
      svhId: string;
      accYear: string;
      companyId: string;
      branchId: string;
      tenantId: string | null;
      refno: string;
      /** NULL on the first row of the trail — the voucher did not exist before. */
      fromStatus: string | null;
      toStatus: StockVoucherStatus;
      actor: string;
      changedOn: Date;
      remarks?: string | null;
      deviceId?: string | null;
      sessionId?: string | null;
      /**
       * A soft delete leaves svh_status alone, so it cannot be inferred from the
       * from/to pair — see TxnStatusEvent.DELETED, which exists for exactly this.
       */
      event?: TxnStatusEvent;
    },
  ): Promise<void> {
    await appendTxnStatusLog(tx, {
      companyId: step.companyId,
      branchId: step.branchId,
      tenantId: step.tenantId,
      // The voucher's own year, not today's: txn_status_log is partitioned by it.
      accYear: step.accYear,
      // INVENTORY, not the ledger's 'STOCK'. The two tables allow different
      // module vocabularies — see STOCK_LEDGER_SRC_MODULE.
      srcModule: TxnStatusSrcModule.INVENTORY,
      srcDocType: step.rules.statusDocType,
      srcDocId: step.svhId,
      srcDocRefno: step.refno,
      event: step.event ?? this.toStatusEvent(step.fromStatus, step.toStatus),
      fromStatus: step.fromStatus,
      toStatus: step.toStatus,
      changedOn: step.changedOn,
      changedBy: step.actor,
      // ck_tsl_reason_required wants one on a cancellation; the helper falls
      // back to its own text rather than failing the write that caused the step.
      remarks: step.remarks ?? null,
      deviceId: step.deviceId ?? null,
      sessionId: step.sessionId ?? null,
    });
  }
  /**
   * The LATEST step that moved this voucher to `toStatus`, or null if it never
   * did. The header stores no posted/cancelled stamps — txn_status_log is the
   * record — so anything that needs one of those dates reads it back here.
   *
   * Newest first by tsl_seq_no: a voucher posted, cancelled and posted again has
   * two POSTED rows, and the current one is the last.
   */
  private findLastStatusStep(
    rules: StockVoucherTypeRules,
    svhId: string,
    accYear: string,
    toStatus: StockVoucherStatus,
  ) {
    return this.prisma.txnStatusLog.findFirst({
      where: {
        tslSrcDocType: rules.statusDocType,
        tslSrcDocId: svhId,
        tslAccYear: accYear,
        tslToStatus: toStatus,
        tslIsDeleted: false,
      },
      orderBy: { tslSeqNo: 'desc' },
      select: { tslChangedOn: true, tslChangedBy: true, tslRemarks: true },
    });
  }
  private toStatusEvent(fromStatus: string | null, toStatus: StockVoucherStatus): TxnStatusEvent {
    if (fromStatus === null) {
      // First row of the trail. Whether the voucher was born DRAFT or straight
      // into POSTED is what tslToStatus says.
      return TxnStatusEvent.CREATED;
    }
    if (toStatus === 'CANCELLED') {
      return TxnStatusEvent.CANCELLED;
    }
    if (toStatus === 'POSTED') {
      return TxnStatusEvent.POSTED;
    }
    // IN_TRANSIT and RECEIVED are the transfer chain's two extra states. Neither
    // is a post or a cancellation, and naming them STATUS_CHANGED keeps the
    // vocabulary honest rather than borrowing an event that means something else.
    return TxnStatusEvent.STATUS_CHANGED;
  }
  private async loadHeaderOrThrow(
    rules: StockVoucherTypeRules,
    svhId: string,
    accYear: string,
    companyId: string,
    branchId: string,
    /**
     * The save-and-post path passes its own transaction: the draft it is about
     * to post has not committed yet, so a read on this.prisma would not see it
     * and would 404 the document the same statement just wrote.
     */
    tx?: Prisma.TransactionClient,
  ) {
    const existing = await (tx ?? this.prisma).stockVoucher.findUnique({
      where: { svhId_svhAccYear: { svhId, svhAccYear: accYear } },
      select: {
        svhId: true,
        svhRefno: true,
        svhStatus: true,
        svhIsDeleted: true,
        svhVoucherType: true,
        svhCompanyId: true,
        svhBranchId: true,
        // Notes 160 B — recall tells a godown transfer from a branch despatch.
        svhToBranchId: true,
        // For the txn_status_log row every status step writes — see
        // logStatusChange.
        svhTenantId: true,
        svhDeviceId: true,
        svhSessionId: true,
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
        StockErrorCode.VOUCHER_NOT_FOUND,
      );
    }
    return existing;
  }
  private assertDraft(
    rules: StockVoucherTypeRules,
    existing: { svhRefno: string; svhStatus: string; svhIsDeleted: boolean },
  ): void {
    if (existing.svhIsDeleted) {
      throwStockConflict<StockErrorDetail, StockErrorResponse>(`${rules.displayName} is deleted`, [
        { field: 'svhId', code: StockErrorCode.VOUCHER_DELETED, message: `${existing.svhRefno} has been deleted.` },
      ]);
    }
    if (existing.svhStatus !== 'DRAFT') {
      throwStockConflict<StockErrorDetail, StockErrorResponse>(
        `${rules.displayName} is ${existing.svhStatus}`,
        [
          {
            field: 'svhId',
            code: StockErrorCode.VOUCHER_NOT_DRAFT,
            message: `${existing.svhRefno} is ${existing.svhStatus}; only a DRAFT voucher can be edited or posted. A posted document accepts only cancel and print.`,
          },
        ],
      );
    }
  }
  private toHeaderPayload(row: HeaderRow, rules: StockVoucherTypeRules): StockVoucherHeaderPayload {
    return {
      ...(rules.allowsLoading ? this.toLoadingPayload(row) : {}),
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
      supplierName: row.supplier_name,
      toBranchId: row.svh_to_branch_id,
      toBranchName: row.to_branch_name ?? null,
      partyRef: row.svh_party_ref,
      reasonId: row.svh_reason_id,
      reasonName: row.reason_name,
      linkSrcModule: row.svh_link_src_module,
      linkSrcDocType: row.svh_link_src_doc_type,
      linkSrcDocId: row.svh_link_src_doc_id,
      linkSrcAccYear: row.svh_link_src_acc_year?.trim() ?? null,
      freezeStock: row.svh_freeze_stock,
      freezeFrom: row.svh_freeze_from?.toISOString() ?? null,
      freezeTo: row.svh_freeze_to?.toISOString() ?? null,
      syncDate: row.svh_sync_date?.toISOString() ?? null,
      status: row.svh_status as StockVoucherStatus,
      lineCount: row.svh_line_count,
      totalQty: toNumber(row.svh_total_qty),
      totalValue: toNumber(row.svh_total_value),
      totalValueWot: toNumber(row.svh_total_value_wot),
      postedOn: row.posted_on?.toISOString() ?? null,
      postedBy: row.posted_by,
      postedByName: row.posted_by_name,
      cancelledOn: row.cancelled_on?.toISOString() ?? null,
      cancelReason: row.cancel_reason,
      createdOn: row.svh_created_on.toISOString(),
      createdBy: row.svh_created_by,
      createdByName: row.created_by_name,
      modifiedOn: row.svh_modified_on?.toISOString() ?? null,
      rateSource: row.svh_rate_source as StockRateSource | null,
      remarks: row.svh_remarks,
      isDeleted: row.svh_is_deleted,
    };
  }
  /** Notes 153 — the Loading / Unloading boxes, on a transfer's header only. */
  private toLoadingPayload(row: HeaderRow): StockVoucherLoadingPayload {
    return {
      loadEnabled: row.svh_load_enabled,
      loadDatetime: row.svh_load_datetime?.toISOString() ?? null,
      loadmanIds: row.svh_loadman_id ?? [],
      loadmanNames: row.loadman_names ?? [],
      driverId: row.svh_driver_id,
      driverName: row.driver_name,
      supervisorId: row.svh_supervisor_id,
      supervisorName: row.supervisor_name,
      vehicleId: row.svh_vehicle_id,
      vehicleNo: row.svh_vehicle_no,
      loadingCharge: toNumber(row.svh_loading_charge),
      unloadEnabled: row.svh_unload_enabled,
      unloadDatetime: row.svh_unload_datetime?.toISOString() ?? null,
      unloadmanIds: row.svh_unloadman_id ?? [],
      unloadmanNames: row.unloadman_names ?? [],
      unloadSupervisorId: row.svh_unload_supervisor_id,
      unloadSupervisorName: row.unload_supervisor_name,
      unloadingCharge: toNumber(row.svh_unloading_charge),
    };
  }
  private toLinePayload(row: LineRow, rules: StockVoucherTypeRules): StockVoucherLinePayload {
    return {
      ...(rules.allowsLoading
        ? { loadRate: toNumber(row.svi_load_rate), unloadRate: toNumber(row.svi_unload_rate) }
        : {}),
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
      barcode: row.svi_barcode,
      batchNo: row.svi_batch_no,
      mfgDate: this.toIsoDate(row.svi_mfg_date),
      expiryDate: this.toIsoDate(row.svi_expiry_date),
      mrp: toNullableNumber(row.svi_mrp),
      salePrice: toNullableNumber(row.svi_sale_price),
      serialNo: row.svi_serial_no,
      supplierId: row.svi_supplier_id,
      supplierName: row.line_supplier_name,
      toBucket: (row.svi_to_bucket as StockBucket | null) ?? null,
      qty: toNumber(row.svi_qty),
      baseQty: toNumber(row.svi_base_qty),
      freeQty: toNumber(row.svi_free_qty),
      freeBaseQty: toNumber(row.svi_free_base_qty),
      weightQty: toNumber(row.svi_weight_qty),
      bookQty: toNullableNumber(row.svi_book_qty),
      countedQty: toNullableNumber(row.svi_counted_qty),
      // GENERATED as counted − book. Read-only, and null on anything but a count.
      diffQty: toNullableNumber(row.svi_diff_qty),
      costRate: toNumber(row.svi_cost_rate),
      costRateWot: toNumber(row.svi_cost_rate_wot),
      landedRate: toNumber(row.svi_landed_rate),
      taxPerc: toNumber(row.svi_tax_perc),
      reasonId: row.svi_reason_id,
      reasonName: row.line_reason_name,
      direction: row.svi_direction === null ? null : Number(row.svi_direction),
      syncDate: row.svi_sync_date?.toISOString() ?? null,
      value: toNullableNumber(row.svi_value) ?? 0,
      valueWot: toNullableNumber(row.svi_value_wot) ?? 0,
      lotId: row.svi_lot_id,
      remarks: row.svi_remarks,
      trackSignature: row.track_signature,
      sizeId: row.sbd_size_id,
      sizeName: row.size_name,
      colourId: row.sbd_colour_id,
      colourName: row.colour_name,
      model: row.sbd_model,
    };
  }
  /**
   * resolveActor never returns null — it falls back to the nil-uuid
   * DEFAULT_ACTOR so callers always have a string. The audit columns want the
   * opposite: DEFAULT_ACTOR is a sentinel meaning "nobody was in context", and
   * writing it would claim a user acted. NULL says what actually happened.
   *
   * The *_created_by / *_modified_by columns were uuid until 20260907080000
   * and are TEXT now, so this no longer has anything to do with what the column
   * can hold — a name, a login or an id all store fine. It is only about not
   * recording a sentinel as an actor.
   */
  private auditActor(actor: string): string | null {
    return actor === DEFAULT_ACTOR ? null : actor;
  }
  /**
   * The payload's own answer to "who", falling back to the resolved actor.
   *
   * svh_created_by / svh_modified_by / svi_created_by / svi_modified_by are free
   * TEXT carrying no foreign key, so a client may name a till or an import job
   * here rather than a user id. A blank string is not an answer and is treated
   * as absent; DEFAULT_ACTOR still collapses to NULL, so a request with no
   * authenticated user and no stated author leaves the column empty rather than
   * attributing the row to the nil uuid.
   */
  private actorFor(supplied: string | null | undefined, actor: string): string | null {
    // Notes 150 #5 — THE LOGIN IS THE AUTHOR. svh_created_by and its three
    // siblings are free text with no foreign key, and a logged-in client could
    // name anyone ("ZT-SPOOFED-AUTHOR" was stored as sent). With a user in the
    // request context the columns take that user, whatever the payload says;
    // the payload's text stands only for a caller with no login at all — an
    // import job run from a script, a service-level caller — where it is the
    // only answer there is.
    if (actor !== DEFAULT_ACTOR) {
      return actor;
    }
    const trimmed = supplied?.trim();
    return trimmed ? trimmed : null;
  }
  /**
   * svi_modified_by is OMITTED rather than nulled on a line this save inserts:
   * a fresh line has not been modified, and a modified_by on it would claim an
   * edit that never happened. Under a login nothing the payload names is
   * written (notes 150 #5); without one the payload's text stands. Mirrors
   * docDatetimeData.
   */
  private lineModifiedByData(
    supplied: string | null | undefined,
    actor: string,
  ): { sviModifiedBy?: string } {
    if (actor !== DEFAULT_ACTOR) {
      return {};
    }
    const trimmed = supplied?.trim();
    return trimmed ? { sviModifiedBy: trimmed } : {};
  }
  /**
   * svh_doc_datetime defaults to now() in the database, so it is only sent when
   * the caller actually named one. A device syncing a week of offline documents
   * must send the moment each was keyed — otherwise they all land at the same
   * instant and the order they were raised in is gone.
   */
  private docDatetimeData(header: { docDatetime?: string | null }): {
    svhDocDatetime?: Date;
  } {
    return header.docDatetime ? { svhDocDatetime: new Date(header.docDatetime) } : {};
  }
  /** The (module, docType, docId, year) source triple — all four or none. */
  private linkSourceData(header: {
    linkSrcModule?: string | null;
    linkSrcDocType?: string | null;
    linkSrcDocId?: string | null;
    linkSrcAccYear?: string | null;
  }): Record<string, string | null> {
    return {
      svhLinkSrcModule: header.linkSrcModule ?? null,
      svhLinkSrcDocType: header.linkSrcDocType ?? null,
      svhLinkSrcDocId: header.linkSrcDocId ?? null,
      svhLinkSrcAccYear: header.linkSrcAccYear ?? null,
    };
  }
  /** PHYSICAL's freeze window. Refused for every other type in assertPayloadRules. */
  private freezeData(header: {
    freezeStock?: boolean;
    freezeFrom?: string | null;
    freezeTo?: string | null;
  }): { svhFreezeStock: boolean; svhFreezeFrom: Date | null; svhFreezeTo: Date | null } {
    return {
      svhFreezeStock: header.freezeStock ?? false,
      svhFreezeFrom: header.freezeFrom ? new Date(header.freezeFrom) : null,
      svhFreezeTo: header.freezeTo ? new Date(header.freezeTo) : null,
    };
  }
  /**
   * Notes 153 — a transfer's Loading / Unloading boxes, a full replace like
   * every other header field. Nothing on any other type: assertPayloadRules
   * has refused the fields there, so the columns keep their defaults. The two
   * charges are writeHeaderTotals', summed after the lines exist.
   */
  private loadingData(
    rules: StockVoucherTypeRules,
    header: SaveStockVoucherDto['header'],
  ): Partial<Prisma.StockVoucherUncheckedCreateInput> {
    if (!rules.allowsLoading) {
      return {};
    }
    return {
      svhLoadEnabled: header.loadEnabled ?? false,
      svhLoadDatetime: header.loadDatetime ? new Date(header.loadDatetime) : null,
      svhLoadmanId: header.loadmanIds ?? [],
      svhDriverId: header.driverId ?? null,
      svhSupervisorId: header.supervisorId ?? null,
      svhVehicleId: header.vehicleId ?? null,
      svhVehicleNo: header.vehicleNo ?? null,
      svhUnloadEnabled: header.unloadEnabled ?? false,
      svhUnloadDatetime: header.unloadDatetime ? new Date(header.unloadDatetime) : null,
      svhUnloadmanId: header.unloadmanIds ?? [],
      svhUnloadSupervisorId: header.unloadSupervisorId ?? null,
    };
  }
  /** `yyyy-MM-dd` — NexJson::date on the Qt side reads the first ten characters. */
  /**
   * §3.3 — the type's default rate source, applied HERE and not in the DTO.
   *
   * A DTO default would leave the stored document silent about how it was
   * valued; applied at the write, `svh_rate_source` says out loud what the
   * engine was told to derive from, and a document reprinted a year later
   * still answers "at what rate".
   *
   * It matters most for a count. MANUAL — the honest default for an opening,
   * where stock_item_cost is empty — makes fn_svh_post refuse a count's
   * overage line with "is an inward with no cost rate; set one or set
   * svh_rate_source", because MANUAL means the storekeeper types the rate and
   * a count line has nowhere to type it. AVG_COST is what found stock is
   * actually worth: whatever the rest of that item is worth.
   *
   * An explicit rateSource always wins, including an explicit null — a caller
   * that cleared the field meant to clear it.
   */
  private resolveRateSource(
    rules: StockVoucherTypeRules,
    header: { rateSource?: StockRateSource | null },
  ): StockRateSource | null {
    if (header.rateSource !== undefined) {
      return header.rateSource ?? null;
    }
    return rules.defaultRateSource ?? null;
  }
  private toIsoDate(value: Date | null): string | null {
    return value ? value.toISOString().slice(0, 10) : null;
  }
  /**
   * A payload figure as a plain number, for COMPARISONS only (`qty < 0`,
   * `costRate !== 0`). Never for a column: see `toDecimalColumn`.
   */
  private toDecimalNumber(value: string | number | null | undefined): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  /**
   * A payload figure on its way into a `numeric` column — §3a rule 1.
   *
   * `new Prisma.Decimal(this.toDecimalNumber(v))` looks equivalent and is not:
   * the value passes through float64 BEFORE it becomes a Decimal, so the
   * Decimal faithfully stores whatever float64 already lost. `svh_total_qty` is
   * `numeric(18,6)` — eighteen significant digits, past float64's ~15.95 — and
   * a quantity keyed on the far side of that is silently changed on its way in.
   * `Prisma.Decimal` takes the string as it stands and keeps it exactly.
   *
   * A value that is not a number at all still answers 0, as the old helper did:
   * this is a write path, and a refusal belongs in the validator, not here.
   */
  private toDecimalColumn(value: string | number | null | undefined): Prisma.Decimal {
    if (value === null || value === undefined || value === '') {
      return new Prisma.Decimal(0);
    }
    try {
      const decimal = new Prisma.Decimal(value);
      return decimal.isFinite() ? decimal : new Prisma.Decimal(0);
    } catch {
      return new Prisma.Decimal(0);
    }
  }
  /** An ISO instant as epoch millis, or null when absent or unparseable. */
  private toInstant(value: string | null | undefined): number | null {
    if (!value) {
      return null;
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  /**
   * `bookQty` is deliberately absent from SaveStockVoucherItemDto — the API
   * refuses it at the boundary, since `forbidNonWhitelisted` answers 400 for
   * any property no DTO declares. This reads it anyway, untyped, so the SERVICE
   * refuses it too: the service is exported, `importLines` calls `save()`
   * directly, and the next five screens will build their own payloads. A rule
   * that only exists in a pipe is a rule the second caller does not have.
   */
  private readRefusedBookQty(line: SaveStockVoucherItemDto): unknown {
    return (line as SaveStockVoucherItemDto & { bookQty?: unknown }).bookQty;
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
/**
 * `YYYY-YYYY` for a `yyyy-MM-dd` date, on the April–March year every stock
 * table is partitioned by (notes 143 #6).
 */
function accYearOfDate(date: string): string {
  const [year, month] = date.split('-').map(Number);
  const start = month >= 4 ? year : year - 1;
  return `${start}-${start + 1}`;
}
/**
 * Notes 153 — the first Loading / Unloading header field a payload actually
 * fills, or null. "Fills" is a value that would be stored: a tick set, a
 * non-empty crew, an id or a vehicle number. false, null and [] say nothing.
 */
function loadingFieldSent(header: SaveStockVoucherDto['header']): string | null {
  const filled: Array<[string, boolean]> = [
    ['loadEnabled', header.loadEnabled === true],
    ['loadDatetime', !!header.loadDatetime],
    ['loadmanIds', (header.loadmanIds?.length ?? 0) > 0],
    ['driverId', !!header.driverId],
    ['supervisorId', !!header.supervisorId],
    ['vehicleId', !!header.vehicleId],
    ['vehicleNo', !!header.vehicleNo?.trim()],
    ['unloadEnabled', header.unloadEnabled === true],
    ['unloadDatetime', !!header.unloadDatetime],
    ['unloadmanIds', (header.unloadmanIds?.length ?? 0) > 0],
    ['unloadSupervisorId', !!header.unloadSupervisorId],
  ];
  return filled.find(([, given]) => given)?.[0] ?? null;
}
