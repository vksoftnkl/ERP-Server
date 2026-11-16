import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma/prisma.service';
import type { BillKey, BillLineKey } from './delivery.constants';
import {
  eligibleLineExpr,
  lineEventSumsLateral,
  lineFactorSql,
  lineUnitKgSql,
  pendingLinesCte,
} from './delivery-pending.sql';

type Client = Prisma.TransactionClient | PrismaService;
const D0 = new Prisma.Decimal(0);

/** One bill line as every delivery rule sees it (plan §5.1). Quantities are Decimal. */
export interface BillLineFacts {
  billItemId: string;
  billAccYear: string;
  billId: string;
  billRefno: string | null;
  /** YYYY-MM-DD */
  billDate: string | null;
  companyId: string;
  branchId: string;
  billStatus: string;
  billDeleted: boolean;
  billMode: string | null;
  deliveryMode: string;
  deliveryStatus: string;
  custId: string | null;
  custName: string | null;
  lineNo: number;
  splitNo: number;
  lineDeleted: boolean;
  isService: boolean;
  srcDocType: string | null;
  srcDocRefno: string | null;
  itemId: string;
  unitId: string;
  godownId: string;
  lotId: string | null;
  bucket: string;
  billedQty: Prisma.Decimal;
  factor: Prisma.Decimal;
  unitKg: Prisma.Decimal;
  settledQty: Prisma.Decimal;
  givenQty: Prisma.Decimal;
  pendingQty: Prisma.Decimal;
  settledBase: Prisma.Decimal;
  givenBase: Prisma.Decimal;
  pendingBase: Prisma.Decimal;
  /** §5.1: posted, live, Pickup / Dispatch, a goods line, not from a challan, qty > 0. */
  eligible: boolean;
}

/** BND of one holding (base unit). */
export interface HoldingBnd {
  godownId: string;
  itemId: string;
  lotId: string | null;
  bucket: string;
  bndBase: Prisma.Decimal;
}

/** One bill behind a holding's BND (Physical Stock undeliveredBills[], Godown Position behind). */
export interface HoldingBndBill {
  billId: string;
  billAccYear: string;
  billRefno: string | null;
  billDate: string | null;
  custId: string | null;
  custName: string | null;
  deliveryMode: string;
  billItemId: string;
  lineNo: number;
  godownId: string;
  itemId: string;
  lotId: string | null;
  bucket: string;
  unitId: string;
  billedQty: Prisma.Decimal;
  givenQty: Prisma.Decimal;
  pendingQty: Prisma.Decimal;
  pendingBase: Prisma.Decimal;
  factor: Prisma.Decimal;
  unitKg: Prisma.Decimal;
}

interface FactsRow {
  sbi_id: string;
  sbi_acc_year: string;
  sb_id: string;
  sb_bill_refno: string | null;
  sb_bill_date: Date | null;
  sb_company_id: string;
  sb_branch_id: string;
  sb_status: string;
  sb_is_deleted: boolean;
  sb_bill_mode: string | null;
  sb_delivery_mode: string;
  sb_delivery_status: string;
  sb_cust_id: string | null;
  sb_cust_name: string | null;
  sbi_line_no: number;
  sbi_split_no: number | null;
  sbi_is_deleted: boolean;
  sbi_is_service: boolean;
  sbi_src_doc_type: string | null;
  sbi_src_doc_refno: string | null;
  sbi_item_id: string;
  sbi_item_unit_id: string;
  sbi_godown_id: string;
  sbi_lot_id: string | null;
  bucket: string;
  billed_qty: Prisma.Decimal;
  factor: Prisma.Decimal;
  unit_kg: Prisma.Decimal;
  settled_qty: Prisma.Decimal;
  given_qty: Prisma.Decimal;
  settled_base: Prisma.Decimal;
  given_base: Prisma.Decimal;
  eligible: boolean;
}

/**
 * The §5.1 readers, shared by every module that shows or checks billed-not-
 * delivered. Everything is a SUM of events at read time (decision 35); nothing
 * here writes.
 */
@Injectable()
export class DeliveryPendingService {
  constructor(private readonly prisma: PrismaService) {}

