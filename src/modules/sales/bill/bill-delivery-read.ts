import { Prisma } from '@prisma/client';
import type {
  BillLineFacts,
  DeliveryPendingService,
} from '../delivery/core/delivery-pending.service';
import { encodeDeliveryQr } from '../delivery/core/delivery-qr';
import { istDateText } from './bill-delivery.helper';

/**
 * Delivery tracking plan §8.4 items 2 / 5 / 6 — what the bill's GET, its post
 * and the party context carry about delivery. Read only; every figure is a sum
 * of events at the moment of the request (decision 35).
 */

/** /bills/get `delivery` (inset B: the chip, the Delivery box, the godown QR). */
export interface BillDeliveryBlock {
  status: string;
  mode: string;
  billedPkgs: string;
  givenPkgs: string;
  leftPkgs: string;
  /** "12 Bag + 4 Pkt" — what is still to give, by unit; '' when nothing. */
  leftText: string;
  leftKg: string;
  /** The notes that gave goods of this bill (live GIVEN / CLEANUP), oldest first. */
  given: { sdnId: string | null; accYear: string | null; refno: string; date: string; text: string }[];
  /** Draft notes holding lines of this bill. */
  drafts: { sdnId: string; refno: string; godownName: string }[];
  /** Days since the bill date while something is left, else null. */
  oldestDays: number | null;
  /** NXB1-… for Pickup / Dispatch bills (decision 51), else null. */
  qrToken: string | null;
}

/** /bills/post `godownSlips[]` (Q11): one per godown with gdl_del_sheet and pending lines. */
export interface BillGodownSlip {
  godownId: string;
  godownName: string;
  lineCount: number;
}

/** /bills/party-context `oldPendingDeliveries[]` (Q8). */
export interface OldPendingDelivery {
  billId: string;
  billAccYear: string;
  billRefno: string | null;
  days: number;
  leftText: string;
}

const t = (d: Prisma.Decimal): string => d.toDecimalPlaces(3).toString();

/** "12 Bag + 4 Pkt" from pending per unit name. */
export function leftTextOf(
  lines: readonly Pick<BillLineFacts, 'pendingQty' | 'unitId'>[],
  unitNames: ReadonlyMap<string, string>,
): string {
  const byUnit = new Map<string, Prisma.Decimal>();
  for (const l of lines) {
    if (l.pendingQty.isZero()) {
      continue;
    }
    const name = unitNames.get(l.unitId) ?? '';
    byUnit.set(name, (byUnit.get(name) ?? new Prisma.Decimal(0)).plus(l.pendingQty));
  }
  return [...byUnit.entries()]
    .filter(([, q]) => !q.isZero())
    .map(([u, q]) => `${t(q)}${u ? ` ${u}` : ''}`)
    .join(' + ');
}

export async function unitNamesOf(
  c: Prisma.TransactionClient,
  iucIds: readonly string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(iucIds)];
  if (ids.length === 0) {
    return new Map();
  }
  const rows = await c.$queryRaw<{ iuc_id: string; unit_name: string | null }[]>`
    SELECT u.iuc_id, um.unit_name
      FROM inventory.item_unit_conversion u
      LEFT JOIN inventory.item_unit_master um ON um.unit_id = u.iuc_unit_id
     WHERE u.iuc_id = ANY(${ids}::uuid[])`;
  return new Map(rows.map((r) => [r.iuc_id, r.unit_name ?? '']));
}

