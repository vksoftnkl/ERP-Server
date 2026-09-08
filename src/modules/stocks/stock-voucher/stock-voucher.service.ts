import { Injectable, InternalServerErrorException } from '@nestjs/common';
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
import { resolveImportedLines } from './stock-voucher-import.helper';
import { postStockVoucher, usesInProcessPosting } from './stock-voucher-posting.helper';
import {
  appendTxnStatusLog,
  TxnStatusEvent,
  TxnStatusSrcModule,
} from 'src/common/txn-status-log/txn-status-log.helper';
import {
  DERIVABLE_RATE_SOURCES,
  STOCK_POST_FUNCTIONS,
  type OpeningReconcileRow,
  type PagedResult,
  type PendingOpeningItem,
  type StockBucket,
  type StockCountSheetRow,
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
  type StockVoucherImportResult,
  type StockVoucherPostResult,
  type StockVoucherStatus,
  type StockVoucherTypeRules,
  type StockVarianceRow,
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
  accYear: string;
  godownId: string;
  bucket?: StockBucket;
  itemGroupId?: string;
  /**
   * Default TRUE. A holding the book says is empty is exactly where a count
   * finds something.
   */
  includeZero?: boolean;
  limit?: number;
  offset?: number;
}

/** What stock_balance answers for one holding a count line names — §3.4. */
interface CountHoldingRow {
  sbl_lot_id: string;
  sbl_item_id: string;
  sbl_godown_id: string;
  sbl_bucket: string;
  sbl_base_uom_id: string;
  sbl_on_hand_qty: Prisma.Decimal | null;
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
  svh_to_branch_id: string | null;
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
  svi_barcode: string | null;
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
  svi_sync_date: Date | null;
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
    await this.assertReasons(rules, dto);
    // NOTHING HERE READS inventory.item_unit_conversion ANY MORE. uomId,
    // baseUomId and toBaseFactor arrive on the line and are written verbatim,
    // so there is no factor to look up and no base unit to resolve. What went
    // with the lookup is the cross-check that the unit belonged to the item:
    // fk_svi_uom and fk_svi_base_uom still refuse an iuc_id that does not
    // exist, and ck_svi_to_base_factor still refuses a factor <= 0, but a unit
    // belonging to a DIFFERENT item is now the client's to get right.
    //
    // A COUNT still names no unit at all: svi_uom_id, svi_base_uom_id and the
    // factor are read from the balance row's sbl_base_uom_id with factor 1,
    // because the book figure the count is measured against is in the base
    // unit. Its route has its own line DTO, which omits all three.

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

