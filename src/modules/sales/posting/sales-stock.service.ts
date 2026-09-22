import { Injectable } from '@nestjs/common';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { TxnStatusDocType } from 'src/common/txn-status-log/txn-status-log.helper';
import { StockPostingService } from '../../stocks/posting/stock-posting.service';
import { StockVoucherSource } from '../../stocks/posting/stock-voucher.source';
import type { StockVoucherTypeRules } from '../../stocks/stock-voucher/types/stock-voucher.types';
import { throwSalesRefused } from './sales.errors';
import { SALES_ERROR_CODES } from './types/posting.types';
import { round2, round4 } from './sales-doc.utils';

/**
 * §3.1 — how a sales document moves stock.
 *
 * The stock engine (`stock-voucher-posting.helper.ts`) is the ONE
 * implementation of the seven phases, and it reads `stock.stock_voucher_item`.
 * So a sale does not grow an engine of its own: it writes a SHADOW stock
 * voucher — `svh_link_src_*` pointing back at the bill, one `svi` per line —
 * and posts it through `StockPostingService`, telling the engine to label the
 * ledger rows `SALES / SALE_BILL / bil00042` rather than `STOCK / ISSUE`.
 *
 * What comes back is what the accounting side needs and cannot compute
 * itself: the COST the engine relieved per line (moving average at the
 * moment of issue), which is the COGS pair under PERPETUAL.
 *
 * Cancel is a reversal through the same engine; the shadow keeps its rows.
 */
export type SalesStockDocType = 'SALE_BILL' | 'DELIVERY_CHALLAN' | 'SALE_RETURN' | 'DC_RETURN';
export type SalesStockTxnType = 'SALE' | 'DC_ISSUE' | 'SALE_RETURN' | 'DC_RETURN';

export interface SalesStockLine {
  /** The document's own line id — written back with the lot and the cost. */
  lineId: string;
  lineNo: number;
  itemId: string;
  /** `item_unit_conversion.iuc_id` the line was keyed in. */
  itemUnitId: string;
  godownId: string;
  lotId?: string | null;
  bucket?: string | null;
  qty: number;
  freeQty?: number;
  weightQty?: number | null;
  toBaseFactor?: number | null;
  batchNo?: string | null;
  batchDate?: string | null;
  expiryDate?: string | null;
  serialNo?: string | null;
  mrp?: number | null;
  /** What the document charged per unit (the ledger's `sml_doc_rate`). */
  rate?: number | null;
  /** A cost the line already carries (a return quotes the bill's). 0 = engine decides. */
  costRate?: number | null;
  taxPerc?: number | null;
  isService?: boolean;
}

export interface SalesStockDoc {
  docType: SalesStockDocType;
  docId: string;
  accYear: string;
  companyId: string;
  branchId: string;
  tenantId?: string | null;
  deviceId: string | null;
  sessionId?: string | null;
  docDate: string;
  docDatetime: Date;
  refno: string;
  /** Bumped on amend so the shadow's refno stays unique. */
  revision: number;
  partyId?: string | null;
  direction: 'OUT' | 'IN';
  txnType: SalesStockTxnType;
  remarks?: string | null;
  lines: SalesStockLine[];
}

export interface SalesStockResult {
  svhId: string | null;
  rowsPosted: number;
  /** `lineId → cost relieved / received` for the document's own `*_cogs_amt`. */
  costByLine: Map<string, number>;
  lotByLine: Map<string, string | null>;
  cogsTotal: number;
}

interface UnitRow {
  iuc_id: string;
  iuc_unit_id: string;
  iuc_base_unit_id: string;
  iuc_to_base_factor: Prisma.Decimal;
}