/** The `delivery` block and the per-line delivered / pending figures of one bill. */
export async function billDeliveryRead(
  c: Prisma.TransactionClient,
  pending: DeliveryPendingService,
  bill: {
    sbId: string;
    sbAccYear: string;
    sbBillDate: Date | null;
    sbDeliveryMode: string;
    sbDeliveryStatus: string;
  },
): Promise<{ block: BillDeliveryBlock; byLine: Map<string, { delivered: string; pending: string }> }> {
  const all = await pending.linesOfBills(c, [{ billId: bill.sbId, billAccYear: bill.sbAccYear }]);
  const lines = all.filter((l) => l.eligible);
  const units = await unitNamesOf(
    c,
    lines.map((l) => l.unitId),
  );
  const zero = new Prisma.Decimal(0);
  const sum = (f: (l: BillLineFacts) => Prisma.Decimal) =>
    lines.reduce((a, l) => a.plus(f(l)), zero);
  const left = sum((l) => l.pendingQty);
  const leftKg = sum((l) => l.pendingQty.times(l.unitKg));

  const year = bill.sbAccYear.trim();
  const given = await c.$queryRaw<
    { src_id: string | null; src_year: string | null; refno: string | null; at: Date; qty: Prisma.Decimal }[]
  >`
    SELECT e.sde_src_doc_id AS src_id, e.sde_src_acc_year AS src_year,
           COALESCE(e.sde_src_refno, 'go-live') AS refno,
           MIN(e.sde_event_datetime) AS at, SUM(e.sde_out_qty) AS qty
      FROM sales.sale_delivery_event e
     WHERE e.sde_bill_id = ${bill.sbId}::uuid AND e.sde_bill_acc_year = ${year}::bpchar
       AND e.sde_kind IN ('GIVEN', 'CLEANUP', 'CANCEL', 'GOODS_BACK')
       AND e.sde_is_deleted = false
     GROUP BY e.sde_src_doc_id, e.sde_src_acc_year, COALESCE(e.sde_src_refno, 'go-live')
    HAVING SUM(e.sde_out_qty) <> 0
     ORDER BY MIN(e.sde_event_datetime)`;
  const drafts = await c.$queryRaw<{ sdn_id: string; sdn_refno: string; godown_name: string | null }[]>`
    SELECT DISTINCT n.sdn_id, n.sdn_refno, g.gdl_name AS godown_name
      FROM sales.sale_delivery_note_item ni
      JOIN sales.sale_delivery_note n ON n.sdn_id = ni.sdni_note_id AND n.sdn_acc_year = ni.sdni_acc_year
      LEFT JOIN inventory.godown_locations g ON g.gdl_id = n.sdn_godown_id
     WHERE ni.sdni_bill_id = ${bill.sbId}::uuid AND ni.sdni_bill_acc_year = ${year}::bpchar
       AND ni.sdni_is_deleted = false AND n.sdn_is_deleted = false AND n.sdn_status = 'DRAFT'`;

  const waiting = bill.sbDeliveryMode === 'PICKUP' || bill.sbDeliveryMode === 'DISPATCH';
  const days =
    !left.isZero() && bill.sbBillDate
      ? Math.max(0, Math.floor((todayUtcMidnight() - Date.UTC(
          bill.sbBillDate.getUTCFullYear(),
          bill.sbBillDate.getUTCMonth(),
          bill.sbBillDate.getUTCDate(),
        )) / 86_400_000))
      : null;
  const byLine = new Map<string, { delivered: string; pending: string }>();
  for (const l of all) {
    byLine.set(l.billItemId, {
      delivered: l.eligible ? t(l.givenQty) : '0',
      pending: l.eligible ? t(l.pendingQty) : '0',
    });
  }
  return {
    block: {
      status: bill.sbDeliveryStatus,
      mode: bill.sbDeliveryMode,
      billedPkgs: t(sum((l) => l.billedQty)),
      givenPkgs: t(sum((l) => l.givenQty)),
      leftPkgs: t(left),
      leftText: leftTextOf(lines, units),
      leftKg: t(leftKg),
      given: given.map((g) => ({
        sdnId: g.src_id,
        accYear: g.src_year?.trim() ?? null,
        refno: g.refno ?? '',
        date: g.at.toISOString(),
        text: `${t(new Prisma.Decimal(g.qty))} pkgs on ${g.refno ?? ''} · ${istDateText(g.at)}`,
      })),
      drafts: drafts.map((d) => ({
        sdnId: d.sdn_id,
        refno: d.sdn_refno,
        godownName: d.godown_name ?? '',
      })),
      oldestDays: days,
      qrToken: waiting ? encodeDeliveryQr('BILL', bill.sbId, year) : null,
    },
    byLine,
  };
}

/** Q11: one slip per godown that has the Delivery Sheet tick and pending lines of a P / D bill. */
export async function billGodownSlips(
  c: Prisma.TransactionClient,
  pending: DeliveryPendingService,
  bill: { sbId: string; sbAccYear: string; sbDeliveryMode: string },
): Promise<BillGodownSlip[]> {
  if (bill.sbDeliveryMode !== 'PICKUP' && bill.sbDeliveryMode !== 'DISPATCH') {
    return [];
  }
  const lines = (
    await pending.linesOfBills(c, [{ billId: bill.sbId, billAccYear: bill.sbAccYear }])
  ).filter((l) => l.eligible && !l.pendingQty.isZero());
  const count = new Map<string, number>();
  for (const l of lines) {
    count.set(l.godownId, (count.get(l.godownId) ?? 0) + 1);
  }
  if (count.size === 0) {
    return [];
  }
  const rows = await c.$queryRaw<{ gdl_id: string; gdl_name: string | null }[]>`
    SELECT gdl_id, gdl_name FROM inventory.godown_locations
     WHERE gdl_id = ANY(${[...count.keys()]}::uuid[]) AND gdl_del_sheet = true
     ORDER BY gdl_name`;
  return rows.map((r) => ({
    godownId: r.gdl_id,
    godownName: r.gdl_name ?? '',
    lineCount: count.get(r.gdl_id) ?? 0,
  }));
}

