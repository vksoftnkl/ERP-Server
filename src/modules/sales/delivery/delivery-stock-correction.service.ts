import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TxnStatusDocType } from 'src/common/txn-status-log/txn-status-log.helper';
import { StockPostingService } from '../../stocks/posting/stock-posting.service';
import { StockVoucherSource } from '../../stocks/posting/stock-voucher.source';
import { STOCK_ADJUSTMENT_RULES } from '../../stocks/stock-adjustment/stock-adjustment.rules';
import { nextStockVoucherSlno } from '../../stocks/stock-voucher/stock-voucher-numbering.helper';
import { RELOT_REASON_CODES } from '../../stocks/stock-voucher/types/stock-voucher.types';
import type { StockVoucherTypeRules } from '../../stocks/stock-voucher/types/stock-voucher.types';
import { StockErrorCode } from '../../stocks/types/stock-error-codes';
import {
  DELIVERY_ERROR_CODES as C,
  DELIVERY_GODOWN_REASON_CODE,
  DELIVERY_NOTE_DOC_TYPE,
} from './core/delivery.constants';
import { refuseWith } from './delivery.errors';

/**
 * Plan §5 rows 12–13, decisions 38–40 — when the keeper gives a different lot
 * or from a different godown, the BOOKS follow the goods so that every
 * holding's Physical (= Owned + Billed not delivered) stays equal to its shelf.
 *
 *   different lot     the existing RE-LOT pair in the bill's godown: an
 *                     ADJUSTMENT whose lines cite RELOT_OUT (the given lot C)
 *                     and RELOT_IN (the bill's lot A); the engine prices the IN
 *                     half at what the OUT half relieved, and the accounts
 *                     writer posts no leg for the pair.
 *   different godown  a same-branch TRANSFER_OUT, giving godown G2 → the bill's
 *                     godown G1, lot kept, reason DELIVERY_GODOWN.
 *   both              the transfer of C into G1 first, then the re-lot C → A
 *                     there (decision 39): net G2.C −q, G1.A +q.
 *
 * Each is a SHADOW stock voucher linked to the note (svh_link_src_* = SALES /
 * DELIVERY_NOTE / sdn_id), posted through StockPostingService with the ledger
 * label SALES / DELIVERY_NOTE / <note refno> — the engine's freeze guard,
 * negative-stock policy and costing apply as for any movement. A goods back
 * posts the mirror (undo) for the returned qty; a note cancel cancels every
 * shadow of the note, newest first (decision 40).
 */

/** One note line as a correction sees it. */
export interface CorrectionLine {
  lineNo: number;
  itemId: string;
  /** The bill line's unit (item_unit_conversion.iuc_id). */
  iucId: string;
  factor: Prisma.Decimal;
  /** Line unit. */
  qty: Prisma.Decimal;
  givingGodownId: string;
  billGodownId: string;
  givenLotId: string | null;
  billLotId: string | null;
  bucket: string;
}

export interface CorrectionDoc {
  sdnId: string;
  /** The note's own year (the shadow's link). */
  noteAccYear: string;
  /** The year the shadow is filed in: the note's at post, today's on a goods back (decision 71). */
  shadowAccYear: string;
  companyId: string;
  branchId: string;
  tenantId: string | null;
  deviceId: string;
  refno: string;
  /** YYYY-MM-DD */
  docDate: string;
  docDatetime: Date;
}

export interface CorrectionResult {
  kind: 'LOT_SWAP' | 'GODOWN_MOVE';
  svhId: string;
  svhRefno: string;
  lineNos: number[];
  undo?: true;
}

interface UnitRow {
  iuc_id: string;
  base_iuc_id: string;
}

