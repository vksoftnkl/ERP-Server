import { Prisma } from '@prisma/client';
import {
  appendTxnStatusLog,
  TxnStatusDocType,
  TxnStatusEvent,
  TxnStatusSrcModule,
} from 'src/common/txn-status-log/txn-status-log.helper';
import type { StockPostingService } from 'src/modules/stocks/posting/stock-posting.service';
import { StockVoucherSource } from 'src/modules/stocks/posting/stock-voucher.source';
import { nextStockVoucherSlno, resolveDeviceCode } from 'src/modules/stocks/stock-voucher/stock-voucher-numbering.helper';
import type { StockVoucherTypeRules } from 'src/modules/stocks/stock-voucher/types/stock-voucher.types';
import { PUR, purRefuse } from './purchase.errors';

/**
 * What every purchase document repeats (plan-purchase-backend.md §0): the
 * device-series number, the shadow stock voucher, the bill-wise row, the status
 * log. The Purchase Invoice keeps its own (tested first) copy; GRN, PO, return
 * and shortage receipt use these.
 */

export type Tx = Prisma.TransactionClient;
export const D = (v: Prisma.Decimal.Value | null | undefined) => new Prisma.Decimal(v ?? 0);
export const ZERO = D(0);
export const r2 = (v: Prisma.Decimal) => v.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
export const num2 = (v: Prisma.Decimal) => Number(v.toFixed(2));
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
export const dateOf = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`) : null);
export const SRC_MODULE = 'PURCHASE';

/** The tables a purchase number is counted in — identifiers are fixed here, never from input. */
const NUMBER_TABLES = {
  PO: { table: 'purchase.pur_order', p: 'po' },
  GRN: { table: 'purchase.pur_grn', p: 'grn' },
  PRN: { table: 'purchase.pur_return', p: 'pr' },
  SHR: { table: 'purchase.pur_shortage_receipt', p: 'psr' },
} as const;
export type NumberKind = keyof typeof NUMBER_TABLES;

/** `PO/2026-2027/D14/00001` — per device, under an advisory lock (offline-safe; R1 / D8). */
export async function allocateDocNumber(tx: Tx, kind: NumberKind, companyId: string, branchId: string, accYear: string, deviceId: string) {
  const { table, p } = NUMBER_TABLES[kind];
  const devCode = await resolveDeviceCode(tx, deviceId);
  const lockKey = [kind, companyId, branchId, accYear, deviceId].join('|');
  await tx.$queryRaw`SELECT count(pg_advisory_xact_lock(hashtext('purchase_doc_no'), hashtext(${lockKey})))::int AS locked`;
  const [r] = await tx.$queryRaw<{ n: bigint }[]>(Prisma.sql`
    SELECT COALESCE(MAX(${Prisma.raw(`${p}_slno`)}), 0) + 1 AS n FROM ${Prisma.raw(table)}
     WHERE ${Prisma.raw(`${p}_company_id`)} = ${companyId}::uuid AND ${Prisma.raw(`${p}_branch_id`)} = ${branchId}::uuid
       AND ${Prisma.raw(`${p}_acc_year`)} = ${accYear}::bpchar AND ${Prisma.raw(`${p}_device_id`)} = ${deviceId}::uuid`);
  const slno = BigInt(r.n);
  return { slno, refno: [kind, accYear.trim(), devCode, slno.toString().padStart(5, '0')].join('/') };
}

export interface UnitRow { iuc_id: string; iuc_item_id: string; iuc_to_base_factor: Prisma.Decimal; base_iuc_id: string; item_default_tax_id: string | null; item_hsn_code: string | null; item_name: string | null }

export async function loadUnits(tx: Tx, uomIds: string[]): Promise<Map<string, UnitRow>> {
  const ids = [...new Set(uomIds)];
  const rows = ids.length
    ? await tx.$queryRaw<UnitRow[]>`
        SELECT iuc.iuc_id, iuc.iuc_item_id, iuc.iuc_to_base_factor, COALESCE(base.iuc_id, iuc.iuc_id) AS base_iuc_id,
               im.item_default_tax_id, im.item_hsn_code, im.item_name_en AS item_name
          FROM inventory.item_unit_conversion iuc
          JOIN inventory.item_master im ON im.item_id = iuc.iuc_item_id
          LEFT JOIN LATERAL (SELECT b.iuc_id FROM inventory.item_unit_conversion b
                              WHERE b.iuc_item_id = iuc.iuc_item_id AND b.iuc_is_base_unit AND NOT b.iuc_is_deleted
                              ORDER BY b.iuc_unit_slno LIMIT 1) base ON true
         WHERE iuc.iuc_id = ANY(${ids}::uuid[]) AND NOT iuc.iuc_is_deleted`
    : [];
  return new Map(rows.map((r) => [r.iuc_id, r]));
}

export async function loadTaxRates(tx: Tx, taxIds: (string | null | undefined)[]) {
  const ids = [...new Set(taxIds.filter((t): t is string => !!t))];
  const rows = ids.length
    ? await tx.$queryRaw<{ tax_id: string; tax_rate_perc: Prisma.Decimal; tax_cess_perc: Prisma.Decimal | null; tax_cess_per_unit: Prisma.Decimal | null }[]>`
        SELECT tax_id, tax_rate_perc, tax_cess_perc, tax_cess_per_unit FROM inventory.tax_rate_master WHERE tax_id = ANY(${ids}::uuid[])`
    : [];
  return new Map(rows.map((t) => [t.tax_id, t]));
}

export async function supplierRow(tx: Tx, supplierId: string) {
  const [s] = await tx.$queryRaw<{ sup_id: string; sup_name: string; sup_state_code: string | null; sup_gst_type: string | null; sup_gst_no: string | null; sup_credit_days: number | null }[]>`
    SELECT sup_id, sup_name, sup_state_code, sup_gst_type, sup_gst_no, sup_credit_days FROM purchase.suppliers WHERE sup_id = ${supplierId}::uuid AND NOT sup_is_deleted`;
  if (!s) purRefuse(`Supplier ${supplierId} not found`, PUR.SUPPLIER_NOT_FOUND, 'header.supplierId', 404);
  return s;
}

export async function isInterState(tx: Tx, branchId: string, supplier: { sup_state_code: string | null; sup_gst_no: string | null }) {
  const [b] = await tx.$queryRaw<{ state: string | null }[]>`
    SELECT COALESCE(NULLIF(trim(b.br_state_code), ''), NULLIF(trim(c.comp_state_code), '')) AS state
      FROM public.branch_master b JOIN public.companys c ON c.comp_id = b.br_comp_id WHERE b.br_id = ${branchId}::uuid`;
  const ours = (b?.state ?? '').trim();
  const theirs = (supplier.sup_state_code ?? '').trim() || (supplier.sup_gst_no ?? '').slice(0, 2);
  return !!ours && !!theirs && ours !== theirs;
}

export async function voucherTypeId(tx: Tx, code: 'GRN' | 'PUR' | 'PRN' | 'SHR' | 'PCL'): Promise<number> {
  const [vt] = await tx.$queryRaw<{ id: number }[]>`SELECT vchr_type_id AS id FROM accounts.acc_voucher_types WHERE vchr_type_code = ${code} AND vchr_is_active LIMIT 1`;
  if (!vt) purRefuse(`Voucher type ${code} is missing (migration 20261028100000).`, PUR.VOUCHER_TYPE_MISSING);
  return vt.id;
}

// ── the shadow stock voucher ───────────────────────────────────────────────
export interface StockRow {
  itemId: string; uomId: string; baseUomId: string; factor: Prisma.Decimal;
  godownId: string; bucket: string; lotId?: string | null;
  batchNo?: string | null; mfgDate?: Date | null; expiryDate?: Date | null; mrp?: Prisma.Decimal | null; salePrice?: Prisma.Decimal | null;
  serialNo?: string | null; supplierId?: string | null;
  qty: Prisma.Decimal; freeQty: Prisma.Decimal;
  /** per BASE unit, without recoverable GST. 0 on an ISSUE = the engine prices from the lot. */
  costRate: Prisma.Decimal;
}

export function stockRules(direction: 'IN' | 'OUT', typeCode: string, display: string, txnType: string, statusDocType: TxnStatusDocType): StockVoucherTypeRules {
  const inward = direction === 'IN';
  return {
    voucherType: inward ? 'RECEIPT' : 'ISSUE', typeCode, displayName: display,
    requiresToGodown: inward, requiresFromGodown: !inward, isInward: inward, ledgerTxnTypes: [txnType],
    quantityMode: 'QTY', defaultRateSource: inward ? 'MANUAL' : 'AVG_COST', allowsCount: false, allowsToBranch: false,
    postShape: 'SIMPLE', auditScreenName: display, statusDocType,
  } as StockVoucherTypeRules;
}

/** Writes + posts the shadow voucher; returns its id and, per row (same order), the lot, svi and the cost the engine settled. */
export async function postShadowStock(
  tx: Tx, stockPosting: StockPostingService,
  doc: { companyId: string; branchId: string; accYear: string; deviceId: string; sessionId: string | null; docType: string; docId: string;
         refno: string; revision: number; usrRefno: string | null; docDate: string; supplierId: string | null; remarks: string },
  rules: StockVoucherTypeRules, rows: StockRow[], actor: string, postedOn: Date,
) {
  const live = rows.filter((r) => r.qty.plus(r.freeQty).greaterThan(0));
  if (!live.length) return { svhId: null as string | null, perRow: [] as { lotId: string | null; sviId: string; cost: Prisma.Decimal }[] };
  const inward = rules.isInward;
  const slno = await nextStockVoucherSlno(tx, { companyId: doc.companyId, branchId: doc.branchId, accYear: doc.accYear, voucherType: rules.voucherType, deviceId: doc.deviceId });
  const total = live.reduce((s, r) => s.plus(r.qty).plus(r.freeQty), ZERO);
  const godown = live[0].godownId;
  const [hdr] = await tx.$queryRaw<{ svh_id: string }[]>`
    INSERT INTO stock.stock_voucher (
      svh_company_id, svh_branch_id, svh_acc_year, svh_device_id, svh_session_id,
      svh_voucher_type, svh_slno, svh_refno, svh_usr_refno, svh_doc_date, svh_doc_datetime,
      svh_from_godown_id, svh_to_godown_id, svh_supplier_id, svh_party_ref,
      svh_link_src_module, svh_link_src_doc_type, svh_link_src_doc_id, svh_link_src_acc_year,
      svh_line_count, svh_total_qty, svh_status, svh_rate_source, svh_remarks, svh_created_on, svh_created_by)
    VALUES (${doc.companyId}::uuid, ${doc.branchId}::uuid, ${doc.accYear}::bpchar, ${doc.deviceId}::uuid, ${doc.sessionId}::uuid,
      ${rules.voucherType}, ${slno}::bigint, ${`${doc.docType}/${doc.refno}/r${doc.revision}`}, ${doc.usrRefno}, ${doc.docDate}::date, ${postedOn},
      ${inward ? null : godown}::uuid, ${inward ? godown : null}::uuid, ${doc.supplierId}::uuid, ${doc.supplierId},
      ${SRC_MODULE}, ${doc.docType}, ${doc.docId}::uuid, ${doc.accYear}::bpchar,
      ${live.length}::int, ${total}::numeric, 'DRAFT', ${inward ? 'MANUAL' : 'AVG_COST'}, ${doc.remarks}, ${postedOn}, ${actor})
    RETURNING svh_id`;
  const values = live.map((r, k) => Prisma.sql`(
    ${hdr.svh_id}::uuid, ${doc.companyId}::uuid, ${doc.branchId}::uuid, ${doc.accYear}::bpchar, ${k + 1}::int, 1,
    ${r.itemId}::uuid, ${r.uomId}::uuid, ${r.baseUomId}::uuid, ${r.factor}::numeric,
    ${r.godownId}::uuid, ${r.lotId ?? null}::uuid, ${r.bucket}, ${r.batchNo ?? null}, ${r.mfgDate ?? null}::date, ${r.expiryDate ?? null}::date,
    ${r.mrp ?? null}::numeric, ${r.salePrice ?? null}::numeric, ${r.serialNo ?? null}, ${r.supplierId ?? null}::uuid,
    ${r.qty}::numeric, ${r.qty.times(r.factor)}::numeric, ${r.freeQty}::numeric, ${r.freeQty.times(r.factor)}::numeric,
    ${r.costRate}::numeric, ${r.costRate}::numeric, ${r.costRate}::numeric, 0::numeric, ${postedOn}, ${actor})`);
  await tx.$executeRaw`
    INSERT INTO stock.stock_voucher_item (
      svi_voucher_id, svi_company_id, svi_branch_id, svi_acc_year, svi_line_no, svi_split_no,
      svi_item_id, svi_uom_id, svi_base_uom_id, svi_to_base_factor,
      svi_godown_id, svi_lot_id, svi_bucket, svi_batch_no, svi_mfg_date, svi_expiry_date,
      svi_mrp, svi_sale_price, svi_serial_no, svi_supplier_id,
      svi_qty, svi_base_qty, svi_free_qty, svi_free_base_qty,
      svi_cost_rate, svi_cost_rate_wot, svi_landed_rate, svi_tax_perc, svi_created_on, svi_created_by) VALUES ${Prisma.join(values)}`;
  await stockPosting.post(
    tx,
    new StockVoucherSource({ svhId: hdr.svh_id, accYear: doc.accYear, companyId: doc.companyId, branchId: doc.branchId, rules }),
    { actor, postedOn, ledgerSource: { srcModule: SRC_MODULE, srcDocType: doc.docType, srcRefno: doc.refno, partyId: doc.supplierId } },
  );
  const back = await tx.$queryRaw<{ svi_line_no: number; svi_lot_id: string | null; svi_id: string; cost: Prisma.Decimal | null; qty: Prisma.Decimal | null }[]>`
    SELECT svi.svi_line_no, svi.svi_lot_id, svi.svi_id, SUM(sml.sml_cost_value) AS cost, SUM(sml.sml_qty + sml.sml_free_qty) AS qty
      FROM stock.stock_voucher_item svi
      LEFT JOIN stock.stock_ledger sml ON sml.sml_src_doc_id = svi.svi_voucher_id AND sml.sml_acc_year = svi.svi_acc_year
           AND sml.sml_line_no = svi.svi_line_no AND sml.sml_split_no = svi.svi_split_no AND NOT sml.sml_is_reversal AND NOT sml.sml_is_deleted
     WHERE svi.svi_voucher_id = ${hdr.svh_id}::uuid AND svi.svi_acc_year = ${doc.accYear}::bpchar
     GROUP BY svi.svi_line_no, svi.svi_lot_id, svi.svi_id ORDER BY svi.svi_line_no`;
  const moved = back.reduce((s, b) => s.plus(D(b.qty)), ZERO);
  if (!moved.toDecimalPlaces(4).equals(total.toDecimalPlaces(4))) {
    throw new Error(`${PUR.STOCK_QTY_MISMATCH}: ${doc.refno} moved ${moved.toString()} against ${total.toString()}`);
  }
  // map back to the caller's rows (zero rows were skipped)
  const perRow: { lotId: string | null; sviId: string; cost: Prisma.Decimal }[] = [];
  let k = 0;
  for (const r of rows) {
    if (!r.qty.plus(r.freeQty).greaterThan(0)) { perRow.push({ lotId: null, sviId: '', cost: ZERO }); continue; }
    const b = back[k++];
    perRow.push({ lotId: b?.svi_lot_id ?? null, sviId: b?.svi_id ?? '', cost: r2(D(b?.cost)) });
  }
  return { svhId: hdr.svh_id as string | null, perRow };
}

export async function cancelShadowStock(tx: Tx, stockPosting: StockPostingService, docType: string, docId: string, accYear: string,
                                        companyId: string, branchId: string, rules: StockVoucherTypeRules, actor: string, reason: string) {
  const shadows = await tx.$queryRaw<{ svh_id: string }[]>`
    SELECT svh_id FROM stock.stock_voucher WHERE svh_link_src_module = ${SRC_MODULE} AND svh_link_src_doc_type = ${docType}
       AND svh_link_src_doc_id = ${docId}::uuid AND svh_acc_year = ${accYear}::bpchar AND svh_status = 'POSTED' AND NOT svh_is_deleted`;
  for (const s of shadows) {
    await stockPosting.cancel(tx, new StockVoucherSource({ svhId: s.svh_id, accYear, companyId, branchId, rules }), { actor, reason, cancelledOn: new Date() });
  }
}

// ── bill-wise ──────────────────────────────────────────────────────────────
export async function raiseBillRow(tx: Tx, a: {
  companyId: string; branchId: string; accYear: string; partyId: string; billType: string; drCr: 'DR' | 'CR'; amount: Prisma.Decimal;
  docType: string; docId: string; voucherId: string; voucherTypeId: number; voucherNo: bigint; voucherDate: string; refno: string; refSuffix?: string | null;
  docDate: Date; dueDate?: Date | null; creditDays?: number | null; narration: string; actor: string;
}) {
  if (!a.amount.greaterThan(0)) return;
  await tx.accBillBalance.create({
    data: {
      ablCompanyId: a.companyId, ablBranchId: a.branchId, ablAccYear: a.accYear, ablPartyId: a.partyId, ablBillType: a.billType,
      ablSrcModule: SRC_MODULE, ablSrcDocType: a.docType, ablSrcDocId: a.docId, ablSrcAccYear: a.accYear,
      ablVoucherId: a.voucherId, ablVoucherTypeId: a.voucherTypeId, ablVoucherNo: a.voucherNo, ablVoucherDate: dateOf(a.voucherDate)!,
      ablVoucherRefno: a.refno, ablDocRefno: a.refSuffix ? `${a.refno}/${a.refSuffix}` : a.refno, ablDocDate: a.docDate,
      ablDueDate: a.dueDate ?? null, ablCreditDays: a.creditDays ?? 0, ablDrCr: a.drCr, ablBillAmount: r2(a.amount),
      ablNarration: a.narration, ablCreatedBy: a.actor,
    },
  });
}

export async function assertBillsUnsettled(tx: Tx, docType: string, docId: string, refno: string) {
  const [paid] = await tx.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM accounts.acc_bill_balance WHERE abl_src_module = ${SRC_MODULE} AND abl_src_doc_type = ${docType}
       AND abl_src_doc_id = ${docId}::uuid AND NOT abl_is_deleted AND (abl_alloc_amount + abl_disc_amount + abl_writeoff_amount) <> 0`;
  if (Number(paid.n) > 0) purRefuse(`${refno} is already paid or adjusted — undo that first.`, PUR.EDIT_LOCKED_PAID, 'id', 409);
}