/**
 * Q8: the customer's bills with something still to give for MORE than
 * `oldDays` days ("over 30", as grid 212's OLD band: today − bill date >
 * old days), oldest first. Never a block — /bills/validate turns the first
 * into the WARN BILL_OLD_PENDING_DELIVERY. "Today" is the IST calendar day
 * worked out here (`istTodayYmd`), bound as a date — not the DB session's
 * CURRENT_DATE (review N5).
 */
export async function oldPendingDeliveries(
  c: Prisma.TransactionClient,
  q: { companyId: string; branchId: string; custId: string; oldDays: number; limit?: number },
): Promise<OldPendingDelivery[]> {
  const today = istTodayYmd();
  const rows = await c.$queryRaw<
    { sb_id: string; sb_acc_year: string; sb_bill_refno: string | null; days: number; left_text: string | null }[]
  >`
    WITH op AS (
      SELECT b.sb_id, b.sb_acc_year, b.sb_bill_refno, b.sb_bill_date,
             COALESCE(um.unit_name, '') AS unit_name,
             i.sbi_bill_qty - COALESCE(ev.settled_qty, 0) AS pending_qty
        FROM sales.sale_bill b
        JOIN sales.sale_bill_item i ON i.sbi_bill_id = b.sb_id AND i.sbi_acc_year = b.sb_acc_year
        LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = i.sbi_item_unit_id
        LEFT JOIN inventory.item_unit_master um ON um.unit_id = u.iuc_unit_id
        LEFT JOIN LATERAL (SELECT SUM(e.sde_settle_qty) AS settled_qty
                             FROM sales.sale_delivery_event e
                            WHERE e.sde_bill_item_id = i.sbi_id
                              AND e.sde_bill_acc_year = i.sbi_acc_year
                              AND e.sde_is_deleted = false) ev ON true
       WHERE b.sb_company_id = ${q.companyId}::uuid
         AND b.sb_branch_id = ${q.branchId}::uuid
         AND b.sb_cust_id = ${q.custId}::uuid
         AND b.sb_delivery_status IN ('PENDING', 'PART', 'OUT')
         AND b.sb_is_deleted = false AND b.sb_status = 'POSTED'
         AND b.sb_delivery_mode IN ('PICKUP', 'DISPATCH')
         AND b.sb_bill_date < ${today}::date - ${q.oldDays}::int
         AND i.sbi_is_deleted = false AND i.sbi_is_service = false
         AND COALESCE(i.sbi_src_doc_type, '') <> 'DELIVERY_CHALLAN'
         AND i.sbi_bill_qty > 0
         AND i.sbi_bill_qty - COALESCE(ev.settled_qty, 0) > 0
    ),
    by_unit AS (
      SELECT sb_id, sb_acc_year, sb_bill_refno, sb_bill_date, unit_name, SUM(pending_qty) AS q
        FROM op GROUP BY sb_id, sb_acc_year, sb_bill_refno, sb_bill_date, unit_name
    )
    SELECT sb_id, sb_acc_year, sb_bill_refno, (${today}::date - sb_bill_date)::int AS days,
           string_agg(trim_scale(round(q, 3))::text || CASE WHEN unit_name <> '' THEN ' ' || unit_name ELSE '' END,
                      ' + ' ORDER BY unit_name) AS left_text
      FROM by_unit
     GROUP BY sb_id, sb_acc_year, sb_bill_refno, sb_bill_date
     ORDER BY sb_bill_date, sb_bill_refno
     LIMIT ${q.limit ?? 20}`;
  return rows.map((r) => ({
    billId: r.sb_id,
    billAccYear: r.sb_acc_year.trim(),
    billRefno: r.sb_bill_refno,
    days: Number(r.days),
    leftText: r.left_text ?? '',
  }));
}

/** Today's IST calendar day as 'YYYY-MM-DD' (db-session-timezone-ist: bound ::date). */
export function istTodayYmd(): string {
  return new Date(todayUtcMidnight()).toISOString().slice(0, 10);
}

function todayUtcMidnight(): number {
  // The IST calendar day, as the books keep it (db-session-timezone-ist).
  const ist = new Date(Date.now() + 330 * 60_000);
  return Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
}
