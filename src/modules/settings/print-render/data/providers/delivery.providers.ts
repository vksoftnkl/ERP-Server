import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../database/prisma/prisma.service';
import { loadRights, NO_RIGHTS, type MenuRights } from '../../../../../common/posting/rights';
import { SalesContextService } from '../../../../sales/posting/sales-context.service';
import {
  DEFAULT_AMBER_DAYS,
  DEFAULT_OLD_DAYS,
  DELIVERY_MENU_ID,
  DELIVERY_NOTE_DOC_TYPE,
  DELIVERY_SETTING_KEYS,
  type BillKey,
} from '../../../../sales/delivery/core/delivery.constants';
import {
  DeliveryPendingService,
  type BillLineFacts,
} from '../../../../sales/delivery/core/delivery-pending.service';
import {
  eligibleLineWhere,
  lineEventSumsLateral,
  lineUnitKgSql,
} from '../../../../sales/delivery/core/delivery-pending.sql';
import { deliveryQrCaption, encodeDeliveryQr } from '../../../../sales/delivery/core/delivery-qr';
import { lineWeightKg } from '../../../../sales/delivery/core/delivery-weight';
import {
  DeliveryNoteReadService,
  type DeliveryBillView,
  type DeliveryLineView,
} from '../../../../sales/delivery/delivery-note-read.service';
import { PrintDataProvider, PrintRow, ProviderRequest } from '../print-data-provider.types';
import { requireDocument } from './provider.utils';
import {
  countText,
  decOf,
  dmyText,
  istText,
  numOf,
  qtyText,
  RenderMemo,
  UUID,
  uuidList,
} from './print-text.utils';

/**
 * Delivery tracking P5 (plan sales/plan-delivery-tracking-p1-2026-11-15.md §10,
 * addendum §7): the datasets of five print purposes. No prices anywhere.
 *
 *   GATE_PASS          sales.delivery_note.head / .lines / .still_to_come
 *                      docId = sdn_id, accYear = sdn_acc_year. Read through the
 *                      note's own GET payload (one set of numbers with the screen).
 *                      VIEW + PRINT on menu 305.
 *   GODOWN_SLIP        sales.bill.godown_slip.head / .lines
 *                      docId = sb_id, accYear = sb_acc_year, prompt godown_id
 *                      (blank = every godown). The bill's open lines in that godown.
 *   SALE_INVOICE       sales.bill.delivery (one row): delivery_qr ("Godown scan",
 *                      NXB1-…) on Pickup / Dispatch bills, '' otherwise (Q10).
 *   PICK_LIST          sales.delivery.pick_list.head / .lines
 *   PENDING_DELIVERIES sales.delivery.pending.head / .rows
 *                      ONE render over the bills the 304 screen names: prompt
 *                      bill_ids (comma list of sb_id), optional godown_id and
 *                      filter_text (PENDING_DELIVERIES also dc_ids). docId = the
 *                      company (as the report prints). VIEW + PRINT on menu 304.
 *
 * Quantities are numbers AND `*_text` without trailing zeros ("80", "9.999");
 * every time is IST 12-hour. A refusal (rights, a note not found, a bad id list)
 * is thrown as an Error whose message the render returns (PROVIDER_FAILED).
 */

type Tx = Prisma.TransactionClient;
const Z = new Prisma.Decimal(0);

// ── the shapes read from the note's GET payload ─────────────────────────────────

export interface NotePayloadNote {
  sdnId: string;
  sdnAccYear: string;
  sdnRefno: string;
  deviceCode: string | null;
  sdnDate: string | null;
  sdnDatetime: string;
  sdnStatus: string;
  sdnGodownId: string;
  godownName: string;
  sdnMode: string;
  sdnVehicleNo: string | null;
  vehicleCapacityKg: string | null;
  driverName: string | null;
  loadmanNames: string[];
  supervisorName: string | null;
  sdnCollectedBy: string | null;
  sdnCollectorPhone: string | null;
  transport: {
    transporterName: string | null;
    lrNo: string | null;
    lrDate: string | Date | null;
  };
  sdnRemarks: string | null;
  sdnPrintCount: number;
  postedOn: string | null;
  postedBy: string | null;
  cancelledOn: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  goodsBackPkgs: string;
  qrToken: string;
}

export interface NotePayload {
  note: NotePayloadNote;
  bills: DeliveryBillView[];
  lines: DeliveryLineView[];
}

/** One open line of the note's bills, named (the "still to come" block). */
export interface OpenLine {
  billId: string;
  billRefno: string | null;
  billItemId: string;
  lineNo: number;
  itemName: string;
  unitName: string;
  godownId: string;
  godownName: string;
  lotNo: string | null;
  pendingQty: Prisma.Decimal;
}

export interface GatePassFacts {
  companyName: string | null;
  branchName: string | null;
  cameBackAt: Date | null;
  printedBy: string | null;
  at: Date;
}

export interface GatePassData {
  head: PrintRow;
  lines: PrintRow[];
  still: PrintRow[];
}

const NOTE_MODE_TEXT: Record<string, string> = {
  SELF: 'Self pickup',
  VEHICLE: 'Our vehicle',
  TRANSPORTER: 'Transporter',
};

const BILL_MODE_TEXT: Record<string, string> = {
  INSTANT: 'Instant',
  PICKUP: 'Pickup',
  DISPATCH: 'Dispatch',
};