/** A same-branch godown move, shaped as the Stock Transfer screen's rule record (no labour). */
export const DN_TRANSFER_RULES: StockVoucherTypeRules = {
  voucherType: 'TRANSFER_OUT',
  typeCode: 'TRF',
  displayName: 'Delivery note godown correction',
  requiresToGodown: true,
  requiresFromGodown: true,
  isInward: false,
  ledgerTxnTypes: ['TRANSFER_OUT'],
  quantityMode: 'QTY',
  requiresLot: true,
  zeroesLineCost: true,
  defaultRateSource: 'AVG_COST',
  allowsRepeatHolding: true,
  allowsCount: false,
  allowsToBranch: false,
  allowsLoading: false,
  postShape: 'TRANSFER_OUT',
  auditScreenName: 'Delivery Note',
  statusDocType: TxnStatusDocType.STOCK_TRANSFER,
  refuseTypes: ['OPENING', 'PHYSICAL', 'TRANSFER_IN', 'REPACK_IN', 'REPACK_OUT'],
};

/**
 * The re-lot pair: an ADJUSTMENT laid per line by its reason. Unlike the
 * adjustment screen it follows the godown's / item's negative-stock policy
 * (blockNegative false): the goods did leave, the books only follow them.
 */
export const DN_RELOT_RULES: StockVoucherTypeRules = {
  ...STOCK_ADJUSTMENT_RULES.ADJUSTMENT,
  displayName: 'Delivery note lot swap',
  blockNegative: false,
  auditScreenName: 'Delivery Note',
};

@Injectable()
export class DeliveryStockCorrectionService {
  constructor(private readonly stockPosting: StockPostingService) {}

  /** Lines that need a correction at all. */
  static needs(l: CorrectionLine): { move: boolean; swap: boolean } {
    return {
      move: l.givingGodownId !== l.billGodownId,
      swap: !!l.givenLotId && !!l.billLotId && l.givenLotId !== l.billLotId,
    };
  }

  /**
   * Post the corrections for `lines` (forward at note post, `undo` on a goods
   * back for the returned qty). Returns one entry per shadow voucher.
   */
  async post(
    tx: Prisma.TransactionClient,
    doc: CorrectionDoc,
    lines: readonly CorrectionLine[],
    actor: string,
    opts: { undo: boolean },
  ): Promise<CorrectionResult[]> {
    const active = lines.filter((l) => l.qty.greaterThan(0));
    const moves = active.filter((l) => DeliveryStockCorrectionService.needs(l).move);
    const swaps = active.filter((l) => DeliveryStockCorrectionService.needs(l).swap);
    if (moves.length === 0 && swaps.length === 0) {
      return [];
    }
    const units = await this.units(
      tx,
      active.map((l) => l.iucId),
    );
    const reasons = await this.reasonIds(tx);
    const out: CorrectionResult[] = [];

    const transfer = async () => {
      // One voucher per (from → to) pair.
      const groups = new Map<string, CorrectionLine[]>();
      for (const l of moves) {
        const from = opts.undo ? l.billGodownId : l.givingGodownId;
        const to = opts.undo ? l.givingGodownId : l.billGodownId;
        const k = `${from}|${to}`;
        groups.set(k, [...(groups.get(k) ?? []), l]);
      }
      for (const [k, group] of groups) {
        const [from, to] = k.split('|');
        const missingLot = group.find((l) => !l.givenLotId);
        if (missingLot) {
          refuseWith(
            C.DN_LOT_INVALID,
            `Line ${missingLot.lineNo}: a godown move needs the lot given; none is known for this line`,
            `lines[${missingLot.lineNo - 1}].lotId`,
            { n: missingLot.lineNo, lot: '', item: '', godown: '' },
            missingLot.lineNo,
          );
        }
        const svh = await this.writeShadow(tx, doc, actor, {
          rules: DN_TRANSFER_RULES,
          fromGodownId: from,
          toGodownId: to,
          reasonId: reasons.godown,
          remarks: `${opts.undo ? 'Goods back: ' : ''}${doc.refno} given from another godown`,
          lines: group.map((l) => ({
            l,
            godownId: from,
            lotId: l.givenLotId!,
            reasonId: null,
            direction: null,
          })),
          units,
        });
        await this.postShadow(tx, doc, svh.svhId, DN_TRANSFER_RULES, actor);
        out.push({
          kind: 'GODOWN_MOVE',
          svhId: svh.svhId,
          svhRefno: svh.refno,
          lineNos: group.map((l) => l.lineNo),
          ...(opts.undo ? { undo: true as const } : {}),
        });
      }
    };

    const relot = async () => {
      // One voucher per godown the swap happens in (the bill's godown).
      const groups = new Map<string, CorrectionLine[]>();
      for (const l of swaps) {
        groups.set(l.billGodownId, [...(groups.get(l.billGodownId) ?? []), l]);
      }
      for (const [godown, group] of groups) {
        const pair = group.flatMap((l) => {
          const outLot = opts.undo ? l.billLotId! : l.givenLotId!;
          const inLot = opts.undo ? l.givenLotId! : l.billLotId!;
          return [
            { l, godownId: godown, lotId: outLot, reasonId: reasons.relotOut, direction: -1 },
            { l, godownId: godown, lotId: inLot, reasonId: reasons.relotIn, direction: 1 },
          ];
        });
        const svh = await this.writeShadow(tx, doc, actor, {
          rules: DN_RELOT_RULES,
          fromGodownId: godown,
          toGodownId: null,
          reasonId: null,
          remarks: `${opts.undo ? 'Goods back: ' : ''}${doc.refno} given from another lot`,
          lines: pair,
          units,
        });
        await this.postShadow(tx, doc, svh.svhId, DN_RELOT_RULES, actor);
        out.push({
          kind: 'LOT_SWAP',
          svhId: svh.svhId,
          svhRefno: svh.refno,
          lineNos: group.map((l) => l.lineNo),
          ...(opts.undo ? { undo: true as const } : {}),
        });
      }
    };

    // Forward: move into the bill's godown, then swap the lot there.
    // Undo: swap back first, then move back out (decision 39 in reverse).
    if (opts.undo) {
      await relot();
      await transfer();
    } else {
      await transfer();
      await relot();
    }
    return out;
  }