  /** The named bill lines (deleted ones too, flagged), each with its event sums. */
  async linesByKeys(client: Client | null, keys: readonly BillLineKey[]): Promise<BillLineFacts[]> {
    if (keys.length === 0) {
      return [];
    }
    const ids = keys.map((k) => k.billItemId);
    const years = keys.map((k) => k.billAccYear.trim());
    return this.facts(
      client,
      Prisma.sql`JOIN (SELECT unnest(${ids}::uuid[]) AS id, unnest(${years}::text[]) AS yr) k
                   ON i.sbi_id = k.id AND i.sbi_acc_year = k.yr::bpchar`,
      Prisma.empty,
    );
  }

  /**
   * P6 review S3 (decision R-1): the TAKEN part of every live POSTED sale
   * return of each named bill line — `sri_return_qty + free − sri_undelivered_qty`,
   * in base units — and the returns' numbers. The same formula the return's
   * own rule 4 reads (sale-return-delivery `takenBeforeBase`). Lines no
   * return touched are absent.
   */
  async returnsTakenByLine(
    client: Client | null,
    keys: readonly BillLineKey[],
  ): Promise<Map<string, { takenBase: Prisma.Decimal; refnos: string[] }>> {
    const out = new Map<string, { takenBase: Prisma.Decimal; refnos: string[] }>();
    if (keys.length === 0) {
      return out;
    }
    const c = client ?? this.prisma;
    const ids = keys.map((k) => k.billItemId);
    const years = keys.map((k) => k.billAccYear.trim());
    const rows = await c.$queryRaw<
      { id: string; yr: string; base: Prisma.Decimal | null; refnos: string[] | null }[]
    >`
      SELECT sri.sri_bill_item_id AS id, sri.sri_bill_acc_year AS yr,
             SUM((COALESCE(sri.sri_return_qty, 0) + COALESCE(sri.sri_free_qty, 0) - sri.sri_undelivered_qty)
                 * CASE WHEN sri.sri_to_base_factor > 0 THEN sri.sri_to_base_factor
                        ELSE COALESCE(NULLIF(u.iuc_to_base_factor, 0), 1) END) AS base,
             array_agg(DISTINCT sr.sr_return_refno) FILTER (WHERE sr.sr_return_refno IS NOT NULL) AS refnos
        FROM sales.sale_return_item sri
        JOIN (SELECT unnest(${ids}::uuid[]) AS id, unnest(${years}::text[]) AS yr) k
          ON sri.sri_bill_item_id = k.id AND sri.sri_bill_acc_year = k.yr::bpchar
        JOIN sales.sale_return sr ON sr.sr_id = sri.sri_return_id AND sr.sr_acc_year = sri.sri_acc_year
        LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = sri.sri_item_unit_id
       WHERE sri.sri_is_deleted = false
         AND sr.sr_is_deleted = false
         AND sr.sr_status = 'POSTED'
       GROUP BY sri.sri_bill_item_id, sri.sri_bill_acc_year`;
    for (const r of rows) {
      out.set(`${r.id}|${r.yr.trim()}`, { takenBase: dec(r.base), refnos: r.refnos ?? [] });
    }
    return out;
  }

  /** Every live line of the named bills, eligible or not. */
  async linesOfBills(client: Client | null, bills: readonly BillKey[]): Promise<BillLineFacts[]> {
    if (bills.length === 0) {
      return [];
    }
    const ids = bills.map((k) => k.billId);
    const years = bills.map((k) => k.billAccYear.trim());
    return this.facts(
      client,
      Prisma.sql`JOIN (SELECT unnest(${ids}::uuid[]) AS id, unnest(${years}::text[]) AS yr) k
                   ON i.sbi_bill_id = k.id AND i.sbi_acc_year = k.yr::bpchar`,
      Prisma.sql`AND i.sbi_is_deleted = false`,
    );
  }