/** The MASTER row of the gate pass. Exported for the spec. */
export function gatePassHeadRow(p: NotePayload, stillCount: number, f: GatePassFacts): PrintRow {
  const n = p.note;
  const given = p.lines.filter((l) => decOf(l.qty).greaterThan(0));
  const qty = given.reduce((a, l) => a.plus(decOf(l.qty)), Z);
  const kg = given.reduce((a, l) => a.plus(decOf(l.weightKg)), Z);
  const bags = given
    .filter((l) => /^bag/i.test(l.unitName.trim()))
    .reduce((a, l) => a.plus(decOf(l.qty)), Z);
  const back = decOf(n.goodsBackPkgs);
  const bills = new Set(given.map((l) => l.billId)).size;
  // Up to four "label : text" rows under No / Date, filled from the top.
  const info: [string, string][] = [];
  if (n.sdnMode === 'SELF') {
    const who = [n.sdnCollectedBy, n.sdnCollectorPhone].filter(Boolean).join('  ');
    info.push(['Collected by', who || '-']);
  }
  if (n.sdnVehicleNo || n.driverName) {
    info.push(['Vehicle', `${n.sdnVehicleNo ?? '-'}${n.driverName ? `   Driver: ${n.driverName}` : ''}`]);
  }
  if (n.transport.transporterName || n.transport.lrNo) {
    const lrDate = n.transport.lrDate ? dmyText(n.transport.lrDate) : '';
    info.push([
      'Transporter',
      `${n.transport.transporterName ?? '-'}` +
        (n.transport.lrNo ? `   LR ${n.transport.lrNo}${lrDate ? ` dt ${lrDate}` : ''}` : ''),
    ]);
  }
  const crew = n.loadmanNames.filter(Boolean);
  if (crew.length > 0 || n.supervisorName) {
    info.push([
      'Loadmen',
      `${crew.length > 0 ? crew.join(', ') : '-'}` +
        (n.supervisorName ? `   Supervisor: ${n.supervisorName}` : ''),
    ]);
  }
  const posted = n.sdnStatus !== 'DRAFT';
  const statusMark =
    n.sdnStatus === 'DRAFT'
      ? 'DRAFT - NOT A GATE PASS'
      : n.sdnStatus === 'CANCELLED'
        ? 'CANCELLED'
        : '';
  const totals = [
    countText(given.length, 'line'),
    countText(bills, 'bill'),
    bags.greaterThan(0) ? `${qtyText(bags)} bags` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const printedAt = istText(f.at);
  return {
    title: 'GATE PASS / DELIVERY NOTE',
    company_name: f.companyName,
    branch_name: f.branchName,
    godown_name: n.godownName,
    refno: n.sdnRefno,
    device_code: n.deviceCode,
    status: n.sdnStatus,
    status_mark: statusMark,
    is_reprint: n.sdnPrintCount > 0,
    copy_mark: n.sdnPrintCount > 0 ? 'DUPLICATE' : '',
    date_text: posted ? istText(n.sdnDatetime) : dmyText(n.sdnDate),
    mode: n.sdnMode,
    mode_text: NOTE_MODE_TEXT[n.sdnMode] ?? n.sdnMode,
    info_1_label: info[0]?.[0] ?? '',
    info_1_text: info[0]?.[1] ?? '',
    info_2_label: info[1]?.[0] ?? '',
    info_2_text: info[1]?.[1] ?? '',
    info_3_label: info[2]?.[0] ?? '',
    info_3_text: info[2]?.[1] ?? '',
    info_4_label: info[3]?.[0] ?? '',
    info_4_text: info[3]?.[1] ?? '',
    qr_token: n.qrToken,
    qr_caption: deliveryQrCaption(n.qrToken),
    lines_count: given.length,
    bills_count: bills,
    given_qty: numOf(qty),
    given_text: qtyText(qty),
    bags_text: qtyText(bags),
    weight_kg: numOf(kg),
    weight_text: qtyText(kg),
    totals_text: totals,
    came_back_pkgs: numOf(back),
    came_back_text: back.greaterThan(0)
      ? `${qtyText(back)} ${back.equals(1) ? 'pkg' : 'pkgs'} came back${f.cameBackAt ? ` on ${istText(f.cameBackAt)}` : ''}`
      : '',
    still_count: stillCount,
    still_title:
      stillCount > 0 ? 'Still to come on these bills:' : 'Nothing more to come on these bills.',
    remarks: n.sdnRemarks ?? '',
    posted_by: n.postedBy ?? '',
    cancelled_text:
      n.sdnStatus === 'CANCELLED'
        ? `Cancelled ${istText(n.cancelledOn)}${n.cancelledBy ? ` by ${n.cancelledBy}` : ''}` +
          (n.cancelReason ? `: ${n.cancelReason}` : '')
        : '',
    printed_at: printedAt,
    printed_by: f.printedBy ?? '',
    printed_line: [
      `Printed ${printedAt}`,
      f.printedBy,
      n.deviceCode ? `device ${n.deviceCode}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
  };
}

/** The DETAIL rows: the note's lines with something given (qty > 0). Exported for the spec. */
export function gatePassLineRows(p: NotePayload): PrintRow[] {
  const customer = new Map(p.bills.map((b) => [b.billId, b.custName ?? '']));
  return p.lines
    .filter((l) => decOf(l.qty).greaterThan(0))
    .map((l, i) => {
      const back = decOf(l.goodsBackQty);
      return {
        sl_no: i + 1,
        bill_refno: l.billRefno ?? '',
        cust_name: customer.get(l.billId) ?? '',
        item_code: l.itemCode ?? '',
        item_name: l.itemName,
        unit_name: l.unitName,
        qty: numOf(l.qty),
        qty_text: qtyText(l.qty),
        lot_no: l.lotNo ?? '',
        weight_kg: numOf(l.weightKg),
        weight_text: decOf(l.weightKg).isZero() ? '' : qtyText(l.weightKg),
        came_back_qty: numOf(back),
        came_back_text: back.greaterThan(0) ? `Came back ${qtyText(back)}` : '',
        godown_name: l.godownName,
        bill_godown_name: l.billGodownName,
        other_godown: l.otherGodown,
        lot_swap: l.lotSwap,
        note_text: [
          l.lotSwap ? `lot ${l.lotNo ?? '-'} for ${l.billLotNo ?? '-'}` : null,
          l.otherGodown ? `billed from ${l.billGodownName}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      };
    });
}

/**
 * The open lines of the note's bills after this note ("Still to come on these
 * bills"), every godown. A DRAFT holds nothing (Q12), so its own qty is taken
 * off the bill line's pending here — what would be left once it is posted.
 * Exported for the spec.
 */
export function stillToComeRows(p: NotePayload, open: readonly OpenLine[]): PrintRow[] {
  const draftQty = new Map<string, Prisma.Decimal>();
  if (p.note.sdnStatus === 'DRAFT') {
    for (const l of p.lines) {
      draftQty.set(l.billItemId, (draftQty.get(l.billItemId) ?? Z).plus(decOf(l.qty)));
    }
  }
  const billOrder = new Map(p.bills.map((b, i) => [b.billId, i]));
  return open
    .map((o) => ({ o, left: o.pendingQty.minus(draftQty.get(o.billItemId) ?? Z) }))
    .filter(({ left }) => left.greaterThan(0))
    .sort(
      (a, b) =>
        (billOrder.get(a.o.billId) ?? 0) - (billOrder.get(b.o.billId) ?? 0) ||
        a.o.lineNo - b.o.lineNo,
    )
    .map(({ o, left }, i) => {
      const elsewhere = o.godownId !== p.note.sdnGodownId;
      return {
        sl_no: i + 1,
        bill_refno: o.billRefno ?? '',
        item_name: o.itemName,
        unit_name: o.unitName,
        pending_qty: numOf(left),
        pending_text: qtyText(left),
        godown_name: o.godownName,
        lot_no: o.lotNo ?? '',
        other_godown: elsewhere,
        text:
          `${o.billRefno ?? ''}  ${o.itemName} ${qtyText(left)} ${o.unitName}`.trim() +
          (elsewhere ? ` (${o.godownName} godown)` : ''),
      };
    });
}

// ── the bill: godown slip, Tax Invoice QR ───────────────────────────────────────

export interface SlipBill {
  sb_id: string;
  sb_acc_year: string;
  sb_bill_refno: string | null;
  sb_bill_date: Date | string | null;
  sb_bill_datetime: Date | null;
  sb_status: string;
  sb_delivery_mode: string;
  sb_delivery_status: string;
  sb_cust_name: string | null;
  sb_cust_place: string | null;
  sb_cust_phone: string | null;
  sb_remarks: string | null;
  sb_vehicle_no: string | null;
  comp_name: string | null;
  br_name: string | null;
  area_name: string | null;
  city_name: string | null;
  salesmen: string | null;
}

export interface SlipLine {
  lineNo: number;
  itemCode: string | null;
  itemName: string;
  unitName: string;
  godownId: string;
  godownName: string;
  lotNo: string | null;
  billedQty: Prisma.Decimal;
  givenQty: Prisma.Decimal;
  pendingQty: Prisma.Decimal;
  unitKg: Prisma.Decimal;
}

