import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../database/prisma/prisma.service';
import { loadRights, NO_RIGHTS } from '../../../../../common/posting/rights';
import { SALES_MENU_ID, supplyNatureOf } from '../../../../sales/posting/sales-doc.utils';
import { PrintDataProvider, PrintRow, ProviderRequest } from '../print-data-provider.types';
import { requireDocument } from './provider.utils';
import { countText, decOf, istText, numOf, qtyText, RenderMemo, UUID } from './print-text.utils';

/**
 * Sales DC P5 (plan sales/plan-dc-dc-return-2026-11-16.md §10, decisions 7 / 41,
 * Q-N5): the datasets of the two challan prints.
 *
 *   DELIVERY_CHALLAN  sales.dc.header (one) / sales.dc.items
 *                     docId = sdc_id, accYear = sdc_acc_year. VIEW + PRINT on menu 182.
 *   DC_RETURN         sales.dcr.header (one) / sales.dcr.items
 *                     docId = sdr_id, accYear = sdr_acc_year. VIEW + PRINT on menu 251.
 *
 * Read from the document's own snapshot columns, partition key included, as the
 * sale bill's providers do (sale-bill-header.provider.ts): a reprint shows the
 * customer and the money the challan was raised with. The return's address and
 * purpose are its challan's (the return stores no address). One read per render
 * (RenderMemo): the header's totals are the lines' own sums.
 *
 * Money is a number (the design formats it); quantities and kg are a number AND a
 * `*_text` without trailing zeros. Dates print dd-MM-yyyy and times IST 12-hour,
 * as the Tax Invoice A5 prints them. A free line carries rate 0 and `free_mark`
 * 'FREE' (its description ends "(FREE)"), never a blank. A refusal (rights, a
 * document not found) is thrown as an Error whose message the render returns
 * (PRINT_RENDER_PROVIDER_FAILED).
 */

type Tx = Prisma.TransactionClient;
type Num = Prisma.Decimal | string | number | null | undefined;
const Z = new Prisma.Decimal(0);

/** A money / rate figure for the engine: 0 when absent, never null. */
const money = (v: Num): number => numOf(decOf(v)) ?? 0;