  /** Cancel every live correction shadow of the note, newest first (decision 40). */
  async cancelAll(
    tx: Prisma.TransactionClient,
    q: { sdnId: string; companyId: string; branchId: string },
    actor: string,
    reason: string,
    cancelledOn: Date,
  ): Promise<number> {
    const shadows = await tx.$queryRaw<
      { svh_id: string; svh_acc_year: string; svh_voucher_type: string }[]
    >`
      SELECT svh_id, svh_acc_year, svh_voucher_type
        FROM stock.stock_voucher
       WHERE svh_link_src_module   = 'SALES'
         AND svh_link_src_doc_type = ${DELIVERY_NOTE_DOC_TYPE}
         AND svh_link_src_doc_id   = ${q.sdnId}::uuid
         AND svh_status            = 'POSTED'
         AND svh_is_deleted        = false
       ORDER BY svh_created_on DESC, svh_slno DESC`;
    let n = 0;
    for (const s of shadows) {
      const rules = s.svh_voucher_type === 'TRANSFER_OUT' ? DN_TRANSFER_RULES : DN_RELOT_RULES;
      try {
        n += await this.stockPosting.cancel(
          tx,
          new StockVoucherSource({
            svhId: s.svh_id,
            accYear: s.svh_acc_year.trim(),
            companyId: q.companyId,
            branchId: q.branchId,
            rules,
          }),
          {
            actor,
            reason,
            cancelledOn,
            ledgerSource: { srcModule: 'SALES', srcDocType: DELIVERY_NOTE_DOC_TYPE },
          },
        );
      } catch (error) {
        this.mapEngineRefusal(error);
      }
    }
    return n;
  }

  private async postShadow(
    tx: Prisma.TransactionClient,
    doc: CorrectionDoc,
    svhId: string,
    rules: StockVoucherTypeRules,
    actor: string,
  ): Promise<void> {
    try {
      await this.stockPosting.post(
        tx,
        new StockVoucherSource({
          svhId,
          accYear: doc.shadowAccYear,
          companyId: doc.companyId,
          branchId: doc.branchId,
          rules,
        }),
        {
          actor,
          postedOn: doc.docDatetime,
          ledgerSource: {
            srcModule: 'SALES',
            srcDocType: DELIVERY_NOTE_DOC_TYPE,
            srcRefno: doc.refno,
            partyId: null,
          },
        },
      );
    } catch (error) {
      this.mapEngineRefusal(error);
    }
  }

