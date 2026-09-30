import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import {
  throwStockNotFound,
  throwStockUnprocessable,
} from 'src/common/utils/module-service.utils';
import { AppSettingValueService } from '../../settings/appSettings/app-setting-value.service';
import { StockVoucherService } from '../stock-voucher/stock-voucher.service';
import { effectivePolicyCte, lotIdentityKeyColumns } from '../stock-voucher/stock-voucher-posting.helper';
import type { SaveStockVoucherDto } from '../stock-voucher/dto/save-stock-voucher.dto';
import {
  STOCK_SRC_MODULE,
  type StockErrorDetail,
  type StockErrorResponse,
  type StockVoucherCancelResult,
  type StockVoucherDeleteResult,
  type StockVoucherLineProblem,
  type StockVoucherPayload,
  type StockVoucherPostResult,
  type StockVoucherSaveResult,
  type StockVoucherTypeRules,
} from '../stock-voucher/types/stock-voucher.types';
import type { SaveStockAdjustmentDto, SaveStockAdjustmentItemDto } from './dto/save-stock-adjustment.dto';
import type { PickStockQueryDto } from './dto/stock-adjustment-query.dto';
import {
  BUCKET_MOVE_KIND,
  BUCKET_MOVE_TXN_TYPES,
  EXPIRY_GRACE_SETTING_KEY,
  RELOT_IN_CODE,
  RELOT_OUT_CODE,
  STOCK_ADJUSTMENT_RULES,
  isStockAdjustmentKind,
  type StockAdjustmentDocKind,
  type StockAdjustmentSaveKind,
} from './stock-adjustment.rules';

/** One line as every check below sees it — from the payload at save, from the rows at validate / post. */
interface AdjustmentLine {
  index: number;
  lineNo: number;
  sviId: string | null;
  itemId: string;
  itemName: string | null;
  godownId: string;
  lotId: string | null;
  bucket: string;
  /** A move line's destination bucket; null on every other line. */
  toBucket: string | null;
  /** The payload keyed a NEGATIVE quantity (save only; rows are magnitudes). */
  keyedNegative: boolean;
  /** In BASE units, a magnitude. */
  baseQty: number;
  freeBaseQty: number;
  /** The sign the screen keyed (payload) or the stored `svi_direction` (rows); 0 when neither says. */
  sign: 1 | -1 | 0;
  reasonId: string | null;
  remarks: string | null;
  baseUomId: string;
  /** What an inward line states; the item's policy decides which of it names the lot. */
  identity: LineIdentity;
}

/** The six lot-identity dimensions as a line states them — decimals as strings, the date as YYYY-MM-DD. */
interface LineIdentity {
  batchNo: string | null;
  mrp: string | null;
  salePrice: string | null;
  expiryDate: string | null;
  serialNo: string | null;
  supplierId: string | null;
}

/** Where a lotless inward line's identity lands, keyed as the engine keys it. */
interface ResolvedInward {
  /** The existing lot the identity resolves to; null = the post would open a new one. */
  lotId: string | null;
  /** The dimensions the item's policy tracks on the document date ('batch', 'expiry', …); empty = none. */
  tracked: string[];
}

interface ReasonRow {
  srm_id: string;
  srm_code: string;
  srm_name: string;
  srm_direction: string;
  srm_allowed_txn_types: string[] | null;
  srm_is_active: boolean;
  srm_require_remarks: boolean;
}

interface LotRow {
  slt_id: string;
  slt_item_id: string;
  slt_expiry_date: Date | null;
  slt_base_uom_id: string;
  slt_batch_no: string | null;
}

interface HeaderFacts {
  /** The stored kind, or BUCKET_MOVE for an ADJUSTMENT whose lines move buckets. */
  kind: StockAdjustmentSaveKind;
  companyId: string;
  branchId: string;
  docDate: string;
  fromGodownId: string | null;
  toGodownId: string | null;
  reasonId: string | null;
  remarks: string | null;
}

/** One row of the pick-stock picker (REVIEW query 5): balance grain, available > 0. */
export interface PickStockRow {
  sblId: string;
  itemId: string;
  itemCode: string | null;
  itemName: string;
  godownId: string;
  lotId: string;
  bucket: string;
  batchNo: string | null;
  mfgDate: string | null;
  expiryDate: string | null;
  mrp: number | null;
  salePrice: number | null;
  serialNo: string | null;
  /**
   * The LOT's supplier (`slt_supplier_id`), when the item's policy tracks it.
   * With bucket=DAMAGED this row set is the "what goes back to which
   * supplier" list; the screen groups it by supplier.
   */
  supplierId: string | null;
  supplierName: string | null;
  baseUomId: string;
  unitName: string | null;
  onHandQty: number;
  reservedQty: number;
  availableQty: number;
  avgCostRate: number;
  stockValue: number;
  firstInDate: string | null;
}

/** A loaded adjustment: the shared payload plus what the Type selector shows. */
export type StockAdjustmentPayload = StockVoucherPayload & { kind: StockAdjustmentDocKind };

/**
 * The adjustment family — ADJUSTMENT, ISSUE, DAMAGE, EXPIRY_WRITEOFF, the
 * re-lot pair and the bucket move — as one service over the shared stock voucher service
 * (plan-nestjs-stock-adjustments). Everything type-agnostic — save, load,
 * post, cancel, delete, the trail, the accounts voucher — is
 * `StockVoucherService`'s and the engine's; what is HERE is what the four
 * kinds mean:
 *
 *  1. WHICH DOCUMENT a request is about. The screen has a Type selector, so the
 *     kind comes from the payload on a save and from the stored row on
 *     everything else; the matching rule record is then pinned exactly as a
 *     dedicated controller would pin it.
 *  2. THE REASON RULES (§0, §3): every line moves under a reason, the reason's
 *     direction fixes the sign (a BOTH reason takes it from the signed
 *     quantity), a write-off cannot cite an IN reason, `srm_require_remarks`
 *     is API-enforced.
 *  3. THE OUTWARD RULES: the picked holding covers the quantity (the engine
 *     refuses again at post, BLOCK by decision D-A1), an expiry write-off
 *     names an expired lot (grace: `stock.expiry_writeoff_grace_days`).
 *  4. THE RE-LOT PAIR: RELOT_OUT and RELOT_IN balance per item, different lots,
 *     the IN valued at the average the OUT was relieved at, no accounts leg.
 *  5. THE BUCKET MOVE (D-A3, notes 60): ONE line per move — `bucket` from,
 *     `toBucket` to — which the engine lays as a BUCKET_OUT / BUCKET_IN pair on
 *     the same lot at the OUT's cost. The lot is required (it names the
 *     supplier), the from-holding must cover it (BLOCK), the reason must be a
 *     move reason, and a document is all moves or none. No accounts leg.
 *
 * The checks run at SAVE over the payload and again at VALIDATE / POST over the
 * stored rows, from one function, so the screen and the post cannot disagree.
 */