    // The DTO is shared by all eleven document types, so the fields that belong
    // to only one of them are gated here rather than being absent from it.
    if (!rules.allowsToBranch && header.toBranchId) {
      errors.push({
        field: 'toBranchId',
        message: `Only a transfer names the branch stock is going to; a ${rules.displayName.toLowerCase()} does not leave the branch.`,
      });
    }
    if (!rules.allowsCount) {
      if (header.freezeStock || header.freezeFrom || header.freezeTo) {
        errors.push({
          field: 'freezeStock',
          message: `Only a physical count freezes stock; a ${rules.displayName.toLowerCase()} counts nothing.`,
        });
      }
      const counted = lines.findIndex(
        (line) =>
          line.bookQty !== undefined &&
          line.bookQty !== null,
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
          message: `Line ${lines[at].lineNo}: bookQty and countedQty belong to a physical count. A ${rules.displayName.toLowerCase()} states a quantity, it does not reconcile one.`,
        });
      }
    } else if (header.freezeStock && !(header.freezeFrom && header.freezeTo)) {
      // ck_svh_freeze refuses a freeze with no window, and would say so as a
      // constraint name rather than as a field.
      errors.push({
        field: 'freezeStock',
        message: 'A freeze needs both freezeFrom and freezeTo — without a window the count measures a moving target.',
      });
    }

    // ck_svh_link is all-or-nothing across the four source columns.
    const linkParts = [
      header.linkSrcModule,
      header.linkSrcDocType,
      header.linkSrcDocId,
      header.linkSrcAccYear,
    ];
    const linkGiven = linkParts.filter((part) => part !== undefined && part !== null && part !== '');
    if (linkGiven.length > 0 && linkGiven.length < linkParts.length) {
      errors.push({
        field: 'linkSrcModule',
        message:
          'The source document is all four of linkSrcModule, linkSrcDocType, linkSrcDocId and linkSrcAccYear, or none of them (ck_svh_link).',
      });
    }

    if (!lines.length) {
      // A draft with no lines is allowed to EXIST — a user opens the screen,
      // fills the header and walks away — but not to be created empty by an
      // importer that resolved nothing.
      errors.push({ field: 'lines', message: 'A document must have at least one line.' });
    }

    // ck_svh_freeze refuses a freeze with no window, and it refuses it from
    // Postgres with a constraint name. Caught here it is a 422 that says which
    // two fields are missing, BEFORE the check fires.
    if (header.freezeStock && (!header.freezeFrom || !header.freezeTo)) {
      errors.push({
        field: 'freezeFrom',
        message:
          'A stock freeze needs a window: send freezeFrom and freezeTo as instants with an offset. The guard compares them to now(), not to the document date.',
      });
    }
    // Compared as INSTANTS, not as strings: '…T20:00+05:30' sorts after
    // '…T23:00Z' lexically and before it in fact.
    const freezeFrom = this.toInstant(header.freezeFrom);
    const freezeTo = this.toInstant(header.freezeTo);
    if (freezeFrom !== null && freezeTo !== null && freezeTo <= freezeFrom) {
      errors.push({ field: 'freezeTo', message: 'freezeTo must be after freezeFrom.' });
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
      } else if (!isCount && qty === 0 && freeQty === 0) {
        // UNDER COUNT THIS RULE INVERTS, which is why it is gated rather than
        // relaxed. A count sends qty 0 on every line, always — left as written
        // this refuses the whole document at save, one error per line.
        errors.push({
          field,
          message: `Line ${line.lineNo} has no quantity.`,
        });
      }

      if (!isCount && !line.uomId) {
        // uomId is optional on the SHARED DTO so that a count can omit it —
        // see SaveStockVoucherItemDto. On every other type svi_uom_id is NOT
        // NULL and nothing fills it in, so its absence is refused here rather
        // than reaching Postgres as a NOT NULL violation naming a column.
        errors.push({
          field,
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
            message: `Line ${line.lineNo}: a count line names no unit. It is counted in the base unit the book figure is held in, read from the balance row.`,
          });
        }
        if (qty !== 0 || freeQty !== 0) {
          // Refused, not silently zeroed: a client sending a quantity on a
          // count line thinks it is writing an adjustment, and an adjustment
          // that posts as a count is a variance nobody typed.
          errors.push({
            field,
            message: `Line ${line.lineNo}: a count line states what was FOUND, not a quantity to move. Send countedQty and leave qty at 0 — a quantity to move is an ADJUSTMENT.`,
          });
        }
        if (this.toDecimalNumber(line.costRate ?? 0) !== 0) {
          // §3.3 — the engine decides both directions. See the cost rule below.
          errors.push({
            field,
            message: `Line ${line.lineNo}: a count line carries no cost rate. An overage is valued from the document's rate source; a shortage at what the stock cost us, stamped by the engine.`,
          });
        }
        if (this.readRefusedBookQty(line) !== undefined) {
          // svi_book_qty is an ordinary writable numeric column, so nothing in
          // the database stops a client sending its own book figure — and a
          // book figure the client chose turns a variance into a wish.
          errors.push({
            field,
            message: `Line ${line.lineNo}: bookQty is read from stock_balance at save time and is never taken from the payload.`,
          });
        }
        if (line.countedQty === undefined || line.countedQty === null || line.countedQty === '') {
          // ABSENT IS NOT "0 FOUND", it is NOT COUNTED YET — and posting an
          // uncounted line as a total shortage is the single most expensive
          // mistake this screen can make.
          errors.push({
            field,
            message: `Line ${line.lineNo} has not been counted yet. Send countedQty: 0 to record that nothing was found — absent means the counter has not reached this line.`,
          });
        } else if (this.toDecimalNumber(line.countedQty) < 0) {
          // What the operator TYPES is a count, so it is a magnitude. Only the
          // derived svi_diff_qty is signed.
          errors.push({
            field,
            message: `Line ${line.lineNo}: countedQty is a count and cannot be negative. Only the derived difference is signed.`,
          });
        }
        if (!line.lotId) {
          // §3.4 — the lot is where the book figure came from, so a count line
          // cannot be typed from scratch. This is the "regenerate the count
          // sheet" path, caught before the balance lookup.
          errors.push({
            field,
            message: `Line ${line.lineNo} names no holding. A count line comes from the count sheet, which carries the lotId its book figure was read from.`,
          });
        }
        if (countedGodownId && line.godownId !== countedGodownId) {
          errors.push({
            field,
            message: `Line ${line.lineNo} is in a different godown than the one this count names. A count is per godown.`,
          });
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
            message: `Line ${line.lineNo} names no lot. A ${rules.displayName.toLowerCase()} moves existing stock — pick the holding from the balance, which carries its lotId.`,
          });
        }
      } else if (!isCount && line.lotId) {
        errors.push({
          field,
          message: `Line ${line.lineNo}: a ${rules.displayName.toLowerCase()} does not choose its own lot. The engine resolves it at post.`,
        });
      }

      if (this.toDecimalNumber(line.weightQty ?? 0) < 0) {
        errors.push({
          field,
          message: `Line ${line.lineNo}: weight is a magnitude and cannot be negative.`,
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
          message: `No stock reason ${reasonId} visible to this company. A reason is either the company's own or one shared with every company.`,
        });
        continue;
      }
      if (!reason.srmIsActive) {
        // Retired deliberately by an admin; quietly honouring it would undo
        // that decision one document at a time.
        errors.push({
          field: first.field,
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
        svhSyncDate: header.syncDate ? new Date(header.syncDate) : null,
        // Post is §7, not a status field. Nothing may create a POSTED document.
        svhStatus: 'DRAFT',
        svhCreatedBy: this.auditActor(actor),
      },
      select: { svhId: true, svhAccYear: true, svhRefno: true },
    });

    await this.replaceLines(tx, rules, dto, created.svhId, actor);
    await this.writeHeaderTotals(tx, created.svhId, header);

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
      changedOn: new Date(),
      remarks: `${rules.displayName} created`,
      deviceId: header.deviceId,
      sessionId: header.sessionId ?? null,
    });

    return created.svhId;
  }

  /**
   * THE TOTALS ARE THE SCREEN'S. Nothing here counts the lines or sums the grid.
   *
   * svh_line_count / svh_total_qty / svh_total_value / svh_total_value_wot are
   * ordinary writable columns and are taken verbatim from the header payload.
   * A property the payload OMITS is left out of the update entirely rather than
   * defaulted to 0 — on a create that lets the column's own DEFAULT 0 stand, on
   * an update it leaves the stored value alone, and in neither case does a
   * server-side fallback hide a grid that forgot to fill it. When nothing at
   * all is sent, no statement is issued.
   *
   * WHY THIS RUNS AFTER replaceLines, as its own UPDATE rather than as four
   * more keys on the create/update above: on any environment carrying the
   * engine DDL, stock.tr_svi_refresh_header re-sums these four columns on every
   * line write. Totals written before the lines would be silently replaced by
   * that trigger's sums; written after, the payload is what survives the save.
   *
   * A POST IS STILL THE ENGINE'S. stock.fn_svh_recompute re-derives these at
   * post time, so a posted document carries the engine's figures, not these.
   * Changing that is a schema change to DDL that does not live in this repo.
   */
  private async writeHeaderTotals(
    tx: Prisma.TransactionClient,
    svhId: string,
    header: SaveStockVoucherDto['header'],
  ): Promise<void> {
    const data: Prisma.StockVoucherUncheckedUpdateInput = {};
    if (header.lineCount !== undefined) {
      data.svhLineCount = header.lineCount;
    }
    if (header.totalQty !== undefined) {
      data.svhTotalQty = new Prisma.Decimal(this.toDecimalNumber(header.totalQty));
    }
    if (header.totalValue !== undefined) {
      data.svhTotalValue = new Prisma.Decimal(this.toDecimalNumber(header.totalValue));
    }
    if (header.totalValueWot !== undefined) {
      data.svhTotalValueWot = new Prisma.Decimal(this.toDecimalNumber(header.totalValueWot));
    }
    if (!Object.keys(data).length) {
      return;
    }

    await tx.stockVoucher.update({
      where: { svhId_svhAccYear: { svhId, svhAccYear: header.accYear } },
      data,
    });
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
        svhToBranchId: header.toBranchId ?? null,
        svhSupplierId: header.supplierId ?? null,
        svhPartyRef: header.partyRef ?? null,
        svhReasonId: header.reasonId ?? null,
        svhRateSource: this.resolveRateSource(rules, header),
        svhRemarks: header.remarks ?? null,
        ...this.docDatetimeData(header),
        ...this.linkSourceData(header),
        ...this.freezeData(header),
        svhSyncDate: header.syncDate ? new Date(header.syncDate) : null,
        svhVersionNo: { increment: 1 },
        svhModifiedOn: new Date(),
        svhModifiedBy: this.auditActor(actor),
      },
    });

    await this.replaceLines(tx, rules, dto, svhId, actor);
    await this.writeHeaderTotals(tx, svhId, header);

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

    const isCount = rules.quantityMode === 'COUNT';
    const zeroCost = isCount || rules.zeroesLineCost === true;
    const holdings = isCount ? await this.loadCountHoldings(tx, header, lines) : null;

    const data = lines.map((line) => {
      const holding = holdings?.get(this.holdingKey(line.lotId, line.godownId, line.bucket));
      const qty = isCount ? 0 : this.toDecimalNumber(line.qty);
      const freeQty = isCount ? 0 : this.toDecimalNumber(line.freeQty ?? 0);
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
        sviToBaseFactor: new Prisma.Decimal(isCount ? 1 : this.toDecimalNumber(line.toBaseFactor)),
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
        sviLotId: isCount || rules.requiresLot ? (line.lotId ?? null) : null,
        sviBucket: (line.bucket ?? 'SALEABLE') satisfies StockBucket,
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
        sviQty: new Prisma.Decimal(qty),
        // NOT qty x factor. The base quantities come from the payload as the
        // grid computed them — svi_value is GENERATED from these two, so they
        // are what the document is valued on. A count carries neither: its
        // quantity is the variance, and svi_diff_qty is GENERATED.
        sviBaseQty: new Prisma.Decimal(isCount ? 0 : this.toDecimalNumber(line.baseQty)),
        sviFreeQty: new Prisma.Decimal(freeQty),
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
            : { sviFreeBaseQty: new Prisma.Decimal(this.toDecimalNumber(line.freeBaseQty)) }),
        // Weight is NOT derived from the quantity: a 10kg bag that weighs 9.7kg
        // opens at what the scale said, and no conversion factor knows that.
        sviWeightQty: new Prisma.Decimal(this.toDecimalNumber(line.weightQty ?? 0)),
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
        sviCostRate: new Prisma.Decimal(zeroCost ? 0 : this.toDecimalNumber(line.costRate)),
        // Left at 0 when not sent: the engine derives it from svi_tax_perc at
        // post and writes it back (20 ÷ 1.05 = 19.047619).
        sviCostRateWot: new Prisma.Decimal(
          zeroCost ? 0 : this.toDecimalNumber(line.costRateWot ?? 0),
        ),
        sviLandedRate: new Prisma.Decimal(
          zeroCost ? 0 : this.toDecimalNumber(line.landedRate ?? 0),
        ),
        sviTaxPerc: new Prisma.Decimal(zeroCost ? 0 : this.toDecimalNumber(line.taxPerc ?? 0)),
        sviReasonId: line.reasonId ?? null,
        sviSyncDate: line.syncDate ? new Date(line.syncDate) : null,
        sviRemarks: line.remarks ?? null,
        sviCreatedBy: this.auditActor(actor),
        // svi_value, svi_value_wot and svi_diff_qty are GENERATED ALWAYS ...
        // STORED and are absent from this object on purpose — Postgres rejects
        // any write to them, including a write of the value it would compute.
      };
    });

    await tx.stockVoucherItem.createMany({ data });

    await this.auditLogService.logEntityChange(
      {
        // 'insert', not 'update', even though this replaced a line set: the
        // audit service refuses an 'update' whose originalRecord is null, and
        // the pre-delete line set is not read back here. Every other line grid
        // logs a replacement the same way — see quotation/sale-order items.
        action: 'insert',
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
          message: `Line ${line.lineNo} names a holding this godown no longer has — regenerate the count sheet. (Someone may have sold the last of this lot while the count was being taken.)`,
        });
        return;
      }
      if (holding.itemId !== line.itemId) {
        // The lot is the holding's identity, so an item that disagrees with it
        // means the line was assembled from two different sheets.
        errors.push({
          field: `lines.${index}`,
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
             svh.svh_to_branch_id,
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
        LEFT JOIN stock.stock_reason_master srm  ON srm.srm_id = svh.svh_reason_id
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
             svi.svi_barcode,
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
             svi.svi_sync_date,
             svi.svi_value,
             svi.svi_value_wot,
             svi.svi_lot_id,
             svi.svi_remarks
        FROM stock.stock_voucher_item svi
        JOIN inventory.item_master itm            ON itm.item_id = svi.svi_item_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = svi.svi_uom_id
        LEFT JOIN inventory.item_unit_master unt  ON unt.unit_id = iuc.iuc_unit_id
        LEFT JOIN inventory.godown_locations gdl  ON gdl.gdl_id = svi.svi_godown_id
        LEFT JOIN stock.stock_reason_master srm   ON srm.srm_id = svi.svi_reason_id
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

    const isCount = rules.quantityMode === 'COUNT';

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
                    AND sml.sml_txn_type    = 'OPENING'
                    AND sml.sml_is_deleted  = false
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
      )
      SELECT keyed.svi_id                             AS "sviId",
             keyed.svi_line_no                        AS "lineNo",
             keyed.svi_split_no                       AS "splitNo",
             keyed.svi_item_id                        AS "itemId",
             itm.item_code                            AS "itemCode",
             itm.item_name_en                         AS "itemName",
             CASE
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
               WHEN ${rules.isInward}::boolean AND keyed.svi_cost_rate = 0
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
               ELSE NULL
             END                                      AS "problem"
        FROM keyed
        JOIN opened ON opened.svi_id = keyed.svi_id
        JOIN bal    ON bal.svi_id    = keyed.svi_id
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
    /**
     * Run INSIDE the post's transaction, immediately after the engine call and
     * before the commit.
     *
     * It exists for one thing: `stt_lr_no`, `stt_vehicle_no` and
     * `stt_expected_on` are columns on stock_transit that
     * `fn_svh_post_transfer` never sets and nothing else in the engine writes
     * either (§0.3 of the transfer plan). The API has to write them itself, and
     * writing them in a SECOND transaction means a despatch can commit with the
     * lorry missing — a despatch note with no vehicle number, and no way to
     * tell afterwards whether it was never sent or lost on the way in.
     *
     * Deliberately narrow: it gets the transaction client and the row count,
     * and nothing here inspects what it does. It must not be used to write
     * svh_status — see the note on this class.
     */
    afterPost?: (tx: Prisma.TransactionClient, rowsPosted: number) => Promise<void>,
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

    // One instant for the ledger rows, the balance rows, the header stamp and
    // the status-trail row alike, so a trail sorts unambiguously against the
    // movements that produced it.
    const postedOn = new Date();

    const rowsPosted = await this.prisma.$transaction(async (tx) => {
      let posted: number;
      if (usesInProcessPosting(rules)) {
        // THE GENERIC PATH IS POSTED HERE, NOT BY THE DATABASE. stock.fn_svh_post
        // does not exist on this deployment — see stock-voucher-posting.helper
        // for what that costs and what has to change if the engine share is ever
        // installed.
        posted = await postStockVoucher(tx, { rules, svhId, accYear, actor, postedOn });
      } else {
        // The transfer paths still belong to the engine. The FUNCTION NAME comes
        // from the rule record, not from a branch here — see
        // StockVoucherTypeRules.postFunction. It is interpolated rather than
        // bound because a function name is not a parameter in SQL; the value is
        // a literal owned by a controller and never reaches this service from a
        // payload, and assertPostFunction refuses anything that is not one of
        // the three known names before it gets this far.
        const fn = Prisma.raw(this.assertPostFunction(rules));
        const [row] = await tx.$queryRaw<Array<{ rows: number }>>`
          SELECT ${fn}(${svhId}::uuid, ${accYear}::bpchar, ${actor}::uuid) AS rows
        `;
        posted = Number(row?.rows ?? 0);
      }
      // Inside the transaction on purpose — if this throws, the post rolls back
      // with it rather than leaving a committed despatch missing its lorry.
      await afterPost?.(tx, posted);
      await this.logStatusChange(tx, {
        rules,
        svhId,
        accYear,
        companyId,
        branchId,
        tenantId: existing.svhTenantId ?? null,
        refno: existing.svhRefno,
        fromStatus: existing.svhStatus,
        toStatus: 'POSTED',
        actor,
        changedOn: postedOn,
        remarks: `${rules.displayName} posted — ${posted} ledger rows`,
      });
      return posted;
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

    const cancelledOn = new Date();

    const rowsReversed = await this.prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<Array<{ rows: number }>>`
        SELECT stock.fn_svh_cancel(${svhId}::uuid, ${accYear}::bpchar, ${trimmedReason}, ${actor}::uuid) AS rows
      `;
      const reversed = Number(row?.rows ?? 0);
      // Inside the reversal's own transaction: a cancellation whose ledger
      // reversal committed and whose trail row did not is a document that says
      // CANCELLED with nothing saying who cancelled it or why.
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
            message: `A ${rules.displayName.toLowerCase()} states its own lines; only a count generates them from the book.`,
          },
        ],
      );
    }
    const take = this.clamp(query.limit, DEFAULT_REPORT_LIMIT, MAX_REPORT_LIMIT);
    const skip = Math.max(query.offset ?? 0, 0);
    const includeZero = query.includeZero ?? true;

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
             sbl.sbl_stock_value
        FROM stock.stock_balance sbl
        JOIN stock.stock_lot slt                   ON slt.slt_id = sbl.sbl_lot_id
        JOIN inventory.item_master itm             ON itm.item_id = sbl.sbl_item_id
        LEFT JOIN inventory.godown_locations gdl   ON gdl.gdl_id = sbl.sbl_godown_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = sbl.sbl_base_uom_id
        LEFT JOIN inventory.item_unit_master unt   ON unt.unit_id = iuc.iuc_unit_id
       WHERE sbl.sbl_company_id = ${query.companyId}::uuid
         AND sbl.sbl_branch_id  = ${query.branchId}::uuid
         AND sbl.sbl_godown_id  = ${query.godownId}::uuid
         AND sbl.sbl_is_deleted = false
         AND (${query.bucket ?? null}::text IS NULL OR sbl.sbl_bucket = ${query.bucket ?? null}::text)
         AND (${query.itemGroupId ?? null}::uuid IS NULL OR itm.item_group_id = ${query.itemGroupId ?? null}::uuid)
         AND (${includeZero}::boolean OR sbl.sbl_on_hand_qty <> 0)
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
      );
    }
    return existing;
  }

  /**
   * The three engine entry points, by name.
   *
   * `Prisma.raw` does not escape, so the function name must not be able to
   * become anything a controller did not write. It is a literal in a rule
   * record today and unreachable from any payload — this allowlist is what
   * keeps it that way when the twelfth screen adds a rule record by copying the
   * eleventh, and it turns a typo into a 500 naming the field rather than a
   * confusing syntax error from Postgres.
   */
  private assertPostFunction(rules: StockVoucherTypeRules): string {
    if (!STOCK_POST_FUNCTIONS.includes(rules.postFunction)) {
      throw new InternalServerErrorException(
        `${rules.voucherType} is wired to post through ${rules.postFunction}, which is not one of ${STOCK_POST_FUNCTIONS.join(', ')}.`,
      );
    }
    return rules.postFunction;
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
      toBranchId: row.svh_to_branch_id,
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
      barcode: row.svi_barcode,
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
      syncDate: row.svi_sync_date?.toISOString() ?? null,
      value: toNullableNumber(row.svi_value) ?? 0,
      valueWot: toNullableNumber(row.svi_value_wot) ?? 0,
      lotId: row.svi_lot_id,
      remarks: row.svi_remarks,
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

  private toDecimalNumber(value: string | number | null | undefined): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
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