  /** The engine speaks stock's codes; the note's client switches on DN_*. */
  private mapEngineRefusal(error: unknown): never {
    if (error instanceof ConflictException || error instanceof UnprocessableEntityException) {
      const body = error.getResponse() as {
        message?: string;
        errors?: { code?: string; message?: string }[];
      };
      const codes = (body?.errors ?? []).map((e) => e.code);
      const text =
        (body?.errors ?? []).map((e) => e.message).filter(Boolean).join('; ') ||
        body?.message ||
        'the stock engine refused the correction';
      if (codes.includes(StockErrorCode.GODOWN_FROZEN)) {
        refuseWith(C.DN_GODOWN_FROZEN, text, 'sdnGodownId', { godown: '', from: '', to: '' });
      }
      refuseWith(C.DN_STOCK_NEGATIVE, text, 'lines', { n: '', qty: '', unit: '', lot: '', godown: '' });
    }
    throw error;
  }

  private async reasonIds(
    tx: Prisma.TransactionClient,
  ): Promise<{ relotOut: string; relotIn: string; godown: string }> {
    const rows = await tx.$queryRaw<{ srm_id: string; srm_code: string }[]>`
      SELECT srm_id, srm_code FROM stock.stock_reason_master
       WHERE srm_company_id IS NULL AND srm_is_deleted = false
         AND srm_code IN (${RELOT_REASON_CODES.out}, ${RELOT_REASON_CODES.in}, ${DELIVERY_GODOWN_REASON_CODE})`;
    const by = new Map(rows.map((r) => [r.srm_code, r.srm_id]));
    const relotOut = by.get(RELOT_REASON_CODES.out);
    const relotIn = by.get(RELOT_REASON_CODES.in);
    const godown = by.get(DELIVERY_GODOWN_REASON_CODE);
    if (!relotOut || !relotIn || !godown) {
      throw new Error(
        'Delivery corrections need the system stock reasons RELOT_OUT, RELOT_IN and DELIVERY_GODOWN (stock_reason_master, company NULL)',
      );
    }
    return { relotOut, relotIn, godown };
  }

  private async units(tx: Prisma.TransactionClient, iucIds: string[]): Promise<Map<string, UnitRow>> {
    const ids = [...new Set(iucIds)];
    const rows = await tx.$queryRaw<UnitRow[]>`
      SELECT iuc.iuc_id, COALESCE(base.iuc_id, iuc.iuc_id) AS base_iuc_id
        FROM inventory.item_unit_conversion iuc
        LEFT JOIN LATERAL (
          SELECT b.iuc_id FROM inventory.item_unit_conversion b
           WHERE b.iuc_item_id = iuc.iuc_item_id AND b.iuc_is_base_unit = true
             AND b.iuc_is_deleted = false
           ORDER BY b.iuc_unit_slno LIMIT 1
        ) base ON true
       WHERE iuc.iuc_id = ANY(${ids}::uuid[])`;
    return new Map(rows.map((r) => [r.iuc_id, r]));
  }