/** 'YYYY-MM-DD' of a DATE column (Prisma hands it back as UTC midnight). */
function isoDay(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const iso = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

/** dd-MM-yyyy (the Tax Invoice A5's date), '' when empty. */
export function dashDate(value: Date | string | null | undefined): string {
  const iso = isoDay(value);
  return iso ? `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}` : '';
}

/** An instant as dd-MM-yyyy hh:mm AM IST (the invoice's printed_at). */
export function dashInstant(at: Date | string | null | undefined): string {
  return istText(at).replace(/\//g, '-');
}

const blank = (v: string | null | undefined): string => (v ?? '').trim();

/** SUPPLY → Supply, JOB_WORK → Job Work (dropdown 57's names). */
export function purposeText(purpose: string | null | undefined): string {
  return blank(purpose)
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

const CONDITION_TEXT: Record<string, string> = {
  RESTOCK: 'Restock',
  DAMAGED: 'Damaged',
  EXPIRED: 'Expired',
  SCRAP: 'Scrap',
};

const BUCKET_TEXT: Record<string, string> = {
  SALEABLE: 'Saleable',
  DAMAGED: 'Damaged',
  EXPIRED: 'Expired',
  QUARANTINE: 'Quarantine',
};

const MODE_TEXT: Record<string, string> = {
  ROAD: 'By road',
  RAIL: 'By rail',
  AIR: 'By air',
  SHIP: 'By ship',
};

/** "Tamil Nadu (33)" from a name and a code; whichever is there. */
function stateText(name: string | null | undefined, code: string | null | undefined): string {
  const n = blank(name);
  const c = blank(code);
  return n && c ? `${n} (${c})` : n || (c ? `(${c})` : '');
}

/** The company block and the branch, as every challan print heads them. */
export interface CompanyCols {
  comp_name: string | null;
  comp_legal_name: string | null;
  comp_addr1: string | null;
  comp_addr2: string | null;
  comp_addr3: string | null;
  comp_city: string | null;
  comp_state: string | null;
  comp_state_code: string | null;
  comp_pin: string | null;
  comp_gstin_no: string | null;
  comp_phone: string | null;
  comp_mail: string | null;
  comp_state_by_code: string | null;
  br_name: string | null;
  br_gstin_no: string | null;
}

function companyFields(h: CompanyCols): PrintRow {
  return {
    company_name: h.comp_name ?? '',
    company_legal_name: h.comp_legal_name ?? '',
    company_addr1: h.comp_addr1 ?? '',
    company_addr2: h.comp_addr2 ?? '',
    company_addr3: h.comp_addr3 ?? '',
    company_city: h.comp_city ?? '',
    company_state: h.comp_state ?? h.comp_state_by_code ?? '',
    company_state_code: blank(h.comp_state_code),
    company_pin: h.comp_pin ?? '',
    company_gstin: h.comp_gstin_no ?? '',
    company_phone: h.comp_phone ?? '',
    company_email: h.comp_mail ?? '',
    branch_name: h.br_name ?? '',
    branch_gstin: h.br_gstin_no ?? '',
  };
}

/** The crew, the vehicle, the transport band and the e-way bill: shared by both prints. */
export interface MoveCols {
  vehicle_no: string | null;
  driver_name: string | null;
  supervisor_name: string | null;
  loadman_names: string | null;
  salesman_names: string | null;
  ttd_transport_mode: string | null;
  ttd_transporter_name: string | null;
  ttd_transporter_gstin: string | null;
  ttd_lr_no: string | null;
  ttd_lr_date: Date | string | null;
  ttd_distance_km: number | null;
  gdw_no: string | null;
  gdw_status: string | null;
  gdw_generated_on: Date | null;
  gdw_valid_upto: Date | null;
}

function moveFields(h: MoveCols): PrintRow {
  const vehicle = blank(h.vehicle_no);
  const driver = blank(h.driver_name);
  const transporter = blank(h.ttd_transporter_name);
  const tGstin = blank(h.ttd_transporter_gstin);
  const lr = blank(h.ttd_lr_no);
  const lrDate = dashDate(h.ttd_lr_date);
  const mode = blank(h.ttd_transport_mode).toUpperCase();
  const km =
    h.ttd_distance_km !== null && h.ttd_distance_km !== undefined && Number(h.ttd_distance_km) > 0
      ? Number(h.ttd_distance_km)
      : null;
  const transport = [
    vehicle ? `Vehicle ${vehicle}` : null,
    driver ? `Driver ${driver}` : null,
    mode ? (MODE_TEXT[mode] ?? purposeText(mode)) : null,
    transporter ? `Transporter ${transporter}${tGstin ? ` (${tGstin})` : ''}` : null,
    lr ? `LR ${lr}${lrDate ? ` dt ${lrDate}` : ''}` : null,
    km !== null ? `${km} km` : null,
  ].filter(Boolean);
  const loadmen = blank(h.loadman_names);
  const supervisor = blank(h.supervisor_name);
  const crew = [
    loadmen ? `Loadmen: ${loadmen}` : null,
    supervisor ? `Supervisor: ${supervisor}` : null,
  ].filter(Boolean);
  const ewb = blank(h.gdw_no);
  const ewbDate = h.gdw_generated_on ? dashInstant(h.gdw_generated_on).slice(0, 10) : '';
  return {
    vehicle_no: vehicle,
    driver_name: driver,
    supervisor_name: supervisor,
    loadman_names: loadmen,
    salesman_names: blank(h.salesman_names),
    crew_text: crew.join(' · '),
    transport_mode: mode,
    transporter_name: transporter,
    transporter_gstin: tGstin,
    lr_no: lr,
    lr_date_text: lrDate,
    distance_km: km,
    transport_text: transport.length > 0 ? transport.join(' · ') : '-',
    ewb_no: ewb,
    ewb_status: ewb ? blank(h.gdw_status) : '',
    ewb_date_text: ewb ? ewbDate : '',
    ewb_valid_text: ewb && h.gdw_valid_upto ? `valid till ${dashInstant(h.gdw_valid_upto)}` : '',
    ewb_text: ewb ? `${ewb}${ewbDate ? ` dt ${ewbDate}` : ''}` : '',
  };
}

function statusMark(status: string | null | undefined): string {
  const s = blank(status).toUpperCase();
  return s === 'DRAFT' ? 'DRAFT' : s === 'CANCELLED' ? 'CANCELLED' : '';
}

/** "Prepared by VKPOS · printed …" footer line pieces. */
export interface PrintFacts {
  preparedBy: string | null;
  printedBy: string | null;
  at: Date;
}

function printFields(f: PrintFacts, printCount: number): PrintRow {
  const printedAt = dashInstant(f.at);
  return {
    print_count: printCount,
    is_reprint: printCount > 0,
    reprint_mark:
      printCount > 0
        ? `REPRINT (printed ${printCount} time${printCount === 1 ? '' : 's'} before)`
        : '',
    prepared_by: f.preparedBy ?? '',
    prepared_line: f.preparedBy ? `Prepared by ${f.preparedBy}` : '',
    printed_at: printedAt,
    printed_by: f.printedBy ?? '',
    printed_line: [`Printed ${printedAt}`, f.printedBy].filter(Boolean).join(' · '),
  };
}

// ── the challan ─────────────────────────────────────────────────────────────────

export interface DcHeadDb extends CompanyCols, MoveCols {
  sdc_id: string;
  sdc_acc_year: string;
  sdc_branch_id: string;
  sdc_dc_refno: string | null;
  sdc_dc_date: Date | string | null;
  sdc_purpose: string | null;
  sdc_status: string;
  sdc_print_count: number | null;
  sdc_src_doc_type: string | null;
  sdc_src_doc_refno: string | null;
  sdc_src_doc_date: Date | string | null;
  sdc_usr_refno: string | null;
  sdc_usr_refdate: Date | string | null;
  sdc_cust_name: string | null;
  sdc_cust_addr: string | null;
  sdc_cust_place: string | null;
  sdc_cust_pin: string | null;
  sdc_cust_phone: string | null;
  sdc_cust_gstin: string | null;
  sdc_cust_gst_type: string | null;
  sdc_cust_stcd: string | null;
  sdc_pos_stcd: string | null;
  sdc_state_name: string | null;
  cust_state_by_code: string | null;
  pos_state_name: string | null;
  sdc_gross_amt: Num;
  sdc_disc_amt: Num;
  sdc_taxable_amt: Num;
  sdc_cgst_amt: Num;
  sdc_sgst_amt: Num;
  sdc_igst_amt: Num;
  sdc_cess_amt: Num;
  sdc_tax_amt: Num;
  sdc_round_off: Num;
  sdc_dc_amt: Num;
  sdc_remarks: string | null;
  sdc_created_by: string | null;
  ttd_to_name: string | null;
  ttd_to_addr: string | null;
  ttd_to_place: string | null;
  ttd_to_pin: string | null;
  ttd_to_godown_name: string | null;
}

export interface DcLineDb {
  sdi_line_no: number;
  sdi_split_no: number | null;
  sdi_item_id: string;
  item_code: string | null;
  item_name_en: string | null;
  item_name_ta: string | null;
  hsn_code: string | null;
  sdi_batch_no: string | null;
  lot_no: string | null;
  godown_name: string | null;
  unit_name: string | null;
  unit_code: string | null;
  unit_kg: Num;
  sdi_dc_qty: Num;
  sdi_free_qty: Num;
  sdi_weight_qty: Num;
  sdi_is_free: boolean | null;
  sdi_free_type: string | null;
  sdi_src_doc_type: string | null;
  sdi_src_doc_refno: string | null;
  sdi_rate: Num;
  sdi_rate_pre_tax: Num;
  sdi_disc_amt: Num;
  sdi_gross_amt: Num;
  sdi_taxable_amt: Num;
  sdi_tax_perc: Num;
  sdi_cgst_perc: Num;
  sdi_cgst_amt: Num;
  sdi_sgst_perc: Num;
  sdi_sgst_amt: Num;
  sdi_igst_perc: Num;
  sdi_igst_amt: Num;
  sdi_cess_perc: Num;
  sdi_cess_amt: Num;
  sdi_tax_amt: Num;
  sdi_net_amt: Num;
  sdi_remarks: string | null;
}

/** Kg of a line: its stored weight, else (qty + free) × the unit's kg (as the challan's /validate totals). */
function lineKg(weight: Num, pkgs: Prisma.Decimal, unitKg: Num): Prisma.Decimal {
  const w = decOf(weight);
  return w.greaterThan(0) ? w : pkgs.times(decOf(unitKg));
}

function itemName(en: string | null, ta: string | null, tamil: boolean): string {
  return (tamil ? blank(ta) || blank(en) : blank(en)) || '';
}

/** The challan's lines as printed. Exported for the spec. */
export function dcLineRows(lines: readonly DcLineDb[], tamil = false): PrintRow[] {
  return lines.map((l, i) => {
    const qty = decOf(l.sdi_dc_qty);
    const free = decOf(l.sdi_free_qty);
    const pkgs = qty.plus(free);
    const kg = lineKg(l.sdi_weight_qty, pkgs, l.unit_kg);
    const isFree = l.sdi_is_free === true;
    const name = itemName(l.item_name_en, l.item_name_ta, tamil);
    const batch = blank(l.sdi_batch_no) || blank(l.lot_no);
    return {
      sl_no: i + 1,
      line_no: l.sdi_line_no,
      split_no: l.sdi_split_no ?? 1,
      item_id: l.sdi_item_id,
      item_code: l.item_code ?? '',
      item_name: name,
      hsn_code: blank(l.hsn_code),
      batch_no: blank(l.sdi_batch_no),
      lot_no: blank(l.lot_no),
      godown_name: l.godown_name ?? '',
      unit_name: l.unit_name ?? '',
      unit_code: l.unit_code ?? '',
      qty: numOf(qty),
      qty_text: qtyText(qty),
      free_qty: numOf(free),
      free_qty_text: free.isZero() ? '' : qtyText(free),
      pkgs: numOf(pkgs),
      pkgs_text: qtyText(pkgs),
      is_free: isFree,
      free_type: isFree ? blank(l.sdi_free_type) : '',
      free_mark: isFree ? 'FREE' : '',
      description:
        name +
        (batch ? ` · ${batch}` : '') +
        (free.greaterThan(0) ? ` + ${qtyText(free)} free` : '') +
        (isFree ? ' (FREE)' : ''),
      // A free line's rate IS 0 (the challan's FREE_LINE rule): printed as 0.00, never blank.
      rate: money(l.sdi_rate),
      rate_pre_tax: money(l.sdi_rate_pre_tax),
      disc_amt: money(l.sdi_disc_amt),
      gross_amt: money(l.sdi_gross_amt),
      taxable_amt: money(l.sdi_taxable_amt),
      tax_perc: money(l.sdi_tax_perc),
      cgst_perc: money(l.sdi_cgst_perc),
      cgst_amt: money(l.sdi_cgst_amt),
      sgst_perc: money(l.sdi_sgst_perc),
      sgst_amt: money(l.sdi_sgst_amt),
      igst_perc: money(l.sdi_igst_perc),
      igst_amt: money(l.sdi_igst_amt),
      cess_perc: money(l.sdi_cess_perc),
      cess_amt: money(l.sdi_cess_amt),
      tax_amt: money(l.sdi_tax_amt),
      net_amt: money(l.sdi_net_amt),
      weight_kg: numOf(kg),
      weight_text: kg.isZero() ? '' : qtyText(kg),
      remarks: l.sdi_remarks ?? '',
      // Kept for the order reference below.
      src_doc_type: l.sdi_src_doc_type ?? '',
      src_doc_refno: l.sdi_src_doc_refno ?? '',
    };
  });
}

/** Line totals shared by both heads: lines, packages, kg, free lines. */
function sums(rows: readonly PrintRow[], qtyKey: 'pkgs' | 'qty') {
  const qty = rows.reduce((a, r) => a.plus(decOf(r[qtyKey] as number)), Z);
  const kg = rows.reduce((a, r) => a.plus(decOf(r.weight_kg as number)), Z);
  const free = rows.filter((r) => r.is_free === true).length;
  return { qty, kg, free };
}

/** The challan's MASTER row. Exported for the spec. */
export function dcHeadRow(h: DcHeadDb, lines: readonly PrintRow[], f: PrintFacts): PrintRow {
  const { qty: pkgs, kg, free } = sums(lines, 'pkgs');
  const pos = blank(h.sdc_pos_stcd);
  const compCode = blank(h.comp_state_code);
  const toParts = [
    blank(h.ttd_to_name),
    blank(h.ttd_to_addr),
    [blank(h.ttd_to_place), blank(h.ttd_to_pin)].filter(Boolean).join(' '),
  ].filter(Boolean);
  const toGodown = blank(h.ttd_to_godown_name);
  const orderRefs = [
    ...new Set(
      (blank(h.sdc_src_doc_refno) && blank(h.sdc_src_doc_type) === 'SALES_ORDER'
        ? [blank(h.sdc_src_doc_refno)]
        : []
      ).concat(
        lines
          .filter((l) => l.src_doc_type === 'SALES_ORDER' && blank(l.src_doc_refno as string))
          .map((l) => blank(l.src_doc_refno as string)),
      ),
    ),
  ];
  const srcDate = dashDate(h.sdc_src_doc_date);
  const usrRef = blank(h.sdc_usr_refno);
  const usrDate = dashDate(h.sdc_usr_refdate);
  const printCount = Number(h.sdc_print_count ?? 0);
  return {
    title: 'DELIVERY CHALLAN',
    ...companyFields(h),
    dc_id: h.sdc_id,
    acc_year: blank(h.sdc_acc_year),
    refno: h.sdc_dc_refno ?? '',
    dc_date: isoDay(h.sdc_dc_date),
    dc_date_text: dashDate(h.sdc_dc_date),
    purpose: blank(h.sdc_purpose),
    purpose_text: purposeText(h.sdc_purpose),
    status: h.sdc_status,
    status_mark: statusMark(h.sdc_status),
    src_doc_type: blank(h.sdc_src_doc_type),
    src_doc_refno: blank(h.sdc_src_doc_refno),
    src_doc_date_text: srcDate,
    order_ref_text:
      orderRefs.length === 1 && srcDate && orderRefs[0] === blank(h.sdc_src_doc_refno)
        ? `${orderRefs[0]} dt ${srcDate}`
        : orderRefs.join(', '),
    usr_refno: usrRef,
    usr_refdate_text: usrDate,
    their_ref_text: usrRef ? `${usrRef}${usrDate ? ` dt ${usrDate}` : ''}` : '',
    cust_name: h.sdc_cust_name ?? '',
    cust_addr: h.sdc_cust_addr ?? '',
    cust_place: h.sdc_cust_place ?? '',
    cust_pin: h.sdc_cust_pin ?? '',
    cust_place_text: [blank(h.sdc_cust_place), blank(h.sdc_cust_pin)].filter(Boolean).join(' - '),
    cust_phone: blank(h.sdc_cust_phone),
    cust_gstin: blank(h.sdc_cust_gstin),
    cust_gst_type: blank(h.sdc_cust_gst_type),
    cust_state_code: blank(h.sdc_cust_stcd),
    cust_state_name: blank(h.sdc_state_name) || blank(h.cust_state_by_code),
    cust_state_text: stateText(blank(h.sdc_state_name) || h.cust_state_by_code, h.sdc_cust_stcd),
    pos_state_code: pos,
    pos_state_name: pos ? blank(h.pos_state_name) : '',
    // A blank place of supply is an intra-state move to the company's own state
    // (the challan's e-way rule, dcEwayStateOf): printed as that state.
    pos_text: pos
      ? stateText(h.pos_state_name, pos)
      : stateText(h.comp_state_by_code ?? h.comp_state, compCode),
    pos_from_company: !pos && !!compCode,
    // The GST pair follows the supply nature (company state vs place of supply),
    // as the challan's TAX_SPLIT check does.
    is_interstate: supplyNatureOf(compCode, pos) === 'INTER',
    ship_to_text:
      toParts.length > 0
        ? toParts.join(', ')
        : toGodown
          ? `${toGodown} godown`
          : 'Same as consignee',
    ...moveFields(h),
    lines_count: lines.length,
    pkgs: numOf(pkgs),
    pkgs_text: qtyText(pkgs),
    weight_kg: numOf(kg),
    weight_text: qtyText(kg),
    free_lines: free,
    totals_text: [
      countText(lines.length, 'line'),
      `${qtyText(pkgs)} pkgs`,
      kg.isZero() ? null : `${qtyText(kg)} kg`,
      free > 0 ? `${free} free` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    gross_amt: money(h.sdc_gross_amt),
    disc_amt: money(h.sdc_disc_amt),
    taxable_amt: money(h.sdc_taxable_amt),
    cgst_amt: money(h.sdc_cgst_amt),
    sgst_amt: money(h.sdc_sgst_amt),
    igst_amt: money(h.sdc_igst_amt),
    cess_amt: money(h.sdc_cess_amt),
    tax_amt: money(h.sdc_tax_amt),
    round_off: money(h.sdc_round_off),
    dc_amt: money(h.sdc_dc_amt),
    remarks: blank(h.sdc_remarks),
    ...printFields(f, printCount),
  };
}

// ── the challan return ──────────────────────────────────────────────────────────

export interface DcrHeadDb extends CompanyCols, MoveCols {
  sdr_id: string;
  sdr_acc_year: string;
  sdr_branch_id: string;
  sdr_return_refno: string | null;
  sdr_return_date: Date | string | null;
  sdr_status: string;
  sdr_print_count: number | null;
  sdr_dc_refno: string | null;
  sdr_dc_date: Date | string | null;
  sdr_return_reason: string | null;
  sdr_usr_refno: string | null;
  sdr_usr_refdate: Date | string | null;
  sdr_cust_name: string | null;
  sdr_cust_gstin: string | null;
  sdr_cust_stcd: string | null;
  sdr_pos_stcd: string | null;
  sdc_cust_addr: string | null;
  sdc_cust_place: string | null;
  sdc_cust_pin: string | null;
  sdc_cust_phone: string | null;
  sdc_cust_gst_type: string | null;
  sdc_state_name: string | null;
  sdc_purpose: string | null;
  reason_code: string | null;
  reason_name: string | null;
  cust_state_by_code: string | null;
  pos_state_name: string | null;
  sdr_taxable_amt: Num;
  sdr_tax_amt: Num;
  sdr_return_amt: Num;
  sdr_remarks: string | null;
  sdr_created_by: string | null;
}

export interface DcrLineDb {
  sdri_line_no: number;
  sdri_dc_line_no: number | null;
  sdri_item_id: string;
  item_code: string | null;
  item_name_en: string | null;
  item_name_ta: string | null;
  hsn_code: string | null;
  sdri_batch_no: string | null;
  lot_no: string | null;
  godown_name: string | null;
  unit_name: string | null;
  unit_code: string | null;
  unit_kg: Num;
  sdri_return_qty: Num;
  sdri_free_qty: Num;
  sdri_weight_qty: Num;
  sdri_condition: string | null;
  sdri_bucket: string | null;
  is_free: boolean | null;
  free_type: string | null;
  sdri_rate: Num;
  sdri_rate_pre_tax: Num;
  sdri_gross_amt: Num;
  sdri_taxable_amt: Num;
  sdri_tax_perc: Num;
  sdri_cgst_perc: Num;
  sdri_cgst_amt: Num;
  sdri_sgst_perc: Num;
  sdri_sgst_amt: Num;
  sdri_igst_perc: Num;
  sdri_igst_amt: Num;
  sdri_cess_perc: Num;
  sdri_cess_amt: Num;
  sdri_tax_amt: Num;
  sdri_net_amt: Num;
  sdri_remarks: string | null;
}

/** The return's lines as printed. Exported for the spec. */
export function dcrLineRows(lines: readonly DcrLineDb[], tamil = false): PrintRow[] {
  return lines.map((l, i) => {
    const qty = decOf(l.sdri_return_qty);
    const kg = lineKg(l.sdri_weight_qty, qty.plus(decOf(l.sdri_free_qty)), l.unit_kg);
    const isFree = l.is_free === true;
    const name = itemName(l.item_name_en, l.item_name_ta, tamil);
    const batch = blank(l.sdri_batch_no) || blank(l.lot_no);
    const condition = blank(l.sdri_condition).toUpperCase();
    const bucket = blank(l.sdri_bucket).toUpperCase();
    const conditionText = CONDITION_TEXT[condition] ?? purposeText(condition);
    const bucketText = BUCKET_TEXT[bucket] ?? purposeText(bucket);
    return {
      sl_no: i + 1,
      line_no: l.sdri_line_no,
      dc_line_no: l.sdri_dc_line_no,
      item_id: l.sdri_item_id,
      item_code: l.item_code ?? '',
      item_name: name,
      hsn_code: blank(l.hsn_code),
      batch_no: blank(l.sdri_batch_no),
      lot_no: blank(l.lot_no),
      godown_name: l.godown_name ?? '',
      unit_name: l.unit_name ?? '',
      unit_code: l.unit_code ?? '',
      qty: numOf(qty),
      qty_text: qtyText(qty),
      condition,
      condition_text: conditionText,
      bucket,
      bucket_text: bucketText,
      condition_bucket_text:
        bucketText && bucketText !== conditionText
          ? `${conditionText} → ${bucketText}`
          : conditionText,
      is_free: isFree,
      free_type: isFree ? blank(l.free_type) : '',
      free_mark: isFree ? 'FREE' : '',
      description: name + (batch ? ` · ${batch}` : '') + (isFree ? ' (FREE)' : ''),
      rate: money(l.sdri_rate),
      rate_pre_tax: money(l.sdri_rate_pre_tax),
      gross_amt: money(l.sdri_gross_amt),
      taxable_amt: money(l.sdri_taxable_amt),
      tax_perc: money(l.sdri_tax_perc),
      cgst_perc: money(l.sdri_cgst_perc),
      cgst_amt: money(l.sdri_cgst_amt),
      sgst_perc: money(l.sdri_sgst_perc),
      sgst_amt: money(l.sdri_sgst_amt),
      igst_perc: money(l.sdri_igst_perc),
      igst_amt: money(l.sdri_igst_amt),
      cess_perc: money(l.sdri_cess_perc),
      cess_amt: money(l.sdri_cess_amt),
      tax_amt: money(l.sdri_tax_amt),
      net_amt: money(l.sdri_net_amt),
      weight_kg: numOf(kg),
      weight_text: kg.isZero() ? '' : qtyText(kg),
      remarks: l.sdri_remarks ?? '',
    };
  });
}

/** The return's MASTER row. Exported for the spec. */
export function dcrHeadRow(h: DcrHeadDb, lines: readonly PrintRow[], f: PrintFacts): PrintRow {
  const { qty, kg, free } = sums(lines, 'qty');
  const pos = blank(h.sdr_pos_stcd);
  const compCode = blank(h.comp_state_code);
  const godowns = [...new Set(lines.map((l) => blank(l.godown_name as string)).filter(Boolean))];
  const dcDate = dashDate(h.sdr_dc_date);
  const reason = blank(h.reason_name);
  const reasonMore = blank(h.sdr_return_reason);
  // The return keeps no GST split of its own (only sdr_tax_amt): its lines' sums.
  const add = (key: string) => lines.reduce((a, l) => a.plus(decOf(l[key] as number)), Z);
  const usrRef = blank(h.sdr_usr_refno);
  const usrDate = dashDate(h.sdr_usr_refdate);
  const printCount = Number(h.sdr_print_count ?? 0);
  return {
    title: 'CHALLAN RETURN',
    ...companyFields(h),
    return_id: h.sdr_id,
    acc_year: blank(h.sdr_acc_year),
    refno: h.sdr_return_refno ?? '',
    return_date: isoDay(h.sdr_return_date),
    return_date_text: dashDate(h.sdr_return_date),
    status: h.sdr_status,
    status_mark: statusMark(h.sdr_status),
    dc_refno: blank(h.sdr_dc_refno),
    dc_date_text: dcDate,
    dc_text: `${blank(h.sdr_dc_refno)}${dcDate ? ` dt ${dcDate}` : ''}`,
    dc_purpose: blank(h.sdc_purpose),
    dc_purpose_text: purposeText(h.sdc_purpose),
    reason_code: blank(h.reason_code),
    reason_name: reason,
    reason_text:
      reason && reasonMore && reasonMore !== reason
        ? `${reason}: ${reasonMore}`
        : reason || reasonMore,
    usr_refno: usrRef,
    their_ref_text: usrRef ? `${usrRef}${usrDate ? ` dt ${usrDate}` : ''}` : '',
    cust_name: h.sdr_cust_name ?? '',
    cust_addr: h.sdc_cust_addr ?? '',
    cust_place: h.sdc_cust_place ?? '',
    cust_pin: h.sdc_cust_pin ?? '',
    cust_place_text: [blank(h.sdc_cust_place), blank(h.sdc_cust_pin)].filter(Boolean).join(' - '),
    cust_phone: blank(h.sdc_cust_phone),
    cust_gstin: blank(h.sdr_cust_gstin),
    cust_gst_type: blank(h.sdc_cust_gst_type),
    cust_state_code: blank(h.sdr_cust_stcd),
    cust_state_name: blank(h.sdc_state_name) || blank(h.cust_state_by_code),
    cust_state_text: stateText(blank(h.sdc_state_name) || h.cust_state_by_code, h.sdr_cust_stcd),
    pos_state_code: pos,
    pos_state_name: pos ? blank(h.pos_state_name) : '',
    pos_text: pos
      ? stateText(h.pos_state_name, pos)
      : stateText(h.comp_state_by_code ?? h.comp_state, compCode),
    pos_from_company: !pos && !!compCode,
    is_interstate: supplyNatureOf(compCode, pos) === 'INTER',
    godown_text: godowns.length === 0 ? '' : godowns.join(', '),
    ...moveFields(h),
    lines_count: lines.length,
    qty: numOf(qty),
    qty_text: qtyText(qty),
    weight_kg: numOf(kg),
    weight_text: qtyText(kg),
    free_lines: free,
    totals_text: [
      countText(lines.length, 'line'),
      `${qtyText(qty)} back`,
      kg.isZero() ? null : `${qtyText(kg)} kg`,
      free > 0 ? `${free} free` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    taxable_amt: money(h.sdr_taxable_amt),
    cgst_amt: numOf(add('cgst_amt')) ?? 0,
    sgst_amt: numOf(add('sgst_amt')) ?? 0,
    igst_amt: numOf(add('igst_amt')) ?? 0,
    cess_amt: numOf(add('cess_amt')) ?? 0,
    tax_amt: money(h.sdr_tax_amt),
    return_amt: money(h.sdr_return_amt),
    remarks: blank(h.sdr_remarks),
    ...printFields(f, printCount),
  };
}

// ── the source: one read per render ─────────────────────────────────────────────

export interface DcPrintData {
  head: PrintRow;
  lines: PrintRow[];
}

@Injectable()
export class DcPrintSource {
  // Shared only WHILE a read runs (keepMs 0): a render's datasets resolve
  // together (the dataset runner's Promise.all) and its copies reuse that one
  // pass, so nothing more is needed. Kept any longer, a reprint right after a
  // recorded print would reuse the old read and miss its REPRINT mark
  // (sdc_print_count / sdr_print_count, PRINT_COUNTERS).
  private readonly dc = new RenderMemo<DcPrintData>(0);
  private readonly dcr = new RenderMemo<DcPrintData>(0);

  constructor(private readonly prisma: PrismaService) {}

  private get db(): Tx {
    return this.prisma;
  }

  /** VIEW and PRINT on the menu, or the render is refused with the right named. */
  async printRights(userId: string | null, menuId: number, what: string): Promise<void> {
    const rights =
      userId && UUID.test(userId)
        ? await loadRights(this.prisma, userId, menuId)
        : { ...NO_RIGHTS };
    for (const right of ['view', 'print'] as const) {
      if (!rights[right]) {
        throw new Error(
          `This user may not print ${what} (menu ${menuId}: um_can_${right} is not granted).`,
        );
      }
    }
  }

  /** A user's name: the display name, else the login; a text that is not a user id is kept as it is. */
  async userName(idOrText: string | null | undefined): Promise<string | null> {
    const v = blank(idOrText);
    if (!v) return null;
    if (!UUID.test(v)) return v;
    const [user] = await this.db.$queryRaw<{ name: string | null }[]>`
      SELECT COALESCE(NULLIF(btrim(usr_display_name), ''), usr_login_name) AS name
        FROM public.user_master WHERE usr_id = ${v}::uuid`;
    return user?.name ?? null;
  }

  // DELIVERY_CHALLAN ──────────────────────────────────────────────────────────

  async challan(request: ProviderRequest, code: string): Promise<DcPrintData> {
    const { docId, accYear } = requireDocument(request, code);
    const { companyId, userId } = request.context;
    const tamil = request.lang.toLowerCase().startsWith('ta');
    return this.dc.get(`${companyId}|${docId}|${accYear}|${userId ?? ''}|${tamil}`, async () => {
      await this.printRights(userId, SALES_MENU_ID.DELIVERY_CHALLAN, 'delivery challans');
      const [h] = await this.db.$queryRaw<DcHeadDb[]>`
        SELECT d.sdc_id, d.sdc_acc_year, d.sdc_branch_id, d.sdc_dc_refno, d.sdc_dc_date, d.sdc_purpose, d.sdc_status,
               d.sdc_print_count, d.sdc_src_doc_type, d.sdc_src_doc_refno, d.sdc_src_doc_date, d.sdc_usr_refno,
               d.sdc_usr_refdate, d.sdc_cust_name, d.sdc_cust_addr, d.sdc_cust_place, d.sdc_cust_pin, d.sdc_cust_phone,
               d.sdc_cust_gstin, d.sdc_cust_gst_type, d.sdc_cust_stcd, d.sdc_pos_stcd, d.sdc_state_name,
               COALESCE(NULLIF(btrim(d.sdc_vehicle_no), ''), veh.veh_vehicle_no) AS vehicle_no,
               drv.emp_name AS driver_name, sup.emp_name AS supervisor_name,
               (SELECT string_agg(e.emp_name, ', ' ORDER BY array_position(d.sdc_loadman_id, e.emp_id))
                  FROM public.employee_master e WHERE e.emp_id = ANY(d.sdc_loadman_id)) AS loadman_names,
               (SELECT string_agg(e.emp_name, ', ' ORDER BY array_position(d.sdc_salesman_id, e.emp_id))
                  FROM public.employee_master e WHERE e.emp_id = ANY(d.sdc_salesman_id)) AS salesman_names,
               d.sdc_gross_amt, d.sdc_disc_amt, d.sdc_taxable_amt, d.sdc_cgst_amt, d.sdc_sgst_amt, d.sdc_igst_amt,
               d.sdc_cess_amt, d.sdc_tax_amt, d.sdc_round_off, d.sdc_dc_amt, d.sdc_remarks, d.sdc_created_by,
               c.comp_name, c.comp_legal_name, c.comp_addr1, c.comp_addr2, c.comp_addr3, c.comp_city, c.comp_state,
               c.comp_state_code, c.comp_pin, c.comp_gstin_no, c.comp_phone, c.comp_mail,
               b.br_name, b.br_gstin_no,
               (SELECT s.state_name FROM fixed.state_codes s WHERE btrim(s.state_code) = btrim(d.sdc_cust_stcd)
                 ORDER BY s.is_deleted, s.is_active DESC LIMIT 1) AS cust_state_by_code,
               (SELECT s.state_name FROM fixed.state_codes s WHERE btrim(s.state_code) = btrim(d.sdc_pos_stcd)
                 ORDER BY s.is_deleted, s.is_active DESC LIMIT 1) AS pos_state_name,
               (SELECT s.state_name FROM fixed.state_codes s WHERE btrim(s.state_code) = btrim(c.comp_state_code)
                 ORDER BY s.is_deleted, s.is_active DESC LIMIT 1) AS comp_state_by_code,
               t.ttd_transport_mode, t.ttd_transporter_name, t.ttd_transporter_gstin, t.ttd_lr_no, t.ttd_lr_date,
               t.ttd_distance_km, t.ttd_to_name, t.ttd_to_addr, t.ttd_to_place, t.ttd_to_pin,
               tg.gdl_name AS ttd_to_godown_name,
               ewb.gdw_no, ewb.gdw_status, ewb.gdw_generated_on, ewb.gdw_valid_upto
          FROM sales.sale_dc d
          JOIN public.companys c ON c.comp_id = d.sdc_company_id
          LEFT JOIN public.branch_master b ON b.br_id = d.sdc_branch_id
          LEFT JOIN public.vehicle_master veh ON veh.veh_id = d.sdc_vehicle_id
          LEFT JOIN public.employee_master drv ON drv.emp_id = d.sdc_driver_id
          LEFT JOIN public.employee_master sup ON sup.emp_id = d.sdc_supervisor_id
          LEFT JOIN public.txn_transport_detail t
                 ON t.ttd_doc_type = 'DELIVERY_CHALLAN' AND t.ttd_doc_id = d.sdc_id
                AND t.ttd_acc_year = d.sdc_acc_year AND t.ttd_is_deleted = false
          LEFT JOIN inventory.godown_locations tg ON tg.gdl_id = t.ttd_to_godown_id
          LEFT JOIN LATERAL (
                SELECT w.gdw_no, w.gdw_status::text AS gdw_status, w.gdw_generated_on,
                       COALESCE(w.gdw_extended_upto, w.gdw_valid_upto) AS gdw_valid_upto
                  FROM accounts.acc_voucher_doc_register g
                  JOIN accounts.acc_voucher_doc_ewaybill w
                    ON w.gdw_gdr_id = g.gdr_id AND w.gdw_acc_year = g.gdr_acc_year AND w.gdw_is_deleted = false
                 WHERE g.gdr_source_doc_id = d.sdc_id AND g.gdr_acc_year = d.sdc_acc_year
                   AND g.gdr_is_deleted = false
                   AND w.gdw_status IN ('GENERATED', 'EXPIRED') AND w.gdw_no IS NOT NULL
                 ORDER BY (g.gdr_doc_status <> 'CANCELED') DESC, w.gdw_generated_on DESC NULLS LAST
                 LIMIT 1) ewb ON true
         WHERE d.sdc_id = ${docId}::uuid
           -- The partition key: sale_dc is PARTITIONED BY sdc_acc_year.
           AND d.sdc_acc_year = ${accYear}::bpchar
           AND d.sdc_company_id = ${companyId}::uuid
           AND d.sdc_is_deleted = false`;
      if (!h) {
        throw new Error(`No delivery challan ${docId} in this company for ${accYear}.`);
      }
      const raw = await this.db.$queryRaw<DcLineDb[]>`
        SELECT i.sdi_line_no, i.sdi_split_no, i.sdi_item_id, itm.item_code, itm.item_name_en, itm.item_name_ta,
               COALESCE(NULLIF(btrim(i.sdi_hsn_code), ''), itm.item_hsn_code) AS hsn_code,
               i.sdi_batch_no, lot.slt_batch_no AS lot_no, gd.gdl_name AS godown_name,
               unt.unit_name, unt.unit_code, iuc.iuc_uom_weight AS unit_kg,
               i.sdi_dc_qty, i.sdi_free_qty, i.sdi_weight_qty, i.sdi_is_free, i.sdi_free_type,
               i.sdi_src_doc_type, i.sdi_src_doc_refno,
               i.sdi_rate, i.sdi_rate_pre_tax, i.sdi_disc_amt, i.sdi_gross_amt, i.sdi_taxable_amt,
               i.sdi_tax_perc, i.sdi_cgst_perc, i.sdi_cgst_amt, i.sdi_sgst_perc, i.sdi_sgst_amt,
               i.sdi_igst_perc, i.sdi_igst_amt, i.sdi_cess_perc, i.sdi_cess_amt, i.sdi_tax_amt, i.sdi_net_amt,
               i.sdi_remarks
          FROM sales.sale_dc_item i
          JOIN inventory.item_master itm ON itm.item_id = i.sdi_item_id
          LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = i.sdi_item_unit_id
          LEFT JOIN inventory.item_unit_master unt ON unt.unit_id = iuc.iuc_unit_id
          LEFT JOIN inventory.godown_locations gd ON gd.gdl_id = i.sdi_godown_id
          LEFT JOIN stock.stock_lot lot ON lot.slt_id = i.sdi_lot_id
         WHERE i.sdi_dc_id = ${docId}::uuid
           AND i.sdi_acc_year = ${accYear}::bpchar
           AND i.sdi_company_id = ${companyId}::uuid
           AND i.sdi_is_deleted = false
         ORDER BY i.sdi_line_no, i.sdi_split_no`;
      const lines = dcLineRows(raw, tamil);
      const [preparedBy, printedBy] = await Promise.all([
        this.userName(h.sdc_created_by),
        this.userName(userId),
      ]);
      return { head: dcHeadRow(h, lines, { preparedBy, printedBy, at: new Date() }), lines };
    });
  }

  // DC_RETURN ─────────────────────────────────────────────────────────────────

  async dcReturn(request: ProviderRequest, code: string): Promise<DcPrintData> {
    const { docId, accYear } = requireDocument(request, code);
    const { companyId, userId } = request.context;
    const tamil = request.lang.toLowerCase().startsWith('ta');
    return this.dcr.get(`${companyId}|${docId}|${accYear}|${userId ?? ''}|${tamil}`, async () => {
      await this.printRights(userId, SALES_MENU_ID.DC_RETURN, 'challan returns');
      const [h] = await this.db.$queryRaw<DcrHeadDb[]>`
        SELECT r.sdr_id, r.sdr_acc_year, r.sdr_branch_id, r.sdr_return_refno, r.sdr_return_date, r.sdr_status,
               r.sdr_print_count, r.sdr_dc_refno, r.sdr_dc_date, r.sdr_return_reason, r.sdr_usr_refno,
               r.sdr_usr_refdate, r.sdr_cust_name, r.sdr_cust_gstin, r.sdr_cust_stcd, r.sdr_pos_stcd,
               dc.sdc_cust_addr, dc.sdc_cust_place, dc.sdc_cust_pin, dc.sdc_cust_phone, dc.sdc_cust_gst_type,
               dc.sdc_state_name, dc.sdc_purpose,
               rsn.srm_code AS reason_code, rsn.srm_name AS reason_name,
               COALESCE(NULLIF(btrim(r.sdr_vehicle_no), ''), veh.veh_vehicle_no) AS vehicle_no,
               drv.emp_name AS driver_name, sup.emp_name AS supervisor_name,
               (SELECT string_agg(e.emp_name, ', ' ORDER BY array_position(r.sdr_loadman_id, e.emp_id))
                  FROM public.employee_master e WHERE e.emp_id = ANY(r.sdr_loadman_id)) AS loadman_names,
               (SELECT string_agg(e.emp_name, ', ' ORDER BY array_position(r.sdr_salesman_id, e.emp_id))
                  FROM public.employee_master e WHERE e.emp_id = ANY(r.sdr_salesman_id)) AS salesman_names,
               r.sdr_taxable_amt, r.sdr_tax_amt, r.sdr_return_amt, r.sdr_remarks, r.sdr_created_by,
               c.comp_name, c.comp_legal_name, c.comp_addr1, c.comp_addr2, c.comp_addr3, c.comp_city, c.comp_state,
               c.comp_state_code, c.comp_pin, c.comp_gstin_no, c.comp_phone, c.comp_mail,
               b.br_name, b.br_gstin_no,
               (SELECT s.state_name FROM fixed.state_codes s WHERE btrim(s.state_code) = btrim(r.sdr_cust_stcd)
                 ORDER BY s.is_deleted, s.is_active DESC LIMIT 1) AS cust_state_by_code,
               (SELECT s.state_name FROM fixed.state_codes s WHERE btrim(s.state_code) = btrim(r.sdr_pos_stcd)
                 ORDER BY s.is_deleted, s.is_active DESC LIMIT 1) AS pos_state_name,
               (SELECT s.state_name FROM fixed.state_codes s WHERE btrim(s.state_code) = btrim(c.comp_state_code)
                 ORDER BY s.is_deleted, s.is_active DESC LIMIT 1) AS comp_state_by_code,
               t.ttd_transport_mode, t.ttd_transporter_name, t.ttd_transporter_gstin, t.ttd_lr_no, t.ttd_lr_date,
               t.ttd_distance_km,
               ewb.gdw_no, ewb.gdw_status, ewb.gdw_generated_on, ewb.gdw_valid_upto
          FROM sales.sale_dc_return r
          JOIN public.companys c ON c.comp_id = r.sdr_company_id
          LEFT JOIN public.branch_master b ON b.br_id = r.sdr_branch_id
          -- The challan it returns, by its own partition key: the address and purpose.
          LEFT JOIN sales.sale_dc dc ON dc.sdc_id = r.sdr_dc_id AND dc.sdc_acc_year = r.sdr_dc_acc_year
          LEFT JOIN stock.stock_reason_master rsn ON rsn.srm_id = r.sdr_reason_id
          LEFT JOIN public.vehicle_master veh ON veh.veh_id = r.sdr_vehicle_id
          LEFT JOIN public.employee_master drv ON drv.emp_id = r.sdr_driver_id
          LEFT JOIN public.employee_master sup ON sup.emp_id = r.sdr_supervisor_id
          LEFT JOIN public.txn_transport_detail t
                 ON t.ttd_doc_type = 'DC_RETURN' AND t.ttd_doc_id = r.sdr_id
                AND t.ttd_acc_year = r.sdr_acc_year AND t.ttd_is_deleted = false
          LEFT JOIN LATERAL (
                SELECT w.gdw_no, w.gdw_status::text AS gdw_status, w.gdw_generated_on,
                       COALESCE(w.gdw_extended_upto, w.gdw_valid_upto) AS gdw_valid_upto
                  FROM accounts.acc_voucher_doc_register g
                  JOIN accounts.acc_voucher_doc_ewaybill w
                    ON w.gdw_gdr_id = g.gdr_id AND w.gdw_acc_year = g.gdr_acc_year AND w.gdw_is_deleted = false
                 WHERE g.gdr_source_doc_id = r.sdr_id AND g.gdr_acc_year = r.sdr_acc_year
                   AND g.gdr_is_deleted = false
                   AND w.gdw_status IN ('GENERATED', 'EXPIRED') AND w.gdw_no IS NOT NULL
                 ORDER BY (g.gdr_doc_status <> 'CANCELED') DESC, w.gdw_generated_on DESC NULLS LAST
                 LIMIT 1) ewb ON true
         WHERE r.sdr_id = ${docId}::uuid
           AND r.sdr_acc_year = ${accYear}::bpchar
           AND r.sdr_company_id = ${companyId}::uuid
           AND r.sdr_is_deleted = false`;
      if (!h) {
        throw new Error(`No challan return ${docId} in this company for ${accYear}.`);
      }
      const raw = await this.db.$queryRaw<DcrLineDb[]>`
        SELECT ri.sdri_line_no, ri.sdri_dc_line_no, ri.sdri_item_id, itm.item_code, itm.item_name_en, itm.item_name_ta,
               COALESCE(NULLIF(btrim(ri.sdri_hsn_code), ''), itm.item_hsn_code) AS hsn_code,
               ri.sdri_batch_no, lot.slt_batch_no AS lot_no, gd.gdl_name AS godown_name,
               unt.unit_name, unt.unit_code, iuc.iuc_uom_weight AS unit_kg,
               ri.sdri_return_qty, ri.sdri_free_qty, ri.sdri_weight_qty, ri.sdri_condition, ri.sdri_bucket,
               COALESCE(di.sdi_is_free, false) AS is_free, di.sdi_free_type AS free_type,
               ri.sdri_rate, ri.sdri_rate_pre_tax, ri.sdri_gross_amt, ri.sdri_taxable_amt,
               ri.sdri_tax_perc, ri.sdri_cgst_perc, ri.sdri_cgst_amt, ri.sdri_sgst_perc, ri.sdri_sgst_amt,
               ri.sdri_igst_perc, ri.sdri_igst_amt, ri.sdri_cess_perc, ri.sdri_cess_amt, ri.sdri_tax_amt,
               ri.sdri_net_amt, ri.sdri_remarks
          FROM sales.sale_dc_return_item ri
          JOIN inventory.item_master itm ON itm.item_id = ri.sdri_item_id
          -- The challan line it came back from: whether it went free.
          LEFT JOIN sales.sale_dc_item di ON di.sdi_id = ri.sdri_dc_item_id AND di.sdi_acc_year = ri.sdri_dc_acc_year
          LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = ri.sdri_item_unit_id
          LEFT JOIN inventory.item_unit_master unt ON unt.unit_id = iuc.iuc_unit_id
          LEFT JOIN inventory.godown_locations gd ON gd.gdl_id = ri.sdri_godown_id
          LEFT JOIN stock.stock_lot lot ON lot.slt_id = ri.sdri_lot_id
         WHERE ri.sdri_return_id = ${docId}::uuid
           AND ri.sdri_acc_year = ${accYear}::bpchar
           AND ri.sdri_company_id = ${companyId}::uuid
           AND ri.sdri_is_deleted = false
         ORDER BY ri.sdri_line_no`;
      const lines = dcrLineRows(raw, tamil);
      const [preparedBy, printedBy] = await Promise.all([
        this.userName(h.sdr_created_by),
        this.userName(userId),
      ]);
      return { head: dcrHeadRow(h, lines, { preparedBy, printedBy, at: new Date() }), lines };
    });
  }
}

// ── the providers ───────────────────────────────────────────────────────────────

@Injectable()
export class DcHeaderProvider implements PrintDataProvider {
  readonly code = 'sales.dc.header';
  readonly label =
    'Delivery challan — company, consignee, purpose, place of supply, transport, e-way bill, totals';
  readonly cardinality = 'one' as const;
  constructor(private readonly source: DcPrintSource) {}
  async resolve(request: ProviderRequest): Promise<PrintRow> {
    return (await this.source.challan(request, this.code)).head;
  }
}

@Injectable()
export class DcItemsProvider implements PrintDataProvider {
  readonly code = 'sales.dc.items';
  readonly label =
    'Delivery challan — the lines (item, HSN, qty, free mark, unit, rate, taxable, GST, amount, kg)';
  readonly cardinality = 'many' as const;
  constructor(private readonly source: DcPrintSource) {}
  async resolve(request: ProviderRequest): Promise<PrintRow[]> {
    return (await this.source.challan(request, this.code)).lines.slice(0, request.rowLimit);
  }
}

@Injectable()
export class DcrHeaderProvider implements PrintDataProvider {
  readonly code = 'sales.dcr.header';
  readonly label =
    'Challan return — company, customer, the challan it returns, reason, transport, totals';
  readonly cardinality = 'one' as const;
  constructor(private readonly source: DcPrintSource) {}
  async resolve(request: ProviderRequest): Promise<PrintRow> {
    return (await this.source.dcReturn(request, this.code)).head;
  }
}

@Injectable()
export class DcrItemsProvider implements PrintDataProvider {
  readonly code = 'sales.dcr.items';
  readonly label =
    'Challan return — the lines (item, qty, unit, condition / bucket, rate, taxable, GST, amount)';
  readonly cardinality = 'many' as const;
  constructor(private readonly source: DcPrintSource) {}
  async resolve(request: ProviderRequest): Promise<PrintRow[]> {
    return (await this.source.dcReturn(request, this.code)).lines.slice(0, request.rowLimit);
  }
}

/** For print-render.module.ts's explicit registry (the source is a helper, not a provider). */
export const DC_PRINT_PROVIDERS = [
  DcHeaderProvider,
  DcItemsProvider,
  DcrHeaderProvider,
  DcrItemsProvider,
] as const;