@Injectable()
export class StockAdjustmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockVoucherService: StockVoucherService,
    private readonly requestContextService: RequestContextService,
    private readonly appSettings: AppSettingValueService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // save
  // ──────────────────────────────────────────────────────────────────────────

  async save(dto: SaveStockAdjustmentDto): Promise<StockVoucherSaveResult> {
    const kind = dto.header.voucherType;
    const rules = STOCK_ADJUSTMENT_RULES[kind];
    // Another module's link marks a SHADOW voucher (a sale bill's, a
    // challan's), which grid 122 and kindOf leave out — an adjustment saved
    // with one would be a document nobody can list or open again.
    const linkModule = dto.header.linkSrcModule?.trim() || null;
    if (linkModule && linkModule !== STOCK_SRC_MODULE) {
      throwStockUnprocessable<StockErrorDetail, StockErrorResponse>(`This ${rules.displayName.toLowerCase()} cannot be saved`, [
        {
          field: 'header.linkSrcModule',
          message: `An adjustment is the stock module's own document: linkSrcModule may be ${STOCK_SRC_MODULE} or empty, not ${linkModule}. A ${linkModule} document moves its stock through its own module.`,
        },
      ]);
    }
    const header: HeaderFacts = {
      kind,
      companyId: dto.header.companyId,
      branchId: dto.header.branchId,
      docDate: dto.header.docDate,
      fromGodownId: dto.header.fromGodownId ?? null,
      toGodownId: dto.header.toGodownId ?? null,
      reasonId: dto.header.reasonId ?? null,
      remarks: dto.header.remarks ?? null,
    };
    const lines = dto.lines.map((line, index): AdjustmentLine => {
      const baseQty = Number(line.baseQty ?? 0);
      const qty = Number(line.qty ?? 0);
      const sign: 1 | -1 | 0 = qty < 0 || baseQty < 0 ? -1 : qty > 0 || baseQty > 0 ? 1 : 0;
      return {
        index,
        lineNo: line.lineNo,
        sviId: null,
        itemId: line.itemId,
        itemName: null,
        godownId: line.godownId,
        lotId: line.lotId ?? null,
        bucket: line.bucket ?? 'SALEABLE',
        toBucket: line.toBucket ?? null,
        keyedNegative: sign < 0,
        baseQty: Math.abs(baseQty),
        freeBaseQty: Math.abs(Number(line.freeBaseQty ?? 0)) + Math.abs(Number(line.freeQty ?? 0)),
        sign,
        reasonId: line.reasonId ?? header.reasonId,
        remarks: line.remarks?.trim() || header.remarks?.trim() || null,
        baseUomId: line.baseUomId,
        identity: {
          batchNo: line.batchNo ?? null,
          mrp: line.mrp === null || line.mrp === undefined ? null : String(line.mrp),
          salePrice: line.salePrice === null || line.salePrice === undefined ? null : String(line.salePrice),
          expiryDate: line.expiryDate ? line.expiryDate.slice(0, 10) : null,
          serialNo: line.serialNo ?? null,
          supplierId: line.supplierId ?? null,
        },
      };
    });
    const reasons = await this.loadReasons(header.companyId, lines);
    const verdict = await this.check(header, lines, reasons);
    this.refuse(rules, `This ${rules.displayName.toLowerCase()} cannot be saved`, verdict, lines);

    // A re-lot and a move carry their value across: the IN is valued at the
    // average the OUT is relieved at, so neither side keys a cost and the
    // header says so.
    const relot = lines.some((line) => this.isRelot(reasons, line));
    const carried = relot || kind === BUCKET_MOVE_KIND;
    const mapped: SaveStockVoucherDto = {
      header: {
        ...dto.header,
        // A move is stored as an ADJUSTMENT; the rule record says so too.
        voucherType: rules.voucherType,
        rateSource: carried ? 'AVG_COST' : (dto.header.rateSource ?? undefined),
      },
      lines: dto.lines.map((line, index) => this.toSharedLine(kind, line, lines[index], reasons)),
    } as unknown as SaveStockVoucherDto;
    return this.stockVoucherService.save(rules, mapped);
  }

  /** The shared line: magnitudes, the resolved sign, no free goods, no keyed cost on an outward line. */
  private toSharedLine(
    kind: StockAdjustmentSaveKind,
    line: SaveStockAdjustmentItemDto,
    view: AdjustmentLine,
    reasons: Map<string, ReasonRow>,
  ): Record<string, unknown> {
    const direction = this.directionOf(view, reasons);
    const outward = direction < 0;
    return {
      lineNo: line.lineNo,
      itemId: line.itemId,
      uomId: line.uomId,
      baseUomId: line.baseUomId,
      toBaseFactor: line.toBaseFactor,
      qty: Math.abs(Number(line.qty)),
      baseQty: Math.abs(Number(line.baseQty)),
      freeQty: 0,
      freeBaseQty: 0,
      godownId: line.godownId,
      lotId: line.lotId ?? null,
      bucket: line.bucket ?? 'SALEABLE',
      toBucket: kind === BUCKET_MOVE_KIND ? (line.toBucket ?? null) : null,
      barcode: line.barcode ?? null,
      batchNo: line.batchNo ?? null,
      mfgDate: line.mfgDate ?? null,
      expiryDate: line.expiryDate ?? null,
      mrp: line.mrp ?? null,
      salePrice: line.salePrice ?? null,
      serialNo: line.serialNo ?? null,
      supplierId: line.supplierId ?? null,
      // An outward line is stamped by the engine at the branch average; a keyed
      // cost would let a write-off value itself. A RELOT_IN is valued the same
      // way, so the pair carries the same figure.
      costRate: outward || this.isRelot(reasons, view) ? 0 : (line.costRate ?? 0),
      costRateWot: outward || this.isRelot(reasons, view) ? 0 : (line.costRateWot ?? 0),
      // (a move line is outward: directionOf says −1 whenever toBucket is set)
      taxPerc: line.taxPerc ?? 0,
      reasonId: line.reasonId ?? null,
      remarks: line.remarks ?? null,
      // ADJUSTMENT lines carry their resolved sign; the other kinds always move
      // out and the reason / type say so. A move line's OWN direction is out
      // of its bucket (the IN half is the engine's), and stamping it keeps a
      // BOTH move reason from being read as inward — the engine then values
      // the pair at the branch average.
      direction: kind === BUCKET_MOVE_KIND ? -1 : kind === 'ADJUSTMENT' ? direction : null,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // load / validate / post / cancel / delete — the kind comes from the row
  // ──────────────────────────────────────────────────────────────────────────

  async getOne(svhId: string, accYear: string, companyId: string, branchId: string): Promise<StockAdjustmentPayload> {
    const { rules, docKind } = await this.kindOf(svhId, accYear, companyId, branchId);
    const payload = await this.stockVoucherService.getById(rules, svhId, accYear, companyId, branchId);
    return { ...payload, kind: docKind };
  }

  async validate(
    svhId: string,
    accYear: string,
    companyId: string,
    branchId: string,
  ): Promise<StockVoucherLineProblem[]> {
    const { rules, header } = await this.kindOf(svhId, accYear, companyId, branchId);
    const shared = await this.stockVoucherService.validate(rules, svhId, accYear, companyId, branchId);
    const lines = await this.loadLines(svhId, accYear, header);
    const reasons = await this.loadReasons(companyId, lines);
    const verdict = await this.check(header, lines, reasons);
    // The adjustment rule for a line wins over the shared preflight's: it is
    // the more specific sentence, and both are refused at post anyway.
    const byLineNo = new Map<number, string>();
    for (const [index, message] of verdict) {
      byLineNo.set(lines[index].lineNo, message);
    }
    return shared.map((row) => ({ ...row, problem: byLineNo.get(row.lineNo) ?? row.problem }));
  }

  async post(args: {
    svhId: string;
    accYear: string;
    companyId: string;
    branchId: string;
    userId?: string;
  }): Promise<StockVoucherPostResult> {
    const { rules, header, docKind } = await this.kindOf(args.svhId, args.accYear, args.companyId, args.branchId);
    const lines = await this.loadLines(args.svhId, args.accYear, header);
    const reasons = await this.loadReasons(args.companyId, lines);
    const verdict = await this.check(header, lines, reasons);
    this.refuse(rules, `This ${rules.displayName.toLowerCase()} cannot be posted`, verdict, lines);
    // The shared post: the DRAFT check, the preflight, the header lock, the
    // engine (per-line direction and txn type from the reason, BLOCK on any
    // holding it would drive negative), the header recompute, the accounts
    // voucher on the Stock Journal type, the trail row — one transaction. A
    // re-lot is checked once more in it, against the lots the engine resolved.
    return this.stockVoucherService.post(
      rules,
      args.svhId,
      args.accYear,
      args.companyId,
      args.branchId,
      args.userId,
      docKind === 'RELOT' ? (tx) => this.assertRelotLandsElsewhere(tx, rules, args.svhId, args.accYear) : undefined,
    );
  }

  async cancel(args: {
    svhId: string;
    accYear: string;
    companyId: string;
    branchId: string;
    reason: string;
    userId?: string;
  }): Promise<StockVoucherCancelResult> {
    const { rules } = await this.kindOf(args.svhId, args.accYear, args.companyId, args.branchId);
    return this.stockVoucherService.cancel(
      rules,
      args.svhId,
      args.accYear,
      args.reason,
      args.companyId,
      args.branchId,
      args.userId,
    );
  }

  async remove(
    svhId: string,
    accYear: string,
    companyId: string,
    branchId: string,
    userId?: string,
  ): Promise<StockVoucherDeleteResult> {
    const { rules } = await this.kindOf(svhId, accYear, companyId, branchId);
    return this.stockVoucherService.softDelete(rules, svhId, accYear, companyId, branchId, userId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // the pickers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * The "pick stock from balance" picker: what the godown holds, one row per
   * holding with available > 0 — in one bucket, or in every bucket when the
   * query names none (each row carries its own).
   */
  async pickStock(query: PickStockQueryDto): Promise<PickStockRow[]> {
    const search = query.search?.trim() ? `%${query.search.trim()}%` : null;
    const rows = await this.prisma.$queryRaw<
      Array<{
        sbl_id: string;
        sbl_item_id: string;
        item_code: string | null;
        item_name: string;
        sbl_godown_id: string;
        sbl_lot_id: string;
        sbl_bucket: string;
        slt_batch_no: string | null;
        slt_mfg_date: Date | null;
        slt_expiry_date: Date | null;
        slt_mrp: Prisma.Decimal | null;
        slt_sale_price: Prisma.Decimal | null;
        slt_serial_no: string | null;
        slt_supplier_id: string | null;
        sup_name: string | null;
        sbl_base_uom_id: string;
        unit_name: string | null;
        sbl_on_hand_qty: Prisma.Decimal | null;
        sbl_reserved_qty: Prisma.Decimal;
        sbl_available_qty: Prisma.Decimal | null;
        sbl_avg_cost_rate: Prisma.Decimal;
        sbl_stock_value: Prisma.Decimal;
        sbl_first_in_date: Date | null;
      }>
    >`
      SELECT b.sbl_id, b.sbl_item_id, itm.item_code, itm.item_name_en AS item_name,
             b.sbl_godown_id, b.sbl_lot_id, b.sbl_bucket,
             slt.slt_batch_no, slt.slt_mfg_date, slt.slt_expiry_date, slt.slt_mrp, slt.slt_sale_price, slt.slt_serial_no,
             slt.slt_supplier_id, sup.sup_name,
             b.sbl_base_uom_id, unt.unit_name,
             b.sbl_on_hand_qty, b.sbl_reserved_qty, b.sbl_available_qty,
             b.sbl_avg_cost_rate, b.sbl_stock_value, b.sbl_first_in_date
        FROM stock.stock_balance b
        JOIN stock.stock_lot slt ON slt.slt_id = b.sbl_lot_id
        JOIN inventory.item_master itm ON itm.item_id = b.sbl_item_id
        LEFT JOIN purchase.suppliers sup ON sup.sup_id = slt.slt_supplier_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = b.sbl_base_uom_id
        LEFT JOIN inventory.item_unit_master unt ON unt.unit_id = iuc.iuc_unit_id
       WHERE b.sbl_company_id = ${query.companyId}::uuid
         AND b.sbl_branch_id  = ${query.branchId}::uuid
         AND b.sbl_godown_id  = ${query.godownId}::uuid
         AND b.sbl_is_deleted = false
         AND b.sbl_available_qty > 0
         AND (${query.itemId ?? null}::uuid IS NULL OR b.sbl_item_id = ${query.itemId ?? null}::uuid)
         AND (${query.bucket ?? null}::text IS NULL OR b.sbl_bucket = ${query.bucket ?? null}::text)
         AND (${search}::text IS NULL
              OR itm.item_name_en ILIKE ${search}::text
              OR itm.item_code ILIKE ${search}::text
              OR slt.slt_batch_no ILIKE ${search}::text)
       ORDER BY itm.item_name_en, slt.slt_expiry_date NULLS LAST, b.sbl_first_in_date NULLS LAST, slt.slt_batch_no,
                b.sbl_bucket
       LIMIT ${query.limit ?? 200}
    `;
    return rows.map((r) => ({
      sblId: r.sbl_id,
      itemId: r.sbl_item_id,
      itemCode: r.item_code,
      itemName: r.item_name,
      godownId: r.sbl_godown_id,
      lotId: r.sbl_lot_id,
      bucket: r.sbl_bucket,
      batchNo: r.slt_batch_no,
      mfgDate: isoDate(r.slt_mfg_date),
      expiryDate: isoDate(r.slt_expiry_date),
      mrp: r.slt_mrp === null ? null : Number(r.slt_mrp),
      salePrice: r.slt_sale_price === null ? null : Number(r.slt_sale_price),
      serialNo: r.slt_serial_no,
      supplierId: r.slt_supplier_id,
      supplierName: r.sup_name,
      baseUomId: r.sbl_base_uom_id,
      unitName: r.unit_name,
      onHandQty: Number(r.sbl_on_hand_qty ?? 0),
      reservedQty: Number(r.sbl_reserved_qty),
      availableQty: Number(r.sbl_available_qty ?? 0),
      avgCostRate: Number(r.sbl_avg_cost_rate),
      stockValue: Number(r.sbl_stock_value),
      firstInDate: isoDate(r.sbl_first_in_date),
    }));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // the checks — one function, run over the payload and over the rows
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Every rule of §3 the shared service does not already make, as one message
   * per line (keyed by the line's index). The shared preflight / save keeps its
   * own: identity completeness, the reason's visibility and allowed types, the
   * freeze, the zero-cost inward.
   */
  private async check(
    header: HeaderFacts,
    lines: AdjustmentLine[],
    reasons: Map<string, ReasonRow>,
  ): Promise<Map<number, string>> {
    const out = new Map<number, string>();
    const say = (line: AdjustmentLine, message: string) => {
      if (!out.has(line.index)) {
        out.set(line.index, `Line ${line.lineNo}: ${message}`);
      }
    };
    const kind = header.kind;
    const docGodown = this.documentGodown(header);

    // ── the header's godown, and every line in it ─────────────────────────
    for (const line of lines) {
      if (docGodown && line.godownId !== docGodown) {
        say(line, 'sits in a different godown from the document. One adjustment, one godown.');
      }
      if (line.freeBaseQty > 0) {
        say(line, 'carries a free quantity. An adjustment has no free goods: state the quantity.');
      }
      if (line.baseQty <= 0) {
        say(line, 'has no quantity.');
      }
    }

    // ── the bucket move: all moves or none, one lot, a real destination ───
    const moving = kind === BUCKET_MOVE_KIND;
    for (const line of lines) {
      if (!moving) {
        if (line.toBucket) {
          say(
            line,
            `names a bucket to move to (${line.toBucket}), but this is a ${STOCK_ADJUSTMENT_RULES[kind].displayName.toLowerCase()}. A document is all moves or none: key the move as Move stock.`,
          );
        }
        continue;
      }
      if (line.keyedNegative) {
        say(line, 'moves a negative quantity. State the quantity moved; the buckets say which way it goes.');
      } else if (!line.toBucket) {
        say(line, `names no bucket to move to. A move takes the stock out of ${line.bucket} and into another bucket — name it (toBucket). A document is all moves or none.`);
      } else if (line.toBucket === line.bucket) {
        say(line, `moves stock from ${line.bucket} into ${line.bucket}. Pick a different bucket.`);
      } else if (!line.lotId) {
        say(line, 'names no lot. A move is about one lot — the lot is what names the supplier the stock goes back to. Pick it from the balance.');
      }
    }

    // ── the reason, and the direction it fixes ────────────────────────────
    for (const line of lines) {
      const reason = line.reasonId ? reasons.get(line.reasonId) : undefined;
      if (!line.reasonId) {
        say(line, 'names no reason, and the header names none either. Every adjustment line says why.');
        continue;
      }
      if (!reason) {
        say(line, `names a reason (${line.reasonId}) this company cannot see.`);
        continue;
      }
      if (!reason.srm_is_active) {
        say(line, `cites ${reason.srm_code} (${reason.srm_name}), which is inactive.`);
        continue;
      }
      if (moving) {
        // A move cites a move reason — one whose allowed types name
        // BUCKET_OUT / BUCKET_IN — never an any-movement one: PILFERAGE on a
        // move would read as a write-off that wrote nothing off.
        if (!this.allowsMove(reason)) {
          say(
            line,
            `cites ${reason.srm_code} (${reason.srm_name}), which is not a stock-move reason. Cite MOVE_DAMAGED, MOVE_SALEABLE or a reason of your own that allows BUCKET_OUT / BUCKET_IN.`,
          );
        } else if (reason.srm_require_remarks && !line.remarks) {
          say(line, `cites ${reason.srm_code} (${reason.srm_name}), which requires a remark saying what happened.`);
        }
        continue;
      }
      if (this.onlyMove(reason)) {
        say(
          line,
          `cites ${reason.srm_code} (${reason.srm_name}), a stock-move reason. Key it as Move stock and name the bucket the stock moves to.`,
        );
        continue;
      }
      if (kind !== 'ADJUSTMENT' && reason.srm_direction === 'IN') {
        say(
          line,
          `cites ${reason.srm_code} (${reason.srm_name}), which brings stock IN. A ${STOCK_ADJUSTMENT_RULES[kind].displayName.toLowerCase()} only takes stock out.`,
        );
        continue;
      }
      if (reason.srm_direction === 'IN' && line.sign < 0) {
        say(line, `cites ${reason.srm_code} (${reason.srm_name}), which brings stock IN, with a negative quantity.`);
        continue;
      }
      if (reason.srm_direction === 'BOTH' && kind === 'ADJUSTMENT' && line.sign === 0) {
        say(line, `cites ${reason.srm_code} (${reason.srm_name}), whose direction is BOTH: the quantity must be signed (+ in, − out).`);
        continue;
      }
      if (reason.srm_require_remarks && !line.remarks) {
        say(line, `cites ${reason.srm_code} (${reason.srm_name}), which requires a remark saying what happened.`);
        continue;
      }
    }

    // ── the lots: named, of the item, available, and expired when written off ─
    const lotIds = [...new Set(lines.map((l) => l.lotId).filter((id): id is string => !!id))];
    const lots = await this.loadLots(lotIds);
    const wanted = new Map<string, number>();
    for (const line of lines) {
      if (line.lotId && this.directionOf(line, reasons) < 0) {
        const key = `${line.lotId}|${line.godownId}|${line.bucket}`;
        wanted.set(key, (wanted.get(key) ?? 0) + line.baseQty);
      }
    }
    const available = await this.loadAvailable(header.companyId, header.branchId, [...wanted.keys()]);
    const graceDays = kind === 'EXPIRY_WRITEOFF' ? await this.expiryGraceDays(header.companyId, header.branchId) : 0;
    const cutoff = addDays(header.docDate, graceDays);
    const shortReported = new Set<string>();
    for (const line of lines) {
      if (out.has(line.index)) {
        continue;
      }
      const direction = this.directionOf(line, reasons);
      if (kind === 'EXPIRY_WRITEOFF' && !line.lotId) {
        say(line, 'names no lot. An expiry write-off is about one lot and its expiry date — pick it from the balance.');
        continue;
      }
      if (!line.lotId) {
        continue;
      }
      const lot = lots.get(line.lotId);
      if (!lot) {
        say(line, 'names a lot that does not exist. Pick the holding from the balance.');
        continue;
      }
      if (lot.slt_item_id !== line.itemId) {
        say(line, 'names a lot that belongs to a different item.');
        continue;
      }
      if (kind === 'EXPIRY_WRITEOFF') {
        if (!lot.slt_expiry_date) {
          say(line, `lot ${lot.slt_batch_no ?? line.lotId} has no expiry date. Use a damage write-off.`);
          continue;
        }
        const expiry = isoDate(lot.slt_expiry_date) as string;
        if (expiry > cutoff) {
          say(
            line,
            `lot ${lot.slt_batch_no ?? line.lotId} expires on ${expiry}, after ${cutoff}${graceDays ? ` (document date + ${graceDays} days' grace)` : ''}. Not expired yet: use a damage write-off.`,
          );
          continue;
        }
      }
      if (direction < 0) {
        const key = `${line.lotId}|${line.godownId}|${line.bucket}`;
        const have = available.get(key) ?? 0;
        const asked = wanted.get(key) ?? 0;
        if (asked > have && !shortReported.has(key)) {
          shortReported.add(key);
          say(
            line,
            `${moving ? 'moves' : 'takes'} ${asked} but this godown holds ${have} of ${lot.slt_batch_no ? `batch ${lot.slt_batch_no}` : 'that lot'} in the ${line.bucket} bucket. ${
              moving ? 'Moving stock you do not have is a data error.' : 'Writing off stock you do not have is a data error, not a sale.'
            }`,
          );
        }
      }
    }

    // ── the re-lot pair ───────────────────────────────────────────────────
    if (kind === 'ADJUSTMENT') {
      const relotLines = lines.filter((l) => this.isRelot(reasons, l));
      if (relotLines.length) {
        const perItem = new Map<string, { out: number; in: number; outLots: Set<string>; inLots: Set<string>; uoms: Set<string>; first: AdjustmentLine }>();
        for (const line of relotLines) {
          const code = reasons.get(line.reasonId as string)?.srm_code;
          const bucket = perItem.get(line.itemId) ?? { out: 0, in: 0, outLots: new Set<string>(), inLots: new Set<string>(), uoms: new Set<string>(), first: line };
          bucket.uoms.add(line.baseUomId);
          if (code === RELOT_OUT_CODE) {
            bucket.out += line.baseQty;
            if (!line.lotId) {
              say(line, 'is the OUT half of a re-lot and must name the lot it leaves.');
            } else {
              bucket.outLots.add(line.lotId);
            }
          } else {
            bucket.in += line.baseQty;
            if (line.lotId) {
              bucket.inLots.add(line.lotId);
            }
          }
          perItem.set(line.itemId, bucket);
        }
        for (const [, pair] of perItem) {
          const line = pair.first;
          if (Math.abs(pair.out - pair.in) > 0.000001) {
            say(line, `re-lot does not balance for this item: ${pair.out} out of the old lot against ${pair.in} into the new one. A half on its own is shrinkage — cite PILFERAGE or DAMAGE instead.`);
          } else if ([...pair.inLots].some((id) => pair.outLots.has(id))) {
            say(line, 're-lot moves stock from a lot into the same lot. The IN half states the CORRECT identity.');
          } else if (pair.uoms.size > 1) {
            say(line, 're-lot halves are keyed in different base units.');
          }
        }

        // An IN half names no lot — its identity resolves one at post — so the
        // test above never sees it. Resolve it here the way the engine will
        // (the item's policy on the document date blanks what it does not
        // track) and refuse when it lands on the lot the OUT half leaves: that
        // pair posts −q and +q on one lot and re-lots nothing (notes 65 §1).
        const lotlessIn = relotLines.filter(
          (l) => !l.lotId && !out.has(l.index) && reasons.get(l.reasonId as string)?.srm_code === RELOT_IN_CODE,
        );
        const resolved = await this.resolveInwardLots(header, lotlessIn);
        for (const line of lotlessIn) {
          const landsOn = resolved.get(line.index)?.lotId;
          if (!landsOn || !perItem.get(line.itemId)?.outLots.has(landsOn)) {
            continue;
          }
          const tracked = resolved.get(line.index)?.tracked ?? [];
          say(
            line,
            tracked.length === 0
              ? 're-lots an item that tracks no lot identity (no batch, expiry, MRP, sale price, serial or supplier): all of its stock in a bucket is one lot, so the IN half lands back on the lot the OUT half leaves. There is nothing to re-lot — change the item\'s tracking policy first if it should carry an identity.'
              : `re-lot lands back on the lot the OUT half leaves: this item tracks ${tracked.join(', ')}, and the IN half states the same ${tracked.length === 1 ? 'value' : 'values'} as that lot. State the CORRECT identity.`,
          );
        }
      }
    }
    return out;
  }

  /**
   * The lot each lotless inward line's identity resolves to, keyed EXACTLY as
   * the engine's `attachLotsToLines` keys it — the same policy CTE and the same
   * identity-key fragment, over the line as stated (payload or row) — so this
   * answer and the post's cannot differ. Null = no such lot yet; the post opens
   * one.
   */
  private async resolveInwardLots(header: HeaderFacts, lines: AdjustmentLine[]): Promise<Map<number, ResolvedInward>> {
    if (lines.length === 0) {
      return new Map();
    }
    const stated = JSON.stringify(
      lines.map((l) => ({
        idx: l.index,
        item_id: l.itemId,
        batch_no: l.identity.batchNo,
        mrp: l.identity.mrp,
        sale_price: l.identity.salePrice,
        expiry_date: l.identity.expiryDate,
        serial_no: l.identity.serialNo,
        supplier_id: l.identity.supplierId,
      })),
    );
    const rows = await this.prisma.$queryRaw<
      Array<{
        idx: number;
        lot_id: string | null;
        track_batch: boolean;
        track_mrp: boolean;
        track_sale_price: boolean;
        track_expiry: boolean;
        track_serial: boolean;
        track_supplier: boolean;
      }>
    >`
      WITH line AS (
        SELECT u.idx                         AS svi_id,
               u.item_id                     AS svi_item_id,
               ${header.companyId}::uuid     AS svh_company_id,
               ${header.branchId}::uuid      AS svh_branch_id,
               ${header.docDate}::date       AS svh_doc_date,
               u.batch_no                    AS svi_batch_no,
               u.mrp                         AS svi_mrp,
               u.sale_price                  AS svi_sale_price,
               u.expiry_date                 AS svi_expiry_date,
               u.serial_no                   AS svi_serial_no,
               u.supplier_id                 AS svi_supplier_id
          FROM jsonb_to_recordset(${stated}::jsonb)
               AS u(idx int, item_id uuid, batch_no text, mrp numeric, sale_price numeric,
                    expiry_date date, serial_no text, supplier_id uuid)
      ),
      ${effectivePolicyCte()},
      keyed AS (
        SELECT line.svi_id, line.svi_item_id, line.svh_company_id,
               policy.track_batch, policy.track_mrp, policy.track_sale_price,
               policy.track_expiry, policy.track_serial, policy.track_supplier,
               ${lotIdentityKeyColumns()}
          FROM line
          JOIN policy ON policy.svi_id = line.svi_id
      )
      SELECT k.svi_id AS idx, slt.slt_id AS lot_id,
             k.track_batch, k.track_mrp, k.track_sale_price, k.track_expiry, k.track_serial, k.track_supplier
        FROM keyed k
        LEFT JOIN stock.stock_lot slt
          ON slt.slt_company_id   = k.svh_company_id
         AND slt.slt_item_id      = k.svi_item_id
         AND slt.slt_key_batch    = k.key_batch
         AND slt.slt_key_mrp      = k.key_mrp
         AND slt.slt_key_sp       = k.key_sp
         AND slt.slt_key_expiry   = k.key_expiry
         AND slt.slt_key_serial   = k.key_serial
         AND slt.slt_key_supplier = k.key_supplier
         AND slt.slt_is_deleted   = false
    `;
    return new Map(
      rows.map((r) => [
        Number(r.idx),
        {
          lotId: r.lot_id,
          tracked: [
            r.track_batch && 'batch',
            r.track_expiry && 'expiry',
            r.track_mrp && 'MRP',
            r.track_sale_price && 'sale price',
            r.track_serial && 'serial',
            r.track_supplier && 'supplier',
          ].filter((t): t is string => !!t),
        },
      ]),
    );
  }

  /**
   * The same rule once more INSIDE the post, after the engine has stamped every
   * line with the lot it resolved: a RELOT_IN whose lot is a RELOT_OUT's lot of
   * the same item rolls the whole post back. `check` already refuses this from
   * the stated identity; this is the answer the ledger was actually written
   * with, so a policy edited between the check and the post cannot slip a
   * same-lot pair through.
   */
  private async assertRelotLandsElsewhere(
    tx: Prisma.TransactionClient,
    rules: StockVoucherTypeRules,
    svhId: string,
    accYear: string,
  ): Promise<void> {
    const same = await tx.$queryRaw<Array<{ in_line_no: number; out_line_no: number; item_name: string }>>`
      WITH relot AS (
        SELECT i.svi_line_no, i.svi_item_id, i.svi_lot_id, rm.srm_code
          FROM stock.stock_voucher_item i
          JOIN stock.stock_voucher h
            ON h.svh_id = i.svi_voucher_id AND h.svh_acc_year = i.svi_acc_year
          JOIN stock.stock_reason_master rm
            ON rm.srm_id = COALESCE(i.svi_reason_id, h.svh_reason_id)
         WHERE i.svi_voucher_id = ${svhId}::uuid AND i.svi_acc_year = ${accYear}::bpchar
           AND i.svi_is_deleted = false
           AND rm.srm_code IN (${RELOT_OUT_CODE}, ${RELOT_IN_CODE})
      )
      SELECT DISTINCT ON (i_in.svi_line_no)
             i_in.svi_line_no AS in_line_no, o.svi_line_no AS out_line_no, itm.item_name_en AS item_name
        FROM relot i_in
        JOIN relot o
          ON o.svi_item_id = i_in.svi_item_id
         AND o.svi_lot_id  = i_in.svi_lot_id
         AND o.srm_code    = ${RELOT_OUT_CODE}
        JOIN inventory.item_master itm ON itm.item_id = i_in.svi_item_id
       WHERE i_in.srm_code = ${RELOT_IN_CODE}
       ORDER BY i_in.svi_line_no, o.svi_line_no
    `;
    if (same.length) {
      throwStockUnprocessable<StockErrorDetail, StockErrorResponse>(
        `This ${rules.displayName.toLowerCase()} cannot be posted`,
        same.map((r) => ({
          field: `lines.${r.in_line_no}`,
          message: `Line ${r.in_line_no} (${r.item_name}): the IN half of the re-lot resolved to the lot line ${r.out_line_no} takes the stock out of — the pair would move it from a lot into the same lot. State the CORRECT identity.`,
        })),
      );
    }
  }

  /**
   * Which way a line moves: out of its bucket when it is a move, else its
   * reason's direction, else its own sign, else the kind's (out).
   */
  private directionOf(line: AdjustmentLine, reasons: Map<string, ReasonRow>): 1 | -1 {
    if (line.toBucket) {
      return -1;
    }
    const reason = line.reasonId ? reasons.get(line.reasonId) : undefined;
    if (reason?.srm_direction === 'IN') {
      return 1;
    }
    if (reason?.srm_direction === 'OUT') {
      return -1;
    }
    if (line.sign !== 0) {
      return line.sign;
    }
    return -1;
  }

  /** A reason a move may cite: its allowed types name BUCKET_OUT or BUCKET_IN. */
  private allowsMove(reason: ReasonRow): boolean {
    return (reason.srm_allowed_txn_types ?? []).some((t) => (BUCKET_MOVE_TXN_TYPES as readonly string[]).includes(t));
  }

  /** A reason ONLY a move may cite: it names bucket types and nothing else. */
  private onlyMove(reason: ReasonRow): boolean {
    const allowed = reason.srm_allowed_txn_types ?? [];
    return allowed.length > 0 && allowed.every((t) => (BUCKET_MOVE_TXN_TYPES as readonly string[]).includes(t));
  }

  private isRelot(reasons: Map<string, ReasonRow>, line: AdjustmentLine): boolean {
    const code = line.reasonId ? reasons.get(line.reasonId)?.srm_code : undefined;
    return code === RELOT_OUT_CODE || code === RELOT_IN_CODE;
  }

  /**
   * The ONE godown of the document. ADJUSTMENT names exactly one of from / to
   * (both signs share it, in `from`); the write-offs and a move name `from`.
   */
  private documentGodown(header: HeaderFacts): string | null {
    const { fromGodownId, toGodownId, kind } = header;
    if (kind === BUCKET_MOVE_KIND && toGodownId && toGodownId !== fromGodownId) {
      throwStockUnprocessable<StockErrorDetail, StockErrorResponse>('This stock move cannot be saved', [
        { field: 'toGodownId', message: 'A move changes the bucket, not the godown: name the godown once, in fromGodownId. Moving stock between godowns is a transfer.' },
      ]);
    }
    if (kind === 'ADJUSTMENT') {
      if (!fromGodownId && !toGodownId) {
        throwStockUnprocessable<StockErrorDetail, StockErrorResponse>('This stock adjustment cannot be saved', [
          { field: 'fromGodownId', message: 'An adjustment names the godown it adjusts: fromGodownId (outward, or a sheet with both signs) or toGodownId (inward).' },
        ]);
      }
      if (fromGodownId && toGodownId && fromGodownId !== toGodownId) {
        throwStockUnprocessable<StockErrorDetail, StockErrorResponse>('This stock adjustment cannot be saved', [
          { field: 'toGodownId', message: 'One adjustment, one godown. A sheet with both signs names it once, in fromGodownId; moving stock between godowns is a transfer.' },
        ]);
      }
      return fromGodownId ?? toGodownId;
    }
    return fromGodownId;
  }

  private refuse(
    rules: StockVoucherTypeRules,
    title: string,
    verdict: Map<number, string>,
    lines: AdjustmentLine[],
  ): void {
    if (verdict.size === 0) {
      return;
    }
    throwStockUnprocessable<StockErrorDetail, StockErrorResponse>(
      title,
      [...verdict.entries()]
        .sort(([a], [b]) => a - b)
        .map(([index, message]) => ({ field: `lines.${index}`, message: `${message}${lines[index].itemName ? ` (${lines[index].itemName})` : ''}` })),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // reads
  // ──────────────────────────────────────────────────────────────────────────

  private async kindOf(
    svhId: string,
    accYear: string,
    companyId: string,
    branchId: string,
  ): Promise<{ rules: StockVoucherTypeRules; header: HeaderFacts; docKind: StockAdjustmentDocKind }> {
    // A move and a re-lot are both stored as ADJUSTMENT and told apart by
    // their lines — the same test grid 122's kind_code makes.
    const [row] = await this.prisma.$queryRaw<
      Array<{
        svh_voucher_type: string;
        svh_doc_date: Date;
        svh_from_godown_id: string | null;
        svh_to_godown_id: string | null;
        svh_reason_id: string | null;
        svh_remarks: string | null;
        svh_refno: string | null;
        svh_link_src_module: string | null;
        svh_link_src_doc_type: string | null;
        is_move: boolean;
        is_relot: boolean;
      }>
    >`
      SELECT h.svh_voucher_type, h.svh_doc_date, h.svh_from_godown_id, h.svh_to_godown_id, h.svh_reason_id, h.svh_remarks,
             h.svh_refno, h.svh_link_src_module, h.svh_link_src_doc_type,
             (h.svh_voucher_type = 'ADJUSTMENT' AND EXISTS (
                SELECT 1 FROM stock.stock_voucher_item i
                 WHERE i.svi_voucher_id = h.svh_id AND i.svi_acc_year = h.svh_acc_year
                   AND i.svi_is_deleted = false AND i.svi_to_bucket IS NOT NULL))                AS is_move,
             (h.svh_voucher_type = 'ADJUSTMENT' AND EXISTS (
                SELECT 1 FROM stock.stock_voucher_item i
                  JOIN stock.stock_reason_master rm ON rm.srm_id = COALESCE(i.svi_reason_id, h.svh_reason_id)
                 WHERE i.svi_voucher_id = h.svh_id AND i.svi_acc_year = h.svh_acc_year
                   AND i.svi_is_deleted = false
                   AND rm.srm_code IN (${RELOT_OUT_CODE}, ${RELOT_IN_CODE})))                     AS is_relot
        FROM stock.stock_voucher h
       WHERE h.svh_id = ${svhId}::uuid AND h.svh_acc_year = ${accYear}::bpchar
         AND h.svh_company_id = ${companyId}::uuid AND h.svh_branch_id = ${branchId}::uuid
    `;
    if (!row || !isStockAdjustmentKind(row.svh_voucher_type)) {
      throwStockNotFound<StockErrorDetail, StockErrorResponse>(
        'Stock adjustment not found',
        'svhId',
        `No adjustment, issue, damage or expiry write-off ${svhId} in ${accYear} for this company and branch.`,
      );
    }
    // A sale bill, a challan or a return moves its stock through a SHADOW
    // ISSUE / RECEIPT voucher linked back to it. It is that document's, not an
    // adjustment: cancelling it here would take the stock back and leave the
    // bill standing. Grid 122 leaves the same rows out.
    if (row.svh_link_src_module && row.svh_link_src_module !== STOCK_SRC_MODULE) {
      throwStockNotFound<StockErrorDetail, StockErrorResponse>(
        'Stock adjustment not found',
        'svhId',
        `${row.svh_refno ?? svhId} is the stock movement of a ${row.svh_link_src_module} ${row.svh_link_src_doc_type ?? 'document'}, not an adjustment. It is posted and cancelled with that document.`,
      );
    }
    const kind: StockAdjustmentSaveKind = row.is_move ? BUCKET_MOVE_KIND : row.svh_voucher_type;
    return {
      rules: STOCK_ADJUSTMENT_RULES[kind],
      docKind: row.is_move ? BUCKET_MOVE_KIND : row.is_relot ? 'RELOT' : row.svh_voucher_type,
      header: {
        kind,
        companyId,
        branchId,
        docDate: isoDate(row.svh_doc_date) as string,
        fromGodownId: row.svh_from_godown_id,
        toGodownId: row.svh_to_godown_id,
        reasonId: row.svh_reason_id,
        remarks: row.svh_remarks,
      },
    };
  }

  private async loadLines(svhId: string, accYear: string, header: HeaderFacts): Promise<AdjustmentLine[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        svi_id: string;
        svi_line_no: number;
        svi_item_id: string;
        item_name: string;
        svi_godown_id: string;
        svi_lot_id: string | null;
        svi_bucket: string;
        svi_to_bucket: string | null;
        svi_base_qty: Prisma.Decimal;
        svi_free_base_qty: Prisma.Decimal;
        svi_direction: number | null;
        svi_reason_id: string | null;
        svi_remarks: string | null;
        svi_base_uom_id: string;
        svi_batch_no: string | null;
        svi_mrp: Prisma.Decimal | null;
        svi_sale_price: Prisma.Decimal | null;
        svi_expiry_date: Date | null;
        svi_serial_no: string | null;
        svi_supplier_id: string | null;
      }>
    >`
      SELECT svi.svi_id, svi.svi_line_no, svi.svi_item_id, itm.item_name_en AS item_name,
             svi.svi_godown_id, svi.svi_lot_id, svi.svi_bucket, svi.svi_to_bucket, svi.svi_base_qty, svi.svi_free_base_qty,
             svi.svi_direction, svi.svi_reason_id, svi.svi_remarks, svi.svi_base_uom_id,
             svi.svi_batch_no, svi.svi_mrp, svi.svi_sale_price, svi.svi_expiry_date, svi.svi_serial_no, svi.svi_supplier_id
        FROM stock.stock_voucher_item svi
        JOIN inventory.item_master itm ON itm.item_id = svi.svi_item_id
       WHERE svi.svi_voucher_id = ${svhId}::uuid AND svi.svi_acc_year = ${accYear}::bpchar
         AND svi.svi_is_deleted = false
       ORDER BY svi.svi_line_no, svi.svi_split_no
    `;
    return rows.map((r, index) => ({
      index,
      lineNo: r.svi_line_no,
      sviId: r.svi_id,
      itemId: r.svi_item_id,
      itemName: r.item_name,
      godownId: r.svi_godown_id,
      lotId: r.svi_lot_id,
      bucket: r.svi_bucket,
      toBucket: r.svi_to_bucket,
      keyedNegative: false,
      baseQty: Number(r.svi_base_qty),
      freeBaseQty: Number(r.svi_free_base_qty),
      sign: r.svi_direction === null ? 0 : Number(r.svi_direction) > 0 ? 1 : -1,
      reasonId: r.svi_reason_id ?? header.reasonId,
      remarks: r.svi_remarks?.trim() || header.remarks?.trim() || null,
      baseUomId: r.svi_base_uom_id,
      identity: {
        batchNo: r.svi_batch_no,
        mrp: r.svi_mrp === null ? null : r.svi_mrp.toString(),
        salePrice: r.svi_sale_price === null ? null : r.svi_sale_price.toString(),
        expiryDate: isoDate(r.svi_expiry_date),
        serialNo: r.svi_serial_no,
        supplierId: r.svi_supplier_id,
      },
    }));
  }

  private async loadReasons(companyId: string, lines: AdjustmentLine[]): Promise<Map<string, ReasonRow>> {
    const ids = [...new Set(lines.map((l) => l.reasonId).filter((id): id is string => !!id))];
    if (ids.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.$queryRaw<ReasonRow[]>`
      SELECT srm_id, srm_code, srm_name, srm_direction, srm_allowed_txn_types, srm_is_active, srm_require_remarks
        FROM stock.stock_reason_master
       WHERE srm_id = ANY(${ids}::uuid[])
         AND srm_is_deleted = false
         AND (srm_company_id IS NULL OR srm_company_id = ${companyId}::uuid)
    `;
    return new Map(rows.map((r) => [r.srm_id, r]));
  }

  private async loadLots(lotIds: string[]): Promise<Map<string, LotRow>> {
    if (lotIds.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.$queryRaw<LotRow[]>`
      SELECT slt_id, slt_item_id, slt_expiry_date, slt_base_uom_id, slt_batch_no
        FROM stock.stock_lot WHERE slt_id = ANY(${lotIds}::uuid[]) AND slt_is_deleted = false
    `;
    return new Map(rows.map((r) => [r.slt_id, r]));
  }

  /** `sbl_available_qty` per "lot|godown|bucket" key. */
  private async loadAvailable(companyId: string, branchId: string, keys: string[]): Promise<Map<string, number>> {
    if (keys.length === 0) {
      return new Map();
    }
    const lotIds = [...new Set(keys.map((k) => k.split('|')[0]))];
    const rows = await this.prisma.$queryRaw<
      Array<{ sbl_lot_id: string; sbl_godown_id: string; sbl_bucket: string; sbl_available_qty: Prisma.Decimal | null }>
    >`
      SELECT sbl_lot_id, sbl_godown_id, sbl_bucket, sbl_available_qty
        FROM stock.stock_balance
       WHERE sbl_company_id = ${companyId}::uuid AND sbl_branch_id = ${branchId}::uuid
         AND sbl_lot_id = ANY(${lotIds}::uuid[]) AND sbl_is_deleted = false
    `;
    return new Map(rows.map((r) => [`${r.sbl_lot_id}|${r.sbl_godown_id}|${r.sbl_bucket}`, Number(r.sbl_available_qty ?? 0)]));
  }

  /** `stock.expiry_writeoff_grace_days`, company then branch scope; 0 when unset. */
  private async expiryGraceDays(companyId: string, branchId: string): Promise<number> {
    const effective = await this.appSettings.resolveEffective({ companyId, branchId, deviceId: null, userId: null });
    const raw = effective.find((i) => i.asdKey === EXPIRY_GRACE_SETTING_KEY)?.value;
    const days = Number.parseInt(raw ?? '0', 10);
    return Number.isFinite(days) && days > 0 ? days : 0;
  }
}

function isoDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function addDays(isoDay: string, days: number): string {
  const d = new Date(`${isoDay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export { isoDate as adjustmentIsoDate };