  /**
   * The shadow header + lines, DRAFT, numbered by the stock allocator per
   * device (as the sales shadows are). Its refno is the note's plus a
   * running suffix: DN/2026-2027/D3/00042/C1, /C2 … (ux_svh_refno).
   */
  private async writeShadow(
    tx: Prisma.TransactionClient,
    doc: CorrectionDoc,
    actor: string,
    v: {
      rules: StockVoucherTypeRules;
      fromGodownId: string;
      toGodownId: string | null;
      reasonId: string | null;
      remarks: string;
      lines: { l: CorrectionLine; godownId: string; lotId: string; reasonId: string | null; direction: number | null }[];
      units: Map<string, UnitRow>;
    },
  ): Promise<{ svhId: string; refno: string }> {
    const slno = await nextStockVoucherSlno(tx, {
      companyId: doc.companyId,
      branchId: doc.branchId,
      accYear: doc.shadowAccYear,
      voucherType: v.rules.voucherType,
      deviceId: doc.deviceId,
    });
    const [seq] = await tx.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int + 1 AS n FROM stock.stock_voucher
       WHERE svh_link_src_doc_type = ${DELIVERY_NOTE_DOC_TYPE}
         AND svh_link_src_doc_id = ${doc.sdnId}::uuid`;
    const refno = `${doc.refno}/C${seq?.n ?? 1}`;
    const author = actor === '00000000-0000-0000-0000-000000000000' ? null : actor;
    const total = v.lines.reduce((a, x) => a.plus(x.l.qty), new Prisma.Decimal(0));
    const [header] = await tx.$queryRaw<{ svh_id: string }[]>`
      INSERT INTO stock.stock_voucher (
        svh_company_id, svh_branch_id, svh_tenant_id, svh_acc_year, svh_device_id,
        svh_voucher_type, svh_slno, svh_refno, svh_usr_refno, svh_doc_date, svh_doc_datetime,
        svh_from_godown_id, svh_to_godown_id, svh_reason_id,
        svh_link_src_module, svh_link_src_doc_type, svh_link_src_doc_id, svh_link_src_acc_year,
        svh_line_count, svh_total_qty, svh_status, svh_rate_source, svh_remarks, svh_created_on, svh_created_by
      ) VALUES (
        ${doc.companyId}::uuid, ${doc.branchId}::uuid, ${doc.tenantId}::uuid, ${doc.shadowAccYear}::bpchar,
        ${doc.deviceId}::uuid,
        ${v.rules.voucherType}, ${slno}::bigint, ${refno}, ${doc.refno},
        ${doc.docDate}::date, ${doc.docDatetime},
        ${v.fromGodownId}::uuid, ${v.toGodownId}::uuid, ${v.reasonId}::uuid,
        'SALES', ${DELIVERY_NOTE_DOC_TYPE}, ${doc.sdnId}::uuid, ${doc.noteAccYear}::bpchar,
        ${v.lines.length}::int, ${total}::numeric,
        'DRAFT', 'AVG_COST', ${v.remarks.slice(0, 250)}, ${doc.docDatetime}, ${author}
      )
      RETURNING svh_id`;
    const svhId = header.svh_id;
    const values = v.lines.map((x, i) => {
      const u = v.units.get(x.l.iucId);
      if (!u) {
        throw new Error(`Delivery correction: unit conversion ${x.l.iucId} not found`);
      }
      const base = x.l.qty.times(x.l.factor).toDecimalPlaces(6);
      return Prisma.sql`(
        ${svhId}::uuid, ${doc.companyId}::uuid, ${doc.branchId}::uuid, ${doc.tenantId}::uuid,
        ${doc.shadowAccYear}::bpchar, ${i + 1}::int, 1,
        ${x.l.itemId}::uuid, ${u.iuc_id}::uuid, ${u.base_iuc_id}::uuid, ${x.l.factor}::numeric,
        ${x.godownId}::uuid, ${x.lotId}::uuid, ${x.l.bucket},
        ${x.l.qty}::numeric, ${base}::numeric, 0, 0, 0, 0, 0, 0,
        ${x.reasonId}::uuid, ${x.direction}::smallint,
        ${`Delivery note line ${x.l.lineNo}`},
        ${doc.docDatetime}, ${author}
      )`;
    });
    await tx.$executeRaw`
      INSERT INTO stock.stock_voucher_item (
        svi_voucher_id, svi_company_id, svi_branch_id, svi_tenant_id,
        svi_acc_year, svi_line_no, svi_split_no,
        svi_item_id, svi_uom_id, svi_base_uom_id, svi_to_base_factor,
        svi_godown_id, svi_lot_id, svi_bucket,
        svi_qty, svi_base_qty, svi_free_qty, svi_free_base_qty, svi_weight_qty,
        svi_cost_rate, svi_cost_rate_wot, svi_tax_perc,
        svi_reason_id, svi_direction, svi_remarks,
        svi_created_on, svi_created_by
      ) VALUES ${Prisma.join(values)}`;
    return { svhId, refno };
  }
}