  private async facts(
    client: Client | null,
    keyJoin: Prisma.Sql,
    extra: Prisma.Sql,
  ): Promise<BillLineFacts[]> {
    const c = client ?? this.prisma;
    const rows = await c.$queryRaw<FactsRow[]>`
      SELECT i.sbi_id, i.sbi_acc_year, b.sb_id, b.sb_bill_refno, b.sb_bill_date,
             b.sb_company_id, b.sb_branch_id, b.sb_status, b.sb_is_deleted, b.sb_bill_mode,
             b.sb_delivery_mode, b.sb_delivery_status, b.sb_cust_id, b.sb_cust_name,
             i.sbi_line_no, i.sbi_split_no, i.sbi_is_deleted, i.sbi_is_service,
             i.sbi_src_doc_type, i.sbi_src_doc_refno,
             i.sbi_item_id, i.sbi_item_unit_id, i.sbi_godown_id, i.sbi_lot_id,
             COALESCE(i.sbi_bucket, 'SALEABLE') AS bucket,
             i.sbi_bill_qty AS billed_qty,
             ${lineFactorSql()} AS factor,
             ${lineUnitKgSql()} AS unit_kg,
             COALESCE(ev.settled_qty, 0)  AS settled_qty,
             COALESCE(ev.given_qty, 0)    AS given_qty,
             COALESCE(ev.settled_base, 0) AS settled_base,
             COALESCE(ev.given_base, 0)   AS given_base,
             ${eligibleLineExpr()} AS eligible
        FROM sales.sale_bill_item i
        ${keyJoin}
        JOIN sales.sale_bill b ON b.sb_id = i.sbi_bill_id AND b.sb_acc_year = i.sbi_acc_year
        LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = i.sbi_item_unit_id
        LEFT JOIN LATERAL ${lineEventSumsLateral()} ev ON true
       WHERE true ${extra}
       ORDER BY b.sb_acc_year, b.sb_id, i.sbi_line_no, i.sbi_split_no`;
    return rows.map(toFacts);
  }

  /**
   * BND per holding in a company + branch (base unit), only holdings with
   * BND ≠ 0. Narrow by godowns / items / lots / bucket when given.
   */
  async bndByHolding(
    client: Client | null,
    scope: {
      companyId: string;
      branchId: string;
      godownIds?: readonly string[] | null;
      itemIds?: readonly string[] | null;
      lotIds?: readonly string[] | null;
      bucket?: string | null;
    },
  ): Promise<HoldingBnd[]> {
    const c = client ?? this.prisma;
    const rows = await c.$queryRaw<
      {
        godown_id: string;
        item_id: string;
        lot_id: string | null;
        bucket: string;
        bnd_base: Prisma.Decimal;
      }[]
    >`
      WITH op AS (${pendingLinesCte(scope.companyId, scope.branchId, narrow(scope))})
      SELECT op.godown_id, op.item_id, op.lot_id, op.bucket, SUM(op.pending_base) AS bnd_base
        FROM op
       GROUP BY op.godown_id, op.item_id, op.lot_id, op.bucket
      HAVING SUM(op.pending_base) <> 0`;
    return rows.map((r) => ({
      godownId: r.godown_id,
      itemId: r.item_id,
      lotId: r.lot_id,
      bucket: r.bucket,
      bndBase: dec(r.bnd_base),
    }));
  }

  /** The eligible lines (pending ≠ 0) behind BND, oldest bill first. */
  async bndBills(
    client: Client | null,
    scope: {
      companyId: string;
      branchId: string;
      godownIds?: readonly string[] | null;
      itemIds?: readonly string[] | null;
      lotIds?: readonly string[] | null;
      bucket?: string | null;
    },
  ): Promise<HoldingBndBill[]> {
    const c = client ?? this.prisma;
    const rows = await c.$queryRaw<
      {
        bill_id: string;
        bill_acc_year: string;
        bill_refno: string | null;
        bill_date: Date | null;
        cust_id: string | null;
        cust_name: string | null;
        delivery_mode: string;
        line_id: string;
        line_no: number;
        godown_id: string;
        item_id: string;
        lot_id: string | null;
        bucket: string;
        unit_id: string;
        billed_qty: Prisma.Decimal;
        given_qty: Prisma.Decimal;
        pending_qty: Prisma.Decimal;
        pending_base: Prisma.Decimal;
        factor: Prisma.Decimal;
        unit_kg: Prisma.Decimal;
      }[]
    >`
      WITH op AS (${pendingLinesCte(scope.companyId, scope.branchId, narrow(scope))})
      SELECT op.* FROM op
       ORDER BY op.bill_date, op.bill_refno, op.line_no`;
    return rows.map((r) => ({
      billId: r.bill_id,
      billAccYear: r.bill_acc_year.trim(),
      billRefno: r.bill_refno,
      billDate: ymd(r.bill_date),
      custId: r.cust_id,
      custName: r.cust_name,
      deliveryMode: r.delivery_mode,
      billItemId: r.line_id,
      lineNo: r.line_no,
      godownId: r.godown_id,
      itemId: r.item_id,
      lotId: r.lot_id,
      bucket: r.bucket,
      unitId: r.unit_id,
      billedQty: dec(r.billed_qty),
      givenQty: dec(r.given_qty),
      pendingQty: dec(r.pending_qty),
      pendingBase: dec(r.pending_base),
      factor: dec(r.factor),
      unitKg: dec(r.unit_kg),
    }));
  }
}