/** The godown slip's MASTER row. Exported for the spec. */
export function godownSlipHeadRow(
  b: SlipBill,
  lines: readonly SlipLine[],
  godownName: string | null,
  printedBy: string | null,
  at: Date,
): PrintRow {
  const waiting = b.sb_delivery_mode === 'PICKUP' || b.sb_delivery_mode === 'DISPATCH';
  const token = waiting ? encodeDeliveryQr('BILL', b.sb_id, b.sb_acc_year.trim()) : '';
  const qty = lines.reduce((a, l) => a.plus(l.pendingQty), Z);
  const kg = lines.reduce((a, l) => a.plus(lineWeightKg(l.pendingQty, l.unitKg)), Z);
  const statusMark =
    b.sb_status !== 'POSTED'
      ? `${b.sb_status} BILL - NOTHING TO GIVE`
      : !waiting
        ? 'INSTANT BILL - NOTHING TO GIVE'
        : '';
  const printedAt = istText(at);
  return {
    title: 'GODOWN SLIP',
    company_name: b.comp_name,
    branch_name: b.br_name,
    godown_name: godownName ?? 'All godowns',
    bill_refno: b.sb_bill_refno ?? '',
    bill_date_text: b.sb_bill_datetime ? istText(b.sb_bill_datetime) : dmyText(b.sb_bill_date as string | Date | null),
    status: b.sb_status,
    status_mark: statusMark,
    delivery_mode: b.sb_delivery_mode,
    delivery_mode_text:
      b.sb_delivery_mode === 'PICKUP'
        ? 'Pickup - the customer collects'
        : b.sb_delivery_mode === 'DISPATCH'
          ? 'Dispatch - we deliver'
          : (BILL_MODE_TEXT[b.sb_delivery_mode] ?? b.sb_delivery_mode),
    delivery_status: b.sb_delivery_status,
    cust_name: b.sb_cust_name ?? '',
    cust_place: [b.area_name, b.city_name ?? b.sb_cust_place].filter(Boolean).join(', '),
    cust_phone: b.sb_cust_phone ?? '',
    salesman_names: b.salesmen ?? '',
    vehicle_no: b.sb_vehicle_no ?? '',
    remarks: b.sb_remarks ?? '',
    qr_token: token,
    qr_caption: token ? deliveryQrCaption(token) : '',
    lines_count: lines.length,
    qty: numOf(qty),
    qty_text: qtyText(qty),
    weight_kg: numOf(kg),
    weight_text: qtyText(kg),
    totals_text: `${countText(lines.length, 'line')} · ${qtyText(qty)} pkgs${kg.isZero() ? '' : ` · ${qtyText(kg)} kg`}`,
    printed_at: printedAt,
    printed_by: printedBy ?? '',
    printed_line: [`Printed ${printedAt}`, printedBy].filter(Boolean).join(' · '),
  };
}

/** The godown slip's lines: what is still to give from that godown. Exported for the spec. */
export function godownSlipLineRows(lines: readonly SlipLine[]): PrintRow[] {
  return lines.map((l, i) => {
    const kg = lineWeightKg(l.pendingQty, l.unitKg);
    return {
      sl_no: i + 1,
      line_no: l.lineNo,
      item_code: l.itemCode ?? '',
      item_name: l.itemName,
      unit_name: l.unitName,
      godown_name: l.godownName,
      lot_no: l.lotNo ?? '',
      billed_qty: numOf(l.billedQty),
      billed_text: qtyText(l.billedQty),
      given_qty: numOf(l.givenQty),
      given_text: l.givenQty.isZero() ? '' : qtyText(l.givenQty),
      qty: numOf(l.pendingQty),
      qty_text: qtyText(l.pendingQty),
      weight_kg: numOf(kg),
      weight_text: kg.isZero() ? '' : qtyText(kg),
    };
  });
}

/** SALE_INVOICE `delivery` dataset: the "Godown scan" QR on Pickup / Dispatch bills only (Q10). */
export function billDeliveryRow(
  bill: { sb_id: string; sb_acc_year: string; sb_delivery_mode: string; sb_delivery_status: string } | null,
): PrintRow {
  const waiting =
    !!bill && (bill.sb_delivery_mode === 'PICKUP' || bill.sb_delivery_mode === 'DISPATCH');
  const token = waiting ? encodeDeliveryQr('BILL', bill.sb_id, bill.sb_acc_year.trim()) : '';
  return {
    delivery_mode: bill?.sb_delivery_mode ?? '',
    delivery_mode_text: bill ? (BILL_MODE_TEXT[bill.sb_delivery_mode] ?? bill.sb_delivery_mode) : '',
    delivery_status: bill?.sb_delivery_status ?? '',
    delivery_qr: token,
    delivery_qr_caption: token ? deliveryQrCaption(token) : '',
    delivery_qr_label: token ? 'Godown scan' : '',
  };
}

// ── 304: pick list and pending list ─────────────────────────────────────────────

export interface PickLine {
  godownId: string;
  godownName: string;
  itemId: string;
  itemCode: string | null;
  itemName: string;
  unitId: string;
  unitName: string;
  billId: string;
  billRefno: string | null;
  billDate: string | null;
  custName: string | null;
  lineNo: number;
  lotNo: string | null;
  pendingQty: Prisma.Decimal;
  unitKg: Prisma.Decimal;
}

/**
 * The pick list rows, godown → item (→ unit) → bill line, each carrying its
 * group's sums so the design needs no aggregate. Exported for the spec.
 */
export function pickListRows(lines: readonly PickLine[]): PrintRow[] {
  const sorted = [...lines].sort(
    (a, b) =>
      a.godownName.localeCompare(b.godownName) ||
      a.itemName.localeCompare(b.itemName) ||
      a.unitName.localeCompare(b.unitName) ||
      (a.billDate ?? '').localeCompare(b.billDate ?? '') ||
      (a.billRefno ?? '').localeCompare(b.billRefno ?? '') ||
      a.lineNo - b.lineNo,
  );
  const gd = new Map<string, { lines: number; items: Set<string>; qty: Prisma.Decimal; kg: Prisma.Decimal }>();
  const it = new Map<string, { qty: Prisma.Decimal; kg: Prisma.Decimal; bills: Set<string> }>();
  const itemKey = (l: PickLine) => `${l.godownId}|${l.itemId}|${l.unitId}`;
  for (const l of sorted) {
    const kg = lineWeightKg(l.pendingQty, l.unitKg);
    const g = gd.get(l.godownId) ?? { lines: 0, items: new Set<string>(), qty: Z, kg: Z };
    g.lines += 1;
    g.items.add(l.itemId);
    g.qty = g.qty.plus(l.pendingQty);
    g.kg = g.kg.plus(kg);
    gd.set(l.godownId, g);
    const k = itemKey(l);
    const t = it.get(k) ?? { qty: Z, kg: Z, bills: new Set<string>() };
    t.qty = t.qty.plus(l.pendingQty);
    t.kg = t.kg.plus(kg);
    t.bills.add(l.billId);
    it.set(k, t);
  }
  let itemNo = 0;
  let lastItem = '';
  return sorted.map((l, i) => {
    const g = gd.get(l.godownId)!;
    const t = it.get(itemKey(l))!;
    if (itemKey(l) !== lastItem) {
      itemNo += 1;
      lastItem = itemKey(l);
    }
    const kg = lineWeightKg(l.pendingQty, l.unitKg);
    return {
      sl_no: i + 1,
      item_no: itemNo,
      godown_id: l.godownId,
      godown_name: l.godownName,
      godown_text:
        `${countText(g.lines, 'line')} · ${countText(g.items.size, 'item')} · ${qtyText(g.qty)} pkgs` +
        (g.kg.isZero() ? '' : ` · ${qtyText(g.kg)} kg`),
      item_key: itemKey(l),
      item_code: l.itemCode ?? '',
      item_name: l.itemName,
      unit_name: l.unitName,
      item_qty: numOf(t.qty),
      item_qty_text: qtyText(t.qty),
      item_kg_text: t.kg.isZero() ? '' : qtyText(t.kg),
      item_bills: t.bills.size,
      item_text:
        `${qtyText(t.qty)} ${l.unitName}` +
        (t.kg.isZero() ? '' : ` · ${qtyText(t.kg)} kg`) +
        ` · ${countText(t.bills.size, 'bill')}`,
      bill_refno: l.billRefno ?? '',
      bill_date_text: dmyText(l.billDate),
      cust_name: l.custName ?? '',
      line_no: l.lineNo,
      lot_no: l.lotNo ?? '',
      qty: numOf(l.pendingQty),
      qty_text: qtyText(l.pendingQty),
      weight_kg: numOf(kg),
      weight_text: kg.isZero() ? '' : qtyText(kg),
    };
  });
}