@Injectable()
export class SalesStockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockPosting: StockPostingService,
  ) {}

  /** Move the goods. Returns the cost the engine settled on, per line. */
  async post(
    tx: Prisma.TransactionClient,
    doc: SalesStockDoc,
    actor: string,
    postedOn: Date,
  ): Promise<SalesStockResult> {
    const lines = doc.lines.filter((l) => !l.isService && round4(l.qty + (l.freeQty ?? 0)) > 0);
    if (lines.length === 0) {
      return {
        svhId: null,
        rowsPosted: 0,
        costByLine: new Map(),
        lotByLine: new Map(),
        cogsTotal: 0,
      };
    }

    const units = await this.units(
      tx,
      lines.map((l) => l.itemUnitId),
    );
    const rules = this.rules(doc);
    const svhId = await this.writeShadow(tx, doc, lines, units, rules, actor, postedOn);

    try {
      const rowsPosted = await this.stockPosting.post(
        tx,
        new StockVoucherSource({
          svhId,
          accYear: doc.accYear,
          companyId: doc.companyId,
          branchId: doc.branchId,
          rules,
        }),
        {
          actor,
          postedOn,
          ledgerSource: {
            srcModule: 'SALES',
            srcDocType: doc.docType,
            srcRefno: doc.refno,
            partyId: doc.partyId ?? null,
          },
        },
      );

      // The assertion of §9: Σ stock rows must equal Σ line qty. The engine
      // skips a zero line, and we filtered those, so any gap means a line was
      // lost — refused loudly rather than reconciled.
      const [sum] = await tx.$queryRaw<{ qty: Prisma.Decimal | null; rows: bigint }[]>`
        SELECT SUM(sml_qty + sml_free_qty) AS qty, COUNT(*) AS rows
          FROM stock.stock_ledger
         WHERE sml_src_doc_id = ${svhId}::uuid AND sml_acc_year = ${doc.accYear}::bpchar
           AND sml_is_reversal = false AND sml_is_deleted = false`;
      const expected = round4(lines.reduce((s, l) => s + l.qty + (l.freeQty ?? 0), 0));
      const got = round4(Number(sum?.qty ?? 0));
      if (Math.abs(expected - got) > 0.0005) {
        throw new Error(
          `${SALES_ERROR_CODES.STOCK_QTY_MISMATCH}: ${doc.docType} ${doc.refno} moved ${got} against ${expected} on its lines`,
        );
      }

      const costs = await tx.$queryRaw<
        { svi_line_no: number; svi_lot_id: string | null; cost: Prisma.Decimal | null }[]
      >`
        SELECT svi.svi_line_no, svi.svi_lot_id, SUM(sml.sml_cost_value) AS cost
          FROM stock.stock_voucher_item svi
          LEFT JOIN stock.stock_ledger sml
                 ON sml.sml_src_doc_id = svi.svi_voucher_id
                AND sml.sml_acc_year   = svi.svi_acc_year
                AND sml.sml_line_no    = svi.svi_line_no
                AND sml.sml_split_no   = svi.svi_split_no
                AND sml.sml_is_reversal = false
                AND sml.sml_is_deleted = false
         WHERE svi.svi_voucher_id = ${svhId}::uuid AND svi.svi_acc_year = ${doc.accYear}::bpchar
         GROUP BY svi.svi_line_no, svi.svi_lot_id`;

      const byLineNo = new Map(lines.map((l) => [l.lineNo, l]));
      const costByLine = new Map<string, number>();
      const lotByLine = new Map<string, string | null>();
      let total = 0;
      for (const r of costs) {
        const line = byLineNo.get(r.svi_line_no);
        if (!line) {
          continue;
        }
        const cost = round2(Number(r.cost ?? 0));
        costByLine.set(line.lineId, cost);
        lotByLine.set(line.lineId, r.svi_lot_id);
        total += cost;
      }
      return { svhId, rowsPosted, costByLine, lotByLine, cogsTotal: round2(total) };
    } catch (error) {
      // The engine's BLOCK verdict is a 409 in stock's vocabulary; a sales
      // client switches on SALES_STOCK_NEGATIVE.
      if (error instanceof ConflictException) {
        const body = error.getResponse() as { message?: string; errors?: { message: string }[] };
        const detail =
          body?.errors?.map((e) => e.message).join('; ') ||
          body?.message ||
          'stock would go negative';
        throwSalesRefused(detail, SALES_ERROR_CODES.STOCK_NEGATIVE, 'items');
      }
      throw error;
    }
  }

  /** Reverse the movement the shadow made. A shadow that never posted is a no-op. */
  async cancel(
    tx: Prisma.TransactionClient,
    doc: Pick<
      SalesStockDoc,
      'docType' | 'docId' | 'accYear' | 'companyId' | 'branchId' | 'direction' | 'txnType'
    >,
    actor: string,
    reason: string,
    cancelledOn: Date,
  ): Promise<number> {
    const shadows = await tx.$queryRaw<{ svh_id: string }[]>`
      SELECT svh_id
        FROM stock.stock_voucher
       WHERE svh_link_src_module   = 'SALES'
         AND svh_link_src_doc_type = ${doc.docType}
         AND svh_link_src_doc_id   = ${doc.docId}::uuid
         AND svh_acc_year          = ${doc.accYear}::bpchar
         AND svh_status            = 'POSTED'
         AND svh_is_deleted        = false`;
    let reversed = 0;
    for (const s of shadows) {
      reversed += await this.stockPosting.cancel(
        tx,
        new StockVoucherSource({
          svhId: s.svh_id,
          accYear: doc.accYear,
          companyId: doc.companyId,
          branchId: doc.branchId,
          rules: this.rules(doc),
        }),
        { actor, reason, cancelledOn },
      );
    }
    return reversed;
  }

  private rules(
    doc: Pick<SalesStockDoc, 'docType' | 'direction' | 'txnType'>,
  ): StockVoucherTypeRules {
    const inward = doc.direction === 'IN';
    return {
      voucherType: inward ? 'RECEIPT' : 'ISSUE',
      typeCode: doc.docType,
      displayName: DISPLAY_NAME[doc.docType],
      requiresToGodown: inward,
      requiresFromGodown: !inward,
      isInward: inward,
      ledgerTxnTypes: [doc.txnType],
      quantityMode: 'QTY',
      defaultRateSource: 'AVG_COST',
      allowsCount: false,
      allowsToBranch: false,
      postFunction: 'stock.fn_svh_post',
      auditScreenName: DISPLAY_NAME[doc.docType],
      statusDocType: STATUS_DOC_TYPE[doc.docType],
    } as StockVoucherTypeRules;
  }

  private async units(
    tx: Prisma.TransactionClient,
    iucIds: string[],
  ): Promise<Map<string, UnitRow>> {
    const ids = [...new Set(iucIds)];
    const rows = await tx.$queryRaw<UnitRow[]>`
      SELECT iuc_id, iuc_unit_id, iuc_base_unit_id, iuc_to_base_factor
        FROM inventory.item_unit_conversion
       WHERE iuc_id = ANY(${ids}::uuid[])`;
    const by = new Map(rows.map((r) => [r.iuc_id, r]));
    const missing = ids.filter((id) => !by.has(id));
    if (missing.length > 0) {
      throwSalesRefused(
        `Unit conversion not found for ${missing.length === 1 ? 'a line' : `${missing.length} lines`}: ${missing.join(', ')}`,
        SALES_ERROR_CODES.STOCK_QTY_MISMATCH,
        'items',
      );
    }
    return by;
  }

  private async writeShadow(
    tx: Prisma.TransactionClient,
    doc: SalesStockDoc,
    lines: SalesStockLine[],
    units: Map<string, UnitRow>,
    rules: StockVoucherTypeRules,
    actor: string,
    now: Date,
  ): Promise<string> {
    const deviceId = doc.deviceId?.trim() || 'SERVER';
    const [slno] = await tx.$queryRaw<{ next: bigint }[]>`
      SELECT COALESCE(MAX(svh_slno), 0) + 1 AS next
        FROM stock.stock_voucher
       WHERE svh_acc_year = ${doc.accYear}::bpchar AND svh_company_id = ${doc.companyId}::uuid
         AND svh_branch_id = ${doc.branchId}::uuid AND svh_voucher_type = ${rules.voucherType}
         AND svh_device_id = ${deviceId}`;
    const refno = `${doc.docType}/${doc.refno}/r${doc.revision}`;
    const godowns = [...new Set(lines.map((l) => l.godownId))];
    const inward = doc.direction === 'IN';

    const [header] = await tx.$queryRaw<{ svh_id: string }[]>`
      INSERT INTO stock.stock_voucher (
        svh_company_id, svh_branch_id, svh_tenant_id, svh_acc_year, svh_device_id, svh_session_id,
        svh_voucher_type, svh_slno, svh_refno, svh_usr_refno, svh_doc_date, svh_doc_datetime,
        svh_from_godown_id, svh_to_godown_id, svh_party_ref,
        svh_link_src_module, svh_link_src_doc_type, svh_link_src_doc_id, svh_link_src_acc_year,
        svh_line_count, svh_total_qty, svh_status, svh_rate_source, svh_remarks, svh_created_on, svh_created_by
      ) VALUES (
        ${doc.companyId}::uuid, ${doc.branchId}::uuid, ${doc.tenantId ?? null}::uuid, ${doc.accYear}::bpchar,
        ${deviceId}, ${doc.sessionId ?? null}::uuid,
        ${rules.voucherType}, ${Number(slno?.next ?? 1)}::bigint, ${refno}, ${doc.refno},
        ${doc.docDate}::date, ${doc.docDatetime},
        ${inward ? null : godowns[0]}::uuid, ${inward ? godowns[0] : null}::uuid,
        ${doc.partyId ?? null},
        'SALES', ${doc.docType}, ${doc.docId}::uuid, ${doc.accYear}::bpchar,
        ${lines.length}::int, ${round4(lines.reduce((s, l) => s + l.qty + (l.freeQty ?? 0), 0))}::numeric,
        'DRAFT', 'AVG_COST', ${doc.remarks ?? `${DISPLAY_NAME[doc.docType]} ${doc.refno}`},
        ${now}, ${actor === '00000000-0000-0000-0000-000000000000' ? null : actor}
      )
      RETURNING svh_id`;
    const svhId = header.svh_id;

    const values = lines.map((l) => {
      const u = units.get(l.itemUnitId)!;
      const factor =
        l.toBaseFactor && l.toBaseFactor > 0 ? l.toBaseFactor : Number(u.iuc_to_base_factor) || 1;
      const qty = round4(l.qty);
      const free = round4(l.freeQty ?? 0);
      return Prisma.sql`(
        ${svhId}::uuid, ${doc.companyId}::uuid, ${doc.branchId}::uuid, ${doc.tenantId ?? null}::uuid,
        ${doc.accYear}::bpchar, ${l.lineNo}::int, 1,
        ${l.itemId}::uuid, ${u.iuc_unit_id}::uuid, ${u.iuc_base_unit_id}::uuid, ${factor}::numeric,
        ${l.godownId}::uuid, ${l.lotId ?? null}::uuid, ${l.bucket ?? 'SALEABLE'},
        ${l.batchNo ?? null}, ${l.batchDate ?? null}::date, ${l.expiryDate ?? null}::date,
        ${l.mrp ?? null}::numeric, ${l.rate ?? null}::numeric, ${l.serialNo ?? null},
        ${qty}::numeric, ${round4(qty * factor)}::numeric, ${free}::numeric, ${round4(free * factor)}::numeric,
        ${l.weightQty ?? 0}::numeric,
        ${l.costRate ?? 0}::numeric, ${l.costRate ?? 0}::numeric, ${l.taxPerc ?? 0}::numeric,
        ${now}, ${actor === '00000000-0000-0000-0000-000000000000' ? null : actor}
      )`;
    });

    await tx.$executeRaw`
      INSERT INTO stock.stock_voucher_item (
        svi_voucher_id, svi_company_id, svi_branch_id, svi_tenant_id,
        svi_acc_year, svi_line_no, svi_split_no,
        svi_item_id, svi_uom_id, svi_base_uom_id, svi_to_base_factor,
        svi_godown_id, svi_lot_id, svi_bucket,
        svi_batch_no, svi_mfg_date, svi_expiry_date,
        svi_mrp, svi_sale_price, svi_serial_no,
        svi_qty, svi_base_qty, svi_free_qty, svi_free_base_qty,
        svi_weight_qty,
        svi_cost_rate, svi_cost_rate_wot, svi_tax_perc,
        svi_created_on, svi_created_by
      ) VALUES ${Prisma.join(values)}`;

    return svhId;
  }
}

const DISPLAY_NAME: Record<SalesStockDocType, string> = {
  SALE_BILL: 'Sale bill',
  DELIVERY_CHALLAN: 'Delivery challan',
  SALE_RETURN: 'Sale return',
  DC_RETURN: 'Delivery challan return',
};

const STATUS_DOC_TYPE: Record<SalesStockDocType, TxnStatusDocType> = {
  SALE_BILL: TxnStatusDocType.SALE_BILL,
  DELIVERY_CHALLAN: TxnStatusDocType.DELIVERY_CHALLAN,
  SALE_RETURN: TxnStatusDocType.SALE_RETURN,
  DC_RETURN: TxnStatusDocType.OTHER,
};