function narrow(scope: {
  godownIds?: readonly string[] | null;
  itemIds?: readonly string[] | null;
  lotIds?: readonly string[] | null;
  bucket?: string | null;
}): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  if (scope.godownIds && scope.godownIds.length > 0) {
    parts.push(Prisma.sql`AND i.sbi_godown_id = ANY(${[...scope.godownIds]}::uuid[])`);
  }
  if (scope.itemIds && scope.itemIds.length > 0) {
    parts.push(Prisma.sql`AND i.sbi_item_id = ANY(${[...scope.itemIds]}::uuid[])`);
  }
  if (scope.lotIds && scope.lotIds.length > 0) {
    parts.push(Prisma.sql`AND i.sbi_lot_id = ANY(${[...scope.lotIds]}::uuid[])`);
  }
  if (scope.bucket) {
    parts.push(Prisma.sql`AND COALESCE(i.sbi_bucket, 'SALEABLE') = ${scope.bucket}`);
  }
  return parts.length > 0 ? Prisma.join(parts, ' ') : Prisma.empty;
}

function toFacts(r: FactsRow): BillLineFacts {
  const billed = dec(r.billed_qty);
  const settled = dec(r.settled_qty);
  const factor = dec(r.factor);
  const pending = billed.minus(settled);
  return {
    billItemId: r.sbi_id,
    billAccYear: r.sbi_acc_year.trim(),
    billId: r.sb_id,
    billRefno: r.sb_bill_refno,
    billDate: ymd(r.sb_bill_date),
    companyId: r.sb_company_id,
    branchId: r.sb_branch_id,
    billStatus: r.sb_status,
    billDeleted: r.sb_is_deleted,
    billMode: r.sb_bill_mode,
    deliveryMode: r.sb_delivery_mode,
    deliveryStatus: r.sb_delivery_status,
    custId: r.sb_cust_id,
    custName: r.sb_cust_name,
    lineNo: r.sbi_line_no,
    splitNo: r.sbi_split_no ?? 1,
    lineDeleted: r.sbi_is_deleted,
    isService: r.sbi_is_service,
    srcDocType: r.sbi_src_doc_type,
    srcDocRefno: r.sbi_src_doc_refno,
    itemId: r.sbi_item_id,
    unitId: r.sbi_item_unit_id,
    godownId: r.sbi_godown_id,
    lotId: r.sbi_lot_id,
    bucket: r.bucket,
    billedQty: billed,
    factor,
    unitKg: dec(r.unit_kg),
    settledQty: settled,
    givenQty: dec(r.given_qty),
    pendingQty: pending,
    settledBase: dec(r.settled_base),
    givenBase: dec(r.given_base),
    pendingBase: pending.times(factor),
    eligible: r.eligible === true,
  };
}

/** A numeric from a raw row as Decimal (null → 0). */
export function dec(v: Prisma.Decimal | string | number | null | undefined): Prisma.Decimal {
  if (v === null || v === undefined || v === '') {
    return D0;
  }
  return v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v);
}

/** A DATE column (read as UTC midnight) → 'YYYY-MM-DD'. */
export function ymd(d: Date | string | null | undefined): string | null {
  if (!d) {
    return null;
  }
  if (typeof d === 'string') {
    return d.slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}