/** The pick list's MASTER row. Exported for the spec. */
export function pickListHeadRow(
  rows: readonly PrintRow[],
  asked: readonly string[],
  refnos: ReadonlyMap<string, string | null>,
  opts: { companyName: string | null; branchName: string | null; godownName: string | null; printedBy: string | null; at: Date },
): PrintRow {
  const withLines = new Set(rows.map((r) => r.bill_refno as string));
  const billsWith = asked.filter((id) => withLines.has(refnos.get(id) ?? ''));
  const nothing = asked.filter((id) => refnos.has(id) && !withLines.has(refnos.get(id) ?? ''));
  const unknown = asked.filter((id) => !refnos.has(id));
  const qty = rows.reduce((a, r) => a.plus(decOf(r.qty as number)), Z);
  const kg = rows.reduce((a, r) => a.plus(decOf(r.weight_kg as number)), Z);
  // Distinct items (an item picked in two godowns counts once).
  const items = new Set(rows.map((r) => String(r.item_key).split('|')[1])).size;
  const listed = billsWith.map((id) => refnos.get(id) ?? '').filter(Boolean);
  const printedAt = istText(opts.at);
  return {
    title: 'PICK LIST',
    company_name: opts.companyName,
    branch_name: opts.branchName,
    godown_text: opts.godownName ?? 'All godowns',
    bills_count: billsWith.length,
    bills_text:
      listed.slice(0, 15).join(', ') + (listed.length > 15 ? ` +${listed.length - 15} more` : ''),
    lines_count: rows.length,
    items_count: items,
    qty: numOf(qty),
    qty_text: qtyText(qty),
    weight_kg: numOf(kg),
    weight_text: qtyText(kg),
    totals_text:
      `${countText(billsWith.length, 'bill')} · ${countText(items, 'item')} · ${countText(rows.length, 'line')} · ${qtyText(qty)} pkgs` +
      (kg.isZero() ? '' : ` · ${qtyText(kg)} kg`),
    nothing_text: [
      nothing.length > 0
        ? `Nothing left to give on ${nothing.map((id) => refnos.get(id) ?? '').join(', ')}`
        : null,
      unknown.length > 0 ? `${countText(unknown.length, 'bill')} not found in this branch` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    printed_at: printedAt,
    printed_by: opts.printedBy ?? '',
    printed_line: [`Printed ${printedAt}`, opts.printedBy].filter(Boolean).join(' · '),
  };
}

export interface PendingDbRow {
  row_kind: 'BILL' | 'DC';
  doc_id: string;
  doc_acc_year: string;
  doc_refno: string | null;
  doc_date: string | null;
  days_old: number | null;
  cust_name: string | null;
  area_name: string | null;
  city_name: string | null;
  salesman_names: string | null;
  delivery_mode: string | null;
  delivery_status: string | null;
  godown_names: string | null;
  open_lines: number | bigint | null;
  open_pkgs: Prisma.Decimal | string | null;
  open_kg: Prisma.Decimal | string | null;
  last_given_refno: string | null;
  last_given_at: Date | null;
  dc_note: string | null;
}

/** The pending list rows, in the order the screen sent them. Exported for the spec. */
export function pendingRows(rows: readonly PendingDbRow[], amberDays: number, oldDays: number): PrintRow[] {
  return rows.map((r, i) => {
    const days = r.days_old === null || r.days_old === undefined ? null : Number(r.days_old);
    const band = days === null ? 'NEW' : days > oldDays ? 'OLD' : days > amberDays ? 'AMBER' : 'NEW';
    const kg = decOf(r.open_kg);
    return {
      sl_no: i + 1,
      row_kind: r.row_kind,
      doc_refno: r.doc_refno ?? '',
      doc_date_text: dmyText(r.doc_date),
      days_old: days,
      days_text: days === null ? '' : `${days}d`,
      age_band: band,
      is_old: band === 'OLD',
      cust_name: r.cust_name ?? '',
      area_text: [r.area_name, r.city_name].filter(Boolean).join(', '),
      salesman_names: r.salesman_names ?? '',
      mode_text:
        r.row_kind === 'DC' ? 'Challan' : (BILL_MODE_TEXT[r.delivery_mode ?? ''] ?? r.delivery_mode ?? ''),
      status: r.row_kind === 'DC' ? (r.dc_note ?? 'DC OPEN') : (r.delivery_status ?? ''),
      godown_names: r.godown_names ?? '',
      open_lines: Number(r.open_lines ?? 0),
      open_pkgs: numOf(r.open_pkgs),
      open_pkgs_text: qtyText(r.open_pkgs),
      open_kg: numOf(kg),
      open_kg_text: kg.isZero() ? '' : qtyText(kg),
      last_given_text: r.last_given_refno
        ? `${r.last_given_refno} · ${istText(r.last_given_at).slice(0, 10)}`
        : '',
    };
  });
}

/** The pending list's MASTER row. Exported for the spec. */
export function pendingHeadRow(
  rows: readonly PrintRow[],
  asked: number,
  opts: {
    companyName: string | null;
    branchName: string | null;
    godownName: string | null;
    filterText: string | null;
    oldDays: number;
    printedBy: string | null;
    at: Date;
  },
): PrintRow {
  const bills = rows.filter((r) => r.row_kind === 'BILL');
  const dcs = rows.filter((r) => r.row_kind === 'DC');
  const pkgs = rows.reduce((a, r) => a.plus(decOf(r.open_pkgs as number)), Z);
  const kg = rows.reduce((a, r) => a.plus(decOf(r.open_kg as number)), Z);
  const lines = rows.reduce((a, r) => a + Number(r.open_lines ?? 0), 0);
  const old = bills.filter((r) => r.is_old).length;
  const printedAt = istText(opts.at);
  return {
    title: 'PENDING DELIVERIES',
    company_name: opts.companyName,
    branch_name: opts.branchName,
    godown_text: opts.godownName ?? 'All godowns',
    filter_text: opts.filterText ?? '',
    bills_count: bills.length,
    dcs_count: dcs.length,
    lines_count: lines,
    old_count: old,
    pkgs_text: qtyText(pkgs),
    kg_text: qtyText(kg),
    totals_text:
      [
        countText(bills.length, 'bill'),
        dcs.length > 0 ? countText(dcs.length, 'challan') : null,
        countText(lines, 'open line'),
        `${qtyText(pkgs)} pkgs`,
        kg.isZero() ? null : `${qtyText(kg)} kg`,
        old > 0 ? `${old} over ${opts.oldDays} days` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    skipped_text:
      asked > rows.length
        ? `${asked - rows.length} of the ${asked} documents sent had nothing left to give (not listed)`
        : '',
    printed_at: printedAt,
    printed_by: opts.printedBy ?? '',
    printed_line: [`Printed ${printedAt}`, opts.printedBy].filter(Boolean).join(' · '),
  };
}

// ── the source: reads, rights, memo ─────────────────────────────────────────────

function text(params: Readonly<Record<string, unknown>>, name: string): string | null {
  const v = params[name];
  if (typeof v === 'number') return String(v);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** The prompt godown_id: blank = every godown; anything else must be an id. */
function godownPrompt(params: Readonly<Record<string, unknown>>): string | null {
  const g = text(params, 'godown_id');
  if (!g) return null;
  if (!UUID.test(g)) throw new Error(`godown_id: '${g}' is not a godown id.`);
  return g.toLowerCase();
}

interface PickData {
  head: PrintRow;
  lines: PrintRow[];
}

interface PendingData {
  head: PrintRow;
  rows: PrintRow[];
}

@Injectable()
export class DeliveryPrintSource {
  private readonly gate = new RenderMemo<GatePassData>();
  private readonly slip = new RenderMemo<{ head: PrintRow; lines: PrintRow[] }>();
  private readonly pick = new RenderMemo<PickData>();
  private readonly pend = new RenderMemo<PendingData>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly reader: DeliveryNoteReadService,
    private readonly pending: DeliveryPendingService,
    private readonly salesContext: SalesContextService,
  ) {}

  private get db(): Tx {
    return this.prisma as unknown as Tx;
  }

  /** VIEW and PRINT on the menu, or the render is refused with the right named. */
  async printRights(userId: string | null, menuId: number, what: string): Promise<MenuRights> {
    const rights = userId && UUID.test(userId) ? await loadRights(this.prisma, userId, menuId) : { ...NO_RIGHTS };
    for (const right of ['view', 'print'] as const) {
      if (!rights[right]) {
        throw new Error(
          `This user may not print ${what} (menu ${menuId}: um_can_${right} is not granted).`,
        );
      }
    }
    return rights;
  }

  async printedBy(userId: string | null): Promise<string | null> {
    if (!userId || !UUID.test(userId)) return null;
    const [user] = await this.prisma.$queryRaw<{ name: string | null }[]>`
      SELECT COALESCE(NULLIF(btrim(usr_display_name), ''), usr_login_name) AS name
        FROM public.user_master WHERE usr_id = ${userId}::uuid`;
    return user?.name ?? null;
  }

  private async names(companyId: string, branchId: string | null) {
    const [row] = await this.prisma.$queryRaw<{ comp_name: string | null; br_name: string | null }[]>`
      SELECT c.comp_name, b.br_name
        FROM public.companys c
        LEFT JOIN public.branch_master b ON b.br_id = ${branchId}::uuid AND b.br_comp_id = c.comp_id
       WHERE c.comp_id = ${companyId}::uuid`;
    return { companyName: row?.comp_name ?? null, branchName: row?.br_name ?? null };
  }

  private async godownName(godownId: string | null): Promise<string | null> {
    if (!godownId) return null;
    return (await this.reader.godownName(this.db, godownId)) || null;
  }

  private async openLines(facts: readonly BillLineFacts[]): Promise<{
    named: (f: BillLineFacts) => { itemCode: string | null; itemName: string; unitName: string; godownName: string; lotNo: string | null };
  }> {
    const n = await this.reader.names(this.db, {
      itemIds: facts.map((f) => f.itemId),
      unitIds: facts.map((f) => f.unitId),
      godownIds: facts.map((f) => f.godownId),
      lotIds: facts.map((f) => f.lotId),
    });
    return {
      named: (f) => ({
        itemCode: n.items.get(f.itemId)?.code ?? null,
        itemName: n.items.get(f.itemId)?.name ?? '',
        unitName: n.units.get(f.unitId) ?? '',
        godownName: n.godowns.get(f.godownId) ?? '',
        lotNo: f.lotId ? (n.lots.get(f.lotId) ?? null) : null,
      }),
    };
  }

  // GATE_PASS ─────────────────────────────────────────────────────────────────

  async gatePass(request: ProviderRequest, code: string): Promise<GatePassData> {
    const { docId, accYear } = requireDocument(request, code);
    const { companyId, userId } = request.context;
    return this.gate.get(`${companyId}|${docId}|${accYear}|${userId ?? ''}`, async () => {
      const rights = await this.printRights(userId, DELIVERY_MENU_ID.DELIVERY_NOTE, 'gate passes');
      const h = await this.reader.header(null, { companyId, sdnId: docId, accYear });
      if (!h) {
        throw new Error(`No delivery note ${docId} in this company for ${accYear}.`);
      }
      const payload = (await this.reader.payload(
        null,
        { companyId, branchId: h.sdnBranchId, accYear, sdnId: docId },
        rights,
      )) as unknown as NotePayload;
      const billKeys: BillKey[] = payload.bills.map((b) => ({ billId: b.billId, billAccYear: b.billAccYear }));
      const facts = (await this.pending.linesOfBills(null, billKeys)).filter(
        (f) => f.eligible && f.pendingQty.greaterThan(0),
      );
      const { named } = await this.openLines(facts);
      const open: OpenLine[] = facts.map((f) => {
        const nm = named(f);
        return {
          billId: f.billId,
          billRefno: f.billRefno,
          billItemId: f.billItemId,
          lineNo: f.lineNo,
          itemName: nm.itemName,
          unitName: nm.unitName,
          godownId: f.godownId,
          godownName: nm.godownName,
          lotNo: nm.lotNo,
          pendingQty: f.pendingQty,
        };
      });
      const [back] = await this.prisma.$queryRaw<{ at: Date | null }[]>`
        SELECT max(e.sde_event_datetime) AS at
          FROM sales.sale_delivery_event e
         WHERE e.sde_src_doc_type = ${DELIVERY_NOTE_DOC_TYPE}
           AND e.sde_src_doc_id = ${docId}::uuid
           AND e.sde_kind = 'GOODS_BACK'
           AND e.sde_is_deleted = false`;
      const [{ companyName, branchName }, printedBy] = await Promise.all([
        this.names(companyId, h.sdnBranchId),
        this.printedBy(userId),
      ]);
      const still = stillToComeRows(payload, open);
      return {
        head: gatePassHeadRow(payload, still.length, {
          companyName,
          branchName,
          cameBackAt: back?.at ?? null,
          printedBy,
          at: new Date(),
        }),
        lines: gatePassLineRows(payload),
        still,
      };
    });
  }

  // GODOWN_SLIP ───────────────────────────────────────────────────────────────

  async godownSlip(request: ProviderRequest, code: string): Promise<{ head: PrintRow; lines: PrintRow[] }> {
    const { docId, accYear } = requireDocument(request, code);
    const { companyId, userId } = request.context;
    const godownId = godownPrompt(request.params);
    return this.slip.get(`${companyId}|${docId}|${accYear}|${godownId ?? ''}|${userId ?? ''}`, async () => {
      const [bill] = await this.prisma.$queryRaw<SlipBill[]>`
        SELECT b.sb_id, b.sb_acc_year, b.sb_bill_refno, b.sb_bill_date, b.sb_bill_datetime, b.sb_status,
               b.sb_delivery_mode, b.sb_delivery_status, b.sb_cust_name, b.sb_cust_place, b.sb_cust_phone,
               b.sb_remarks, b.sb_vehicle_no, c.comp_name, br.br_name,
               a.arm_name AS area_name, ct.ctm_name AS city_name,
               (SELECT string_agg(em.emp_name, ', ' ORDER BY em.emp_name) FROM public.employee_master em
                 WHERE em.emp_id = ANY(b.sb_salesman_id)) AS salesmen
          FROM sales.sale_bill b
          JOIN public.companys c ON c.comp_id = b.sb_company_id
          LEFT JOIN public.branch_master br ON br.br_id = b.sb_branch_id
          LEFT JOIN sales.customers cu ON cu.cus_id = b.sb_cust_id
          LEFT JOIN sales.area_master a ON a.arm_id = cu.cus_area_id
          LEFT JOIN sales.city_master ct ON ct.ctm_id = a.arm_city_id
         WHERE b.sb_id = ${docId}::uuid
           AND b.sb_acc_year = ${accYear}::bpchar
           AND b.sb_company_id = ${companyId}::uuid
           AND b.sb_is_deleted = false`;
      if (!bill) {
        throw new Error(`No sale bill ${docId} in this company for ${accYear}.`);
      }
      const facts = (await this.pending.linesOfBills(null, [{ billId: docId, billAccYear: accYear }]))
        .filter((f) => f.eligible && f.pendingQty.greaterThan(0))
        .filter((f) => !godownId || f.godownId === godownId)
        .sort((a, b) => a.lineNo - b.lineNo || a.splitNo - b.splitNo);
      const { named } = await this.openLines(facts);
      const lines: SlipLine[] = facts.map((f) => {
        const nm = named(f);
        return {
          lineNo: f.lineNo,
          itemCode: nm.itemCode,
          itemName: nm.itemName,
          unitName: nm.unitName,
          godownId: f.godownId,
          godownName: nm.godownName,
          lotNo: nm.lotNo,
          billedQty: f.billedQty,
          givenQty: f.givenQty,
          pendingQty: f.pendingQty,
          unitKg: f.unitKg,
        };
      });
      const [gName, printedBy] = await Promise.all([this.godownName(godownId), this.printedBy(userId)]);
      return {
        head: godownSlipHeadRow(bill, lines, gName, printedBy, new Date()),
        lines: godownSlipLineRows(lines),
      };
    });
  }

  // SALE_INVOICE delivery ─────────────────────────────────────────────────────

  async billDelivery(request: ProviderRequest, code: string): Promise<PrintRow> {
    const { docId, accYear } = requireDocument(request, code);
    const [bill] = await this.prisma.$queryRaw<
      { sb_id: string; sb_acc_year: string; sb_delivery_mode: string; sb_delivery_status: string }[]
    >`
      SELECT sb_id, sb_acc_year, sb_delivery_mode, sb_delivery_status
        FROM sales.sale_bill
       WHERE sb_id = ${docId}::uuid
         AND sb_acc_year = ${accYear}::bpchar
         AND sb_company_id = ${request.context.companyId}::uuid
         AND sb_is_deleted = false`;
    return billDeliveryRow(bill ?? null);
  }

  // PICK_LIST ─────────────────────────────────────────────────────────────────

  async pickList(request: ProviderRequest): Promise<PickData> {
    const { companyId, branchId, userId } = request.context;
    const ids = uuidList(request.params.bill_ids, 'bill_ids');
    const godownId = godownPrompt(request.params);
    return this.pick.get(`${companyId}|${branchId ?? ''}|${ids.join(',')}|${godownId ?? ''}|${userId ?? ''}`, async () => {
      await this.printRights(userId, DELIVERY_MENU_ID.PENDING_DELIVERIES, 'pick lists (Pending Deliveries)');
      if (!branchId) throw new Error('The pick list prints for one branch; the render named none.');
      if (ids.length === 0) throw new Error('bill_ids: tick at least one bill to print a pick list.');
      const bills = await this.prisma.$queryRaw<{ sb_id: string; sb_acc_year: string; sb_bill_refno: string | null }[]>`
        SELECT sb_id, sb_acc_year, sb_bill_refno
          FROM sales.sale_bill
         WHERE sb_id = ANY(${ids}::uuid[])
           AND sb_company_id = ${companyId}::uuid
           AND sb_branch_id = ${branchId}::uuid
           AND sb_is_deleted = false`;
      const refnos = new Map(bills.map((b) => [b.sb_id, b.sb_bill_refno]));
      const facts = (
        await this.pending.linesOfBills(
          null,
          bills.map((b) => ({ billId: b.sb_id, billAccYear: b.sb_acc_year })),
        )
      ).filter((f) => f.eligible && f.pendingQty.greaterThan(0) && (!godownId || f.godownId === godownId));
      const { named } = await this.openLines(facts);
      const rows = pickListRows(
        facts.map((f) => {
          const nm = named(f);
          return {
            godownId: f.godownId,
            godownName: nm.godownName,
            itemId: f.itemId,
            itemCode: nm.itemCode,
            itemName: nm.itemName,
            unitId: f.unitId,
            unitName: nm.unitName,
            billId: f.billId,
            billRefno: f.billRefno,
            billDate: f.billDate,
            custName: f.custName,
            lineNo: f.lineNo,
            lotNo: nm.lotNo,
            pendingQty: f.pendingQty,
            unitKg: f.unitKg,
          };
        }),
      );
      const [where, gName, printedBy] = await Promise.all([
        this.names(companyId, branchId),
        this.godownName(godownId),
        this.printedBy(userId),
      ]);
      return {
        head: pickListHeadRow(rows, ids, refnos, {
          ...where,
          godownName: gName,
          printedBy,
          at: new Date(),
        }),
        lines: rows,
      };
    });
  }

  // PENDING_DELIVERIES ────────────────────────────────────────────────────────

  async pendingList(request: ProviderRequest): Promise<PendingData> {
    const { companyId, branchId, userId } = request.context;
    const billIds = uuidList(request.params.bill_ids, 'bill_ids');
    const dcIds = uuidList(request.params.dc_ids, 'dc_ids');
    const godownId = godownPrompt(request.params);
    const filterText = text(request.params, 'filter_text');
    const key = `${companyId}|${branchId ?? ''}|${billIds.join(',')}|${dcIds.join(',')}|${godownId ?? ''}|${filterText ?? ''}|${userId ?? ''}`;
    return this.pend.get(key, async () => {
      await this.printRights(userId, DELIVERY_MENU_ID.PENDING_DELIVERIES, 'the pending deliveries list');
      if (!branchId) throw new Error('The pending list prints for one branch; the render named none.');
      if (billIds.length + dcIds.length === 0) {
        throw new Error('bill_ids: send the bills the list shows (comma separated).');
      }
      const [amberRaw, oldRaw] = await Promise.all([
        this.salesContext.setting(companyId, branchId, DELIVERY_SETTING_KEYS.AMBER_DAYS),
        this.salesContext.setting(companyId, branchId, DELIVERY_SETTING_KEYS.OLD_DAYS),
      ]);
      const amber = Number(amberRaw);
      const old = Number(oldRaw);
      const amberDays = Number.isInteger(amber) && amber > 0 ? amber : DEFAULT_AMBER_DAYS;
      const oldDays = Number.isInteger(old) && old > 0 ? old : DEFAULT_OLD_DAYS;
      const db = await this.pendingDbRows(companyId, branchId, billIds, dcIds, godownId);
      const rows = pendingRows(db, amberDays, oldDays);
      const [where, gName, printedBy] = await Promise.all([
        this.names(companyId, branchId),
        this.godownName(godownId),
        this.printedBy(userId),
      ]);
      return {
        head: pendingHeadRow(rows, billIds.length + dcIds.length, {
          ...where,
          godownName: gName,
          filterText,
          oldDays,
          printedBy,
          at: new Date(),
        }),
        rows,
      };
    });
  }

  /**
   * One row per named bill with an open eligible line (in the godown when one is
   * named), then one per named posted challan with open qty — the figures of
   * grid 212, in the order the ids were sent.
   */
  private pendingDbRows(
    companyId: string,
    branchId: string,
    billIds: readonly string[],
    dcIds: readonly string[],
    godownId: string | null,
  ): Promise<PendingDbRow[]> {
    return this.prisma.$queryRaw<PendingDbRow[]>`
      WITH pl AS (
        SELECT b.sb_id, b.sb_acc_year, i.sbi_godown_id,
               i.sbi_bill_qty - COALESCE(ev.settled_qty, 0) AS pending_qty,
               ${lineUnitKgSql()} AS unit_kg,
               (${godownId}::uuid IS NULL OR i.sbi_godown_id = ${godownId}::uuid) AS in_scope
          FROM sales.sale_bill b
          JOIN sales.sale_bill_item i ON i.sbi_bill_id = b.sb_id AND i.sbi_acc_year = b.sb_acc_year
          LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = i.sbi_item_unit_id
          LEFT JOIN LATERAL ${lineEventSumsLateral()} ev ON true
         WHERE b.sb_id = ANY(${billIds}::uuid[])
           AND b.sb_company_id = ${companyId}::uuid
           AND b.sb_branch_id = ${branchId}::uuid
           AND ${eligibleLineWhere()}
      ),
      ob AS (
        SELECT p.sb_id, p.sb_acc_year,
               count(*) FILTER (WHERE p.in_scope) AS open_lines,
               SUM(p.pending_qty) FILTER (WHERE p.in_scope) AS open_pkgs,
               SUM(p.pending_qty * p.unit_kg) FILTER (WHERE p.in_scope) AS open_kg,
               string_agg(DISTINCT g.gdl_name, ', ') AS godown_names
          FROM pl p
          LEFT JOIN inventory.godown_locations g ON g.gdl_id = p.sbi_godown_id
         WHERE p.pending_qty <> 0
         GROUP BY p.sb_id, p.sb_acc_year
        HAVING count(*) FILTER (WHERE p.in_scope) > 0
      ),
      dl AS (
        SELECT d.sdc_id, d.sdc_acc_year,
               count(*) FILTER (WHERE di.sdi_open_qty > 0 AND (${godownId}::uuid IS NULL OR di.sdi_godown_id = ${godownId}::uuid)) AS open_lines,
               SUM(di.sdi_open_qty) FILTER (WHERE di.sdi_open_qty > 0 AND (${godownId}::uuid IS NULL OR di.sdi_godown_id = ${godownId}::uuid)) AS open_pkgs,
               SUM(di.sdi_open_qty * CASE WHEN di.sdi_weight_qty > 0 AND di.sdi_dc_qty > 0 THEN di.sdi_weight_qty / di.sdi_dc_qty
                                          ELSE COALESCE(u.iuc_uom_weight, 0) END)
                   FILTER (WHERE di.sdi_open_qty > 0 AND (${godownId}::uuid IS NULL OR di.sdi_godown_id = ${godownId}::uuid)) AS open_kg,
               SUM(di.sdi_dc_qty) AS total_pkgs,
               SUM(di.sdi_billed_qty) AS billed_pkgs,
               string_agg(DISTINCT g.gdl_name, ', ') FILTER (WHERE di.sdi_open_qty > 0) AS godown_names
          FROM sales.sale_dc d
          JOIN sales.sale_dc_item di ON di.sdi_dc_id = d.sdc_id AND di.sdi_acc_year = d.sdc_acc_year
          LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = di.sdi_item_unit_id
          LEFT JOIN inventory.godown_locations g ON g.gdl_id = di.sdi_godown_id
         WHERE d.sdc_id = ANY(${dcIds}::uuid[])
           AND d.sdc_company_id = ${companyId}::uuid
           AND d.sdc_branch_id = ${branchId}::uuid
           AND d.sdc_is_deleted = false
           AND d.sdc_status = 'POSTED'
           AND di.sdi_is_deleted = false
         GROUP BY d.sdc_id, d.sdc_acc_year
        HAVING count(*) FILTER (WHERE di.sdi_open_qty > 0 AND (${godownId}::uuid IS NULL OR di.sdi_godown_id = ${godownId}::uuid)) > 0
      ),
      r AS (
        SELECT 'BILL'::text AS row_kind, 0 AS kind_sort,
               array_position(${billIds}::uuid[], b.sb_id) AS pos,
               b.sb_id AS doc_id, b.sb_acc_year AS doc_acc_year, b.sb_bill_refno AS doc_refno,
               b.sb_bill_date AS doc_date, COALESCE(c.cus_name, b.sb_cust_name) AS cust_name,
               c.cus_area_id AS area_uuid, b.sb_salesman_id AS salesman_ids,
               b.sb_delivery_mode AS delivery_mode, b.sb_delivery_status AS delivery_status,
               ob.godown_names, ob.open_lines, ob.open_pkgs, ob.open_kg,
               lg.sde_src_refno AS last_given_refno, lg.sde_event_datetime AS last_given_at,
               NULL::text AS dc_note
          FROM ob
          JOIN sales.sale_bill b ON b.sb_id = ob.sb_id AND b.sb_acc_year = ob.sb_acc_year
          LEFT JOIN sales.customers c ON c.cus_id = b.sb_cust_id
          LEFT JOIN LATERAL (SELECT e.sde_src_refno, e.sde_event_datetime
                               FROM sales.sale_delivery_event e
                              WHERE e.sde_bill_id = b.sb_id
                                AND e.sde_bill_acc_year = b.sb_acc_year
                                AND e.sde_kind = 'GIVEN'
                                AND e.sde_is_deleted = false
                                AND NOT EXISTS (SELECT 1 FROM sales.sale_delivery_event x
                                                 WHERE x.sde_reverses_id = e.sde_id
                                                   AND x.sde_kind = 'CANCEL')
                              ORDER BY e.sde_event_datetime DESC, e.sde_created_on DESC
                              LIMIT 1) lg ON true
        UNION ALL
        SELECT 'DC', 1, array_position(${dcIds}::uuid[], d.sdc_id),
               d.sdc_id, d.sdc_acc_year, d.sdc_dc_refno, d.sdc_dc_date,
               COALESCE(c.cus_name, d.sdc_cust_name), c.cus_area_id, d.sdc_salesman_id,
               'DC', NULL, dl.godown_names, dl.open_lines, dl.open_pkgs, dl.open_kg,
               NULL, NULL,
               CASE WHEN dl.billed_pkgs > 0 THEN 'DC PART-BILLED' ELSE 'DC OPEN' END
                 || ' · open ' || trim_scale(dl.open_pkgs) || ' of ' || trim_scale(dl.total_pkgs)
          FROM dl
          JOIN sales.sale_dc d ON d.sdc_id = dl.sdc_id AND d.sdc_acc_year = dl.sdc_acc_year
          LEFT JOIN sales.customers c ON c.cus_id = d.sdc_cust_id
      )
      SELECT r.row_kind, r.doc_id, r.doc_acc_year, r.doc_refno, r.doc_date::text AS doc_date,
             ((now() AT TIME ZONE 'Asia/Kolkata')::date - r.doc_date)::int AS days_old,
             r.cust_name, a.arm_name AS area_name, ct.ctm_name AS city_name,
             (SELECT string_agg(em.emp_name, ', ' ORDER BY em.emp_name) FROM public.employee_master em
               WHERE em.emp_id = ANY(r.salesman_ids)) AS salesman_names,
             r.delivery_mode, r.delivery_status, r.godown_names, r.open_lines::int AS open_lines,
             round(r.open_pkgs, 3) AS open_pkgs, round(COALESCE(r.open_kg, 0), 3) AS open_kg,
             r.last_given_refno, r.last_given_at, r.dc_note
        FROM r
        LEFT JOIN sales.area_master a ON a.arm_id = r.area_uuid
        LEFT JOIN sales.city_master ct ON ct.ctm_id = a.arm_city_id
       ORDER BY r.kind_sort, r.pos`;
  }
}

// ── the providers ───────────────────────────────────────────────────────────────

@Injectable()
export class GatePassHeadProvider implements PrintDataProvider {
  readonly code = 'sales.delivery_note.head';
  readonly label = 'Gate pass / Delivery Note — heading, crew, QR, totals, came back';
  readonly cardinality = 'one' as const;
  constructor(private readonly source: DeliveryPrintSource) {}
  async resolve(request: ProviderRequest): Promise<PrintRow> {
    return (await this.source.gatePass(request, this.code)).head;
  }
}

@Injectable()
export class GatePassLinesProvider implements PrintDataProvider {
  readonly code = 'sales.delivery_note.lines';
  readonly label = 'Gate pass / Delivery Note — the lines given (no prices)';
  readonly cardinality = 'many' as const;
  constructor(private readonly source: DeliveryPrintSource) {}
  async resolve(request: ProviderRequest): Promise<PrintRow[]> {
    return (await this.source.gatePass(request, this.code)).lines.slice(0, request.rowLimit);
  }
}

@Injectable()
export class GatePassStillProvider implements PrintDataProvider {
  readonly code = 'sales.delivery_note.still_to_come';
  readonly label = 'Gate pass — still to come on the same bills (every godown)';
  readonly cardinality = 'many' as const;
  constructor(private readonly source: DeliveryPrintSource) {}
  async resolve(request: ProviderRequest): Promise<PrintRow[]> {
    return (await this.source.gatePass(request, this.code)).still.slice(0, request.rowLimit);
  }
}

@Injectable()
export class GodownSlipHeadProvider implements PrintDataProvider {
  readonly code = 'sales.bill.godown_slip.head';
  readonly label = 'Godown slip — the bill, customer, godown and the bill QR (no prices)';
  readonly cardinality = 'one' as const;
  constructor(private readonly source: DeliveryPrintSource) {}
  async resolve(request: ProviderRequest): Promise<PrintRow> {
    return (await this.source.godownSlip(request, this.code)).head;
  }
}

@Injectable()
export class GodownSlipLinesProvider implements PrintDataProvider {
  readonly code = 'sales.bill.godown_slip.lines';
  readonly label = 'Godown slip — the bill lines still to give from the godown';
  readonly cardinality = 'many' as const;
  constructor(private readonly source: DeliveryPrintSource) {}
  async resolve(request: ProviderRequest): Promise<PrintRow[]> {
    return (await this.source.godownSlip(request, this.code)).lines.slice(0, request.rowLimit);
  }
}

@Injectable()
export class BillDeliveryProvider implements PrintDataProvider {
  readonly code = 'sales.bill.delivery';
  readonly label = 'Sale bill — delivery mode and the "Godown scan" QR (Pickup / Dispatch only)';
  readonly cardinality = 'one' as const;
  constructor(private readonly source: DeliveryPrintSource) {}
  resolve(request: ProviderRequest): Promise<PrintRow> {
    return this.source.billDelivery(request, this.code);
  }
}

@Injectable()
export class PickListHeadProvider implements PrintDataProvider {
  readonly code = 'sales.delivery.pick_list.head';
  readonly label = 'Pick list — heading and totals of the ticked bills';
  readonly cardinality = 'one' as const;
  constructor(private readonly source: DeliveryPrintSource) {}
  async resolve(request: ProviderRequest): Promise<PrintRow> {
    return (await this.source.pickList(request)).head;
  }
}

@Injectable()
export class PickListLinesProvider implements PrintDataProvider {
  readonly code = 'sales.delivery.pick_list.lines';
  readonly label = 'Pick list — open lines by godown, then item, with sums';
  readonly cardinality = 'many' as const;
  constructor(private readonly source: DeliveryPrintSource) {}
  async resolve(request: ProviderRequest): Promise<PrintRow[]> {
    return (await this.source.pickList(request)).lines.slice(0, request.rowLimit);
  }
}

@Injectable()
export class PendingListHeadProvider implements PrintDataProvider {
  readonly code = 'sales.delivery.pending.head';
  readonly label = 'Pending deliveries — heading and totals of the bills listed';
  readonly cardinality = 'one' as const;
  constructor(private readonly source: DeliveryPrintSource) {}
  async resolve(request: ProviderRequest): Promise<PrintRow> {
    return (await this.source.pendingList(request)).head;
  }
}

@Injectable()
export class PendingListRowsProvider implements PrintDataProvider {
  readonly code = 'sales.delivery.pending.rows';
  readonly label = 'Pending deliveries — one row per bill (then challan), as the screen lists them';
  readonly cardinality = 'many' as const;
  constructor(private readonly source: DeliveryPrintSource) {}
  async resolve(request: ProviderRequest): Promise<PrintRow[]> {
    return (await this.source.pendingList(request)).rows.slice(0, request.rowLimit);
  }
}

/** For print-render.module.ts's explicit registry (the source is a helper, not a provider). */
export const DELIVERY_PRINT_PROVIDERS = [
  GatePassHeadProvider,
  GatePassLinesProvider,
  GatePassStillProvider,
  GodownSlipHeadProvider,
  GodownSlipLinesProvider,
  BillDeliveryProvider,
  PickListHeadProvider,
  PickListLinesProvider,
  PendingListHeadProvider,
  PendingListRowsProvider,
] as const;