export async function withdrawBillRows(tx: Tx, docType: string, docId: string, actor: string) {
  await tx.accBillBalance.updateMany({
    where: { ablSrcModule: SRC_MODULE, ablSrcDocType: docType, ablSrcDocId: docId, ablIsDeleted: false },
    data: { ablIsDeleted: true, ablModifiedBy: actor },
  });
}

export async function statusLog(tx: Tx, a: { companyId: string; branchId: string; accYear: string; docType: TxnStatusDocType; docId: string; refno: string;
                                              event: TxnStatusEvent; from: string | null; to: string; actor: string; deviceId?: string | null; remarks?: string | null }) {
  await appendTxnStatusLog(tx, {
    companyId: a.companyId, branchId: a.branchId, accYear: a.accYear, srcModule: TxnStatusSrcModule.PURCHASE, srcDocType: a.docType,
    srcDocId: a.docId, srcDocRefno: a.refno, event: a.event, fromStatus: a.from, toStatus: a.to, changedBy: a.actor,
    deviceId: a.deviceId ?? null, remarks: a.remarks ?? null,
  });
}

/** BigInt → string, recursively (JSON cannot carry a BigInt). */
export function jsonSafe<T>(v: T): T {
  if (typeof v === 'bigint') return v.toString() as unknown as T;
  if (Array.isArray(v)) return v.map((x) => jsonSafe(x)) as unknown as T;
  if (v && typeof v === 'object' && !(v instanceof Date) && !(v instanceof Prisma.Decimal)) {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = jsonSafe(x);
    return out as T;
  }
  return v;
}

export { TxnStatusDocType, TxnStatusEvent };
