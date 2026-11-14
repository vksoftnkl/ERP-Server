import { Prisma } from '@prisma/client';
import {
  D,
  ZERO,
  resolveFactor,
  zeroParts,
  type BillChargeFacts,
  type BillLineFacts,
  type ChargeFigures,
  type Dec,
  type LineParts,
  type PriorBack,
  type TodayPriceFacts,
} from './sale-return-money';

/**
 * Plan v5 §6 — every read the money mirror needs, and nothing else. One class
 * so the service's spec swaps a single object, and so `/bill-lines`,
 * `/validate`, `/create` and `/post` read the bill exactly alike.
 *
 * "Posted returns" always means the OTHER returns of the bill that are
 * POSTED: a draft holds nothing (D51), and the return being worked out is
 * left out by id so a re-save or a post never counts itself.
 */

type Client = Prisma.TransactionClient;
const NIL = '00000000-0000-0000-0000-000000000000';

export interface BillHeaderFacts {
  sbId: string;
  accYear: string;
  status: string;
  refno: string | null;
  date: string;
  companyId: string;
  branchId: string;
  billType: string | null;
  billMode: string | null;
  payMode: string | null;
  custId: string | null;
  custName: string | null;
  custAddr: string | null;
  custPlace: string | null;
  custPin: string | null;
  custPhone: string | null;
  custGstin: string | null;
  custGstType: string | null;
  custStcd: string | null;
  posStcd: string | null;
  stateName: string | null;
  priceLevel: number | null;
  billAmt: Dec;
  taxable: Dec;
  cashDisc: Dec;
  roundOff: Dec;
  roundOffStep: Dec | null;
  returnedAmt: Dec;
  returnStatus: string | null;
  salesmanIds: string[];
  loadmanIds: string[];
  agentId: string | null;
  driverId: string | null;
  supervisorId: string | null;
  vehicleId: string | null;
  vehicleNo: string | null;
  hasFreight: boolean;
  hasLoad: boolean;
  hasUnload: boolean;
  freightCalcType: string | null;
  loadingCalcType: string | null;
  loyaltyMemberId: string | null;
  loyaltyEarnPoints: Dec;
  agentCommAmt: Dec;
}

/** A bill line with what /bill-lines shows beside the money. */
export interface BillLineView extends BillLineFacts {
  itemName: string | null;
  unitName: string | null;
  allowReturn: boolean;
  godownId: string;
  unitWeight: Dec | null;
  lotBatchNo: string | null;
  lotExpiry: string | null;
  /** The bill line's after-tax charge share and its net (taxable + GST + that share). Display only. */
  chrgAfterTax: Dec;
  netAmt: Dec;
}

export interface UnitRow {
  itemUnitId: string;
  itemId: string;
  unitName: string | null;
  factor: Dec;
  weight: Dec | null;
  isBase: boolean;
}

export interface PriorHeader {
  roundOff: Dec;
  cashDisc: Dec;
  refund: Dec;
  /** D48 — what earlier returns gave back as points (money value), and kept as voucher credit. */
  pointsBackAmt: Dec;
  voucherShare: Dec;
  /** D22 — the agent's commission earlier returns took back. */
  agentComm: Dec;
  /** D9 — the loyalty points earlier returns clawed back (sr_loyalty_reverse_points). */
  loyaltyReversed: Dec;
  /** D48 / D74 — the points earlier returns gave back (sr_points_back). */
  pointsBack: Dec;
}

/**
 * D74 — how a loyalty scheme counts points: its precision and rounding
 * (`lsc_points_decimals`, `lsc_rounding_method`) and whether a return takes
 * back what it earned (`lsc_return_mode`).
 */
export interface LoyaltyRule {
  lscId: string;
  decimals: number;
  rounding: string | null;
  returnMode: string | null;
}

export interface DraftHold {
  base: Dec;
  refnos: string[];
}

export interface BillTenderFacts {
  money: Dec;
  points: Dec;
  pointsUnits: Dec;
  voucher: Dec;
  credit: Dec;
}

/** One open receivable of the customer (acc_bill_balance DR row), for Adjust (D1 / D2). */
export interface OpenBillFacts {
  ablId: string;
  ablAccYear: string;
  billType: string;
  refno: string | null;
  docDate: string | null;
  dueDate: string | null;
  billAmount: Dec;
  pending: Dec;
  alloc: Dec;
  srcDocType: string | null;
  srcDocId: string | null;
  srcAccYear: string | null;
}

/**
 * What an amend's unwind gives back (SaleReturnService.unwind), read before
 * it runs: /validate previews the amend of a POSTED return on that state, so
 * popup 25's proposal, dueNow and caps equal what the amend itself sees.
 */
export interface UnwindAddBack {
  /**
   * Per DR receivable (abl_id): this return's own live Adjust-at-Post set-off
   * on it (OWN_ADJUST_AT_POST), which the unwind takes off the bill again.
   */
  bills: ReadonlyMap<string, Dec>;
  /**
   * What the unwind adds to the customer's bill-wise balance: those set-offs
   * come back on the bills, and the note's own receivable (its live pending,
   * a CR) is retired.
   */
  balance: Dec;
  /** Whose balance that is: the note's party (null when the return has no note). */
  partyId: string | null;
}

/** One tender row of the bill (acc_tender_detail), for the refund grid's start (D33). */
export interface BillTenderRow {
  tdId: string;
  tenderId: string | null;
  tenderTypeId: number;
  name: string | null;
  ledgerId: string | null;
  amount: Dec;
  unitsUsed: Dec;
  conversionRate: Dec;
}

/** One till_approval row of a return (D55 / D61 / D72 / D77). */
export interface ReturnApprovalRow {
  tapId: string;
  accYear: string;
  event: string;
  status: string;
  amount: Dec;
  requestedBy: string | null;
  requestedByName: string | null;
  requestedOn: Date | null;
  requestNote: string | null;
  decidedBy: string | null;
  decidedByName: string | null;
  decidedOn: Date | null;
  decisionNote: string | null;
  usedOn: string | null;
}

/** A promotion scheme and its slabs, for the scheme-short check (D47). */
export interface SchemeFacts {
  prmId: string;
  code: string | null;
  name: string | null;
  applyOn: string | null;
  benefit: string | null;
  includeTax: boolean;
  minQty: Dec;
  minBillAmount: Dec;
  slabs: { exceeds: Dec; upto: Dec; benefit: string | null }[];
}

export interface ReturnChargeRow {
  cdId: string;
  cdSrcCdId: string | null;
  cdSrcAccYear: string | null;
  cdCarryBasis: string | null;
  cdAmount: Dec;
  cdCarriedAmt: Dec;
}

export interface LotFacts {
  lotId: string;
  batchNo: string | null;
  expiryDate: string | null;
}

/** The sale_bill_item columns the mirror reads, under the names it reads them by. */
const LINE_COLUMNS = Prisma.sql`
  bi.sbi_id, bi.sbi_acc_year, bi.sbi_line_no, bi.sbi_item_id, bi.sbi_item_unit_id, bi.sbi_godown_id,
  bi.sbi_bill_qty, bi.sbi_to_base_factor, iuc.iuc_to_base_factor AS unit_factor, iuc.iuc_uom_weight AS unit_weight,
  bi.sbi_gross_amt, bi.sbi_item_disc_amt, bi.sbi_spl_disc_amt, bi.sbi_sch_disc_amt, bi.sbi_bill_sch_amt,
  bi.sbi_addl_disc1_amt, bi.sbi_addl_disc2_amt, bi.sbi_cash_disc_amt, bi.sbi_taxable_amt,
  bi.sbi_cgst_amt, bi.sbi_sgst_amt, bi.sbi_igst_amt, bi.sbi_cess_amt, bi.sbi_acess_amt, bi.sbi_cogs_amt,
  bi.sbi_net_gross, bi.sbi_chrg_before_tax, bi.sbi_chrg_after_tax, bi.sbi_net_amt, bi.sbi_loyalty_pv, bi.sbi_loyalty_points, bi.sbi_weight_qty,
  bi.sbi_rate, bi.sbi_rate_pre_tax, bi.sbi_max_price, bi.sbi_min_price, bi.sbi_act_price,
  bi.sbi_item_disc_qty, bi.sbi_spl_disc_qty, bi.sbi_sch_disc_qty, bi.sbi_bill_sch_qty,
  bi.sbi_cess_per_unit, bi.sbi_acess_per_unit,
  bi.sbi_item_disc_perc, bi.sbi_spl_disc_perc, bi.sbi_sch_disc_perc, bi.sbi_bill_sch_perc,
  bi.sbi_addl_disc1_perc, bi.sbi_addl_disc2_perc, bi.sbi_cash_disc_perc,
  bi.sbi_tax_perc, bi.sbi_cgst_perc, bi.sbi_sgst_perc, bi.sbi_igst_perc, bi.sbi_cess_perc, bi.sbi_acess_perc,
  bi.sbi_hsn_code, bi.sbi_tax_id, bi.sbi_is_tax_incl, bi.sbi_is_free, bi.sbi_free_type, bi.sbi_is_service,
  bi.sbi_scheme_id, bi.sbi_scheme_name, bi.sbi_price_level, bi.sbi_ean_code, bi.sbi_lot_id,
  bi.sbi_batch_no, bi.sbi_batch_date, bi.sbi_expiry_date, bi.sbi_serial_no, bi.sbi_salesman_id,
  bi.sbi_promo_usage_id, bi.sbi_qty_price_id, bi.sbi_size, bi.sbi_size_uom`;

type LineRow = Record<string, unknown>;

const dec = (v: unknown): Dec =>
  v === null || v === undefined
    ? ZERO
    : v instanceof Prisma.Decimal
      ? v
      : D(v as Prisma.Decimal.Value);
const decOrNull = (v: unknown): Dec | null => (v === null || v === undefined ? null : dec(v));
const str = (v: unknown): string | null =>
  typeof v === 'string'
    ? v
    : typeof v === 'number' || typeof v === 'bigint' || typeof v === 'boolean'
      ? String(v)
      : null;
const iso = (v: unknown): string | null =>
  v instanceof Date
    ? v.toISOString().slice(0, 10)
    : typeof v === 'string' && v
      ? v.slice(0, 10)
      : null;

export function lineFactsOf(r: LineRow): BillLineFacts {
  const parts: LineParts = zeroParts();
  parts.grossAmt = dec(r.sbi_gross_amt);
  parts.itemDiscAmt = dec(r.sbi_item_disc_amt);
  parts.splDiscAmt = dec(r.sbi_spl_disc_amt);
  parts.schDiscAmt = dec(r.sbi_sch_disc_amt);
  parts.billSchAmt = dec(r.sbi_bill_sch_amt);
  parts.addlDisc1Amt = dec(r.sbi_addl_disc1_amt);
  parts.addlDisc2Amt = dec(r.sbi_addl_disc2_amt);
  parts.cashDiscAmt = dec(r.sbi_cash_disc_amt);
  parts.taxableAmt = dec(r.sbi_taxable_amt);
  parts.cgstAmt = dec(r.sbi_cgst_amt);
  parts.sgstAmt = dec(r.sbi_sgst_amt);
  parts.igstAmt = dec(r.sbi_igst_amt);
  parts.cessAmt = dec(r.sbi_cess_amt);
  parts.acessAmt = dec(r.sbi_acess_amt);
  parts.cogsAmt = dec(r.sbi_cogs_amt);
  // An older line carries no net gross: the goods value after the line's own
  // discounts is what it would have said.
  parts.netGross =
    r.sbi_net_gross === null || r.sbi_net_gross === undefined
      ? parts.grossAmt
          .minus(parts.itemDiscAmt)
          .minus(parts.splDiscAmt)
          .minus(parts.schDiscAmt)
          .minus(parts.billSchAmt)
          .minus(parts.addlDisc1Amt)
          .minus(parts.addlDisc2Amt)
          .minus(parts.cashDiscAmt)
      : dec(r.sbi_net_gross);
  parts.chrgBeforeTax = dec(r.sbi_chrg_before_tax);
  parts.loyaltyPv = dec(r.sbi_loyalty_pv);
  parts.loyaltyPoints = dec(r.sbi_loyalty_points);
  parts.weightQty = dec(r.sbi_weight_qty);
  return {
    billItemId: String(r.sbi_id),
    accYear: String(r.sbi_acc_year).trim(),
    lineNo: Number(r.sbi_line_no),
    itemId: String(r.sbi_item_id),
    itemUnitId: String(r.sbi_item_unit_id),
    qty: dec(r.sbi_bill_qty),
    factor: resolveFactor(dec(r.sbi_to_base_factor), dec(r.unit_factor)),
    parts,
    perUnit: {
      rate: decOrNull(r.sbi_rate),
      ratePreTax: decOrNull(r.sbi_rate_pre_tax),
      maxPrice: decOrNull(r.sbi_max_price),
      minPrice: decOrNull(r.sbi_min_price),
      actPrice: decOrNull(r.sbi_act_price),
      itemDiscQty: decOrNull(r.sbi_item_disc_qty),
      splDiscQty: decOrNull(r.sbi_spl_disc_qty),
      schDiscQty: decOrNull(r.sbi_sch_disc_qty),
      billSchQty: decOrNull(r.sbi_bill_sch_qty),
      cessPerUnit: decOrNull(r.sbi_cess_per_unit),
      acessPerUnit: decOrNull(r.sbi_acess_per_unit),
    },
    percent: {
      itemDiscPerc: dec(r.sbi_item_disc_perc),
      splDiscPerc: dec(r.sbi_spl_disc_perc),
      schDiscPerc: dec(r.sbi_sch_disc_perc),
      billSchPerc: dec(r.sbi_bill_sch_perc),
      addlDisc1Perc: dec(r.sbi_addl_disc1_perc),
      addlDisc2Perc: dec(r.sbi_addl_disc2_perc),
      cashDiscPerc: dec(r.sbi_cash_disc_perc),
      taxPerc: dec(r.sbi_tax_perc),
      cgstPerc: dec(r.sbi_cgst_perc),
      sgstPerc: dec(r.sbi_sgst_perc),
      igstPerc: dec(r.sbi_igst_perc),
      cessPerc: dec(r.sbi_cess_perc),
      acessPerc: dec(r.sbi_acess_perc),
    },
    copy: {
      hsnCode: str(r.sbi_hsn_code),
      taxId: str(r.sbi_tax_id),
      isTaxIncl: r.sbi_is_tax_incl === true,
      isFree: r.sbi_is_free === true,
      freeType: str(r.sbi_free_type),
      isService: r.sbi_is_service === true,
      schemeId: str(r.sbi_scheme_id),
      schemeName: str(r.sbi_scheme_name),
      priceLevel:
        r.sbi_price_level === null || r.sbi_price_level === undefined
          ? null
          : Number(r.sbi_price_level),
      eanCode: str(r.sbi_ean_code),
      lotId: str(r.sbi_lot_id),
      batchNo: str(r.sbi_batch_no),
      batchDate: iso(r.sbi_batch_date),
      expiryDate: iso(r.sbi_expiry_date),
      serialNo: str(r.sbi_serial_no),
      salesmanId: str(r.sbi_salesman_id),
      promoUsageId: str(r.sbi_promo_usage_id),
      qtyPriceId: str(r.sbi_qty_price_id),
      size: str(r.sbi_size),
      sizeUom: str(r.sbi_size_uom),
    },
  };
}

export class SaleReturnBillReader {
  async billHeader(c: Client, sbId: string, accYear: string): Promise<BillHeaderFacts | null> {
    const [b] = await c.$queryRaw<Record<string, unknown>[]>`
      SELECT sb_id, sb_acc_year, sb_status, sb_bill_refno, sb_bill_date, sb_company_id, sb_branch_id,
             sb_bill_type, sb_bill_mode, sb_pay_mode, sb_cust_id, sb_cust_name, sb_cust_addr, sb_cust_place,
             sb_cust_pin, sb_cust_phone, sb_cust_gstin, sb_cust_gst_type, sb_cust_stcd, sb_pos_stcd, sb_state_name,
             sb_price_level, sb_bill_amt, sb_taxable_amt, sb_cash_disc, sb_round_off, sb_round_off_step,
             sb_returned_amt, sb_return_status, sb_salesman_id, sb_loadman_id, sb_agent_id, sb_driver_id,
             sb_supervisor_id, sb_vehicle_id, sb_vehicle_no, sb_has_freight, sb_has_load, sb_has_unload,
             sb_freight_calc_type, sb_loading_calc_type, sb_loyalty_member_id, sb_loyalty_earn_points,
             sb_agent_comm_amt
        FROM sales.sale_bill
       WHERE sb_id = ${sbId}::uuid AND sb_acc_year = ${accYear}::char(9) AND sb_is_deleted = false`;
    if (!b) {
      return null;
    }
    return {
      sbId: String(b.sb_id),
      accYear: String(b.sb_acc_year).trim(),
      status: String(b.sb_status),
      refno: str(b.sb_bill_refno),
      date: iso(b.sb_bill_date)!,
      companyId: String(b.sb_company_id),
      branchId: String(b.sb_branch_id),
      billType: str(b.sb_bill_type),
      billMode: str(b.sb_bill_mode),
      payMode: str(b.sb_pay_mode),
      custId: str(b.sb_cust_id),
      custName: str(b.sb_cust_name),
      custAddr: str(b.sb_cust_addr),
      custPlace: str(b.sb_cust_place),
      custPin: str(b.sb_cust_pin),
      custPhone: str(b.sb_cust_phone),
      custGstin: str(b.sb_cust_gstin),
      custGstType: str(b.sb_cust_gst_type),
      custStcd: str(b.sb_cust_stcd)?.trim() ?? null,
      posStcd: str(b.sb_pos_stcd)?.trim() ?? null,
      stateName: str(b.sb_state_name),
      priceLevel: b.sb_price_level === null ? null : Number(b.sb_price_level),
      billAmt: dec(b.sb_bill_amt),
      taxable: dec(b.sb_taxable_amt),
      cashDisc: dec(b.sb_cash_disc),
      roundOff: dec(b.sb_round_off),
      roundOffStep: decOrNull(b.sb_round_off_step),
      returnedAmt: dec(b.sb_returned_amt),
      returnStatus: str(b.sb_return_status),
      salesmanIds: (b.sb_salesman_id as string[] | null) ?? [],
      loadmanIds: (b.sb_loadman_id as string[] | null) ?? [],
      agentId: str(b.sb_agent_id),
      driverId: str(b.sb_driver_id),
      supervisorId: str(b.sb_supervisor_id),
      vehicleId: str(b.sb_vehicle_id),
      vehicleNo: str(b.sb_vehicle_no),
      hasFreight: b.sb_has_freight === true,
      hasLoad: b.sb_has_load === true,
      hasUnload: b.sb_has_unload === true,
      freightCalcType: str(b.sb_freight_calc_type),
      loadingCalcType: str(b.sb_loading_calc_type),
      loyaltyMemberId: str(b.sb_loyalty_member_id),
      loyaltyEarnPoints: dec(b.sb_loyalty_earn_points),
      agentCommAmt: dec(b.sb_agent_comm_amt),
    };
  }

  /** The bill's lines, money parts and what /bill-lines shows, in line order. */
  async billLines(
    c: Client,
    bill: Pick<BillHeaderFacts, 'sbId' | 'accYear'>,
  ): Promise<BillLineView[]> {
    const rows = await c.$queryRaw<LineRow[]>`
      SELECT ${LINE_COLUMNS}, im.item_name_en, im.item_allow_sales_return, um.unit_name,
             slt.slt_batch_no, slt.slt_expiry_date
        FROM sales.sale_bill_item bi
        JOIN inventory.item_master im ON im.item_id = bi.sbi_item_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = bi.sbi_item_unit_id
        LEFT JOIN inventory.item_unit_master um ON um.unit_id = iuc.iuc_unit_id
        LEFT JOIN stock.stock_lot slt ON slt.slt_id = bi.sbi_lot_id
       WHERE bi.sbi_bill_id = ${bill.sbId}::uuid AND bi.sbi_acc_year = ${bill.accYear}::char(9)
         AND bi.sbi_is_deleted = false
       ORDER BY bi.sbi_line_no, bi.sbi_split_no`;
    return rows.map((r) => ({
      ...lineFactsOf(r),
      itemName: str(r.item_name_en),
      unitName: str(r.unit_name),
      allowReturn: r.item_allow_sales_return !== false,
      godownId: String(r.sbi_godown_id),
      unitWeight: decOrNull(r.unit_weight),
      lotBatchNo: str(r.slt_batch_no),
      lotExpiry: iso(r.slt_expiry_date),
      chrgAfterTax: dec(r.sbi_chrg_after_tax),
      netAmt: dec(r.sbi_net_amt),
    }));
  }

  /** D51 — lock every line of the bill, in id order, before the qty and the remainders are read. */
  async lockBillLines(
    tx: Client,
    bill: Pick<BillHeaderFacts, 'sbId' | 'accYear'>,
  ): Promise<number> {
    const rows = await tx.$queryRaw<{ sbi_id: string }[]>`
      SELECT sbi_id FROM sales.sale_bill_item
       WHERE sbi_bill_id = ${bill.sbId}::uuid AND sbi_acc_year = ${bill.accYear}::char(9) AND sbi_is_deleted = false
       ORDER BY sbi_id
         FOR UPDATE`;
    return rows.length;
  }

  /** The bill's charge rows, locked in id order (two returns cannot both give one charge back). */
  async lockBillCharges(
    tx: Client,
    bill: Pick<BillHeaderFacts, 'sbId' | 'accYear'>,
  ): Promise<number> {
    const rows = await tx.$queryRaw<{ cd_id: string }[]>`
      SELECT cd_id FROM public.txn_charge_detail
       WHERE cd_doc_type = 'INVOICE' AND cd_doc_id = ${bill.sbId}::uuid AND cd_acc_year = ${bill.accYear}::char(9)
         AND cd_is_deleted = false
       ORDER BY cd_id
         FOR UPDATE`;
    return rows.length;
  }

  /** What the POSTED returns other than `excludeSrId` took from each bill line. */
  async priorBack(
    c: Client,
    bill: Pick<BillHeaderFacts, 'sbId' | 'accYear'>,
    excludeSrId: string | null,
  ): Promise<Map<string, PriorBack>> {
    const rows = await c.$queryRaw<Record<string, unknown>[]>`
      SELECT ri.sri_bill_item_id AS id,
             SUM((ri.sri_return_qty + ri.sri_free_qty)
                 * CASE WHEN ri.sri_to_base_factor > 0 THEN ri.sri_to_base_factor
                        ELSE COALESCE(NULLIF(ru.iuc_to_base_factor, 0), 1) END) AS base,
             SUM(ri.sri_gross_amt) AS gross, SUM(ri.sri_item_disc_amt) AS item_disc, SUM(ri.sri_spl_disc_amt) AS spl_disc,
             SUM(ri.sri_sch_disc_amt) AS sch_disc, SUM(ri.sri_bill_sch_amt) AS bill_sch, SUM(ri.sri_addl_disc1_amt) AS addl1,
             SUM(ri.sri_addl_disc2_amt) AS addl2, SUM(ri.sri_cash_disc_amt) AS cash_disc, SUM(ri.sri_taxable_amt) AS taxable,
             SUM(ri.sri_cgst_amt) AS cgst, SUM(ri.sri_sgst_amt) AS sgst, SUM(ri.sri_igst_amt) AS igst,
             SUM(ri.sri_cess_amt) AS cess, SUM(ri.sri_acess_amt) AS acess, SUM(ri.sri_cogs_amt) AS cogs,
             SUM(COALESCE(ri.sri_net_gross, 0)) AS net_gross, SUM(COALESCE(ri.sri_chrg_before_tax, 0)) AS chrg_before,
             SUM(ri.sri_loyalty_pv) AS loyalty_pv, SUM(ri.sri_loyalty_points) AS loyalty_points,
             SUM(COALESCE(ri.sri_weight_qty, 0)) AS weight
        FROM sales.sale_return_item ri
        JOIN sales.sale_return r ON r.sr_id = ri.sri_return_id AND r.sr_acc_year = ri.sri_acc_year
        LEFT JOIN inventory.item_unit_conversion ru ON ru.iuc_id = ri.sri_item_unit_id
       WHERE r.sr_bill_id = ${bill.sbId}::uuid AND r.sr_bill_acc_year = ${bill.accYear}::char(9)
         AND r.sr_status = 'POSTED' AND r.sr_is_deleted = false AND ri.sri_is_deleted = false
         AND ri.sri_bill_item_id IS NOT NULL
         AND r.sr_id <> ${excludeSrId ?? NIL}::uuid
       GROUP BY ri.sri_bill_item_id`;
    const out = new Map<string, PriorBack>();
    for (const r of rows) {
      const parts = zeroParts();
      parts.grossAmt = dec(r.gross);
      parts.itemDiscAmt = dec(r.item_disc);
      parts.splDiscAmt = dec(r.spl_disc);
      parts.schDiscAmt = dec(r.sch_disc);
      parts.billSchAmt = dec(r.bill_sch);
      parts.addlDisc1Amt = dec(r.addl1);
      parts.addlDisc2Amt = dec(r.addl2);
      parts.cashDiscAmt = dec(r.cash_disc);
      parts.taxableAmt = dec(r.taxable);
      parts.cgstAmt = dec(r.cgst);
      parts.sgstAmt = dec(r.sgst);
      parts.igstAmt = dec(r.igst);
      parts.cessAmt = dec(r.cess);
      parts.acessAmt = dec(r.acess);
      parts.cogsAmt = dec(r.cogs);
      parts.netGross = dec(r.net_gross);
      parts.chrgBeforeTax = dec(r.chrg_before);
      parts.loyaltyPv = dec(r.loyalty_pv);
      parts.loyaltyPoints = dec(r.loyalty_points);
      parts.weightQty = dec(r.weight);
      out.set(String(r.id), { base: dec(r.base), parts });
    }
    return out;
  }

  /** The header figures the posted returns took: round off, cash discount, refunds. */
  async priorHeader(
    c: Client,
    bill: Pick<BillHeaderFacts, 'sbId' | 'accYear'>,
    excludeSrId: string | null,
  ): Promise<PriorHeader> {
    const [r] = await c.$queryRaw<Record<string, unknown>[]>`
      SELECT COALESCE(SUM(sr_round_off), 0) AS round_off, COALESCE(SUM(sr_cash_disc), 0) AS cash_disc,
             COALESCE(SUM(sr_refund_amt), 0) AS refund, COALESCE(SUM(sr_points_back_amt), 0) AS points_back,
             COALESCE(SUM(sr_voucher_share_amt), 0) AS voucher_share,
             COALESCE(SUM(COALESCE(sr_agent_comm_amt, 0)), 0) AS agent_comm,
             COALESCE(SUM(sr_loyalty_reverse_points), 0) AS loyalty_reversed,
             COALESCE(SUM(sr_points_back), 0) AS points_back_units
        FROM sales.sale_return
       WHERE sr_bill_id = ${bill.sbId}::uuid AND sr_bill_acc_year = ${bill.accYear}::char(9)
         AND sr_status = 'POSTED' AND sr_is_deleted = false AND sr_id <> ${excludeSrId ?? NIL}::uuid`;
    return {
      roundOff: dec(r?.round_off),
      cashDisc: dec(r?.cash_disc),
      refund: dec(r?.refund),
      pointsBackAmt: dec(r?.points_back),
      voucherShare: dec(r?.voucher_share),
      agentComm: dec(r?.agent_comm),
      loyaltyReversed: dec(r?.loyalty_reversed),
      pointsBack: dec(r?.points_back_units),
    };
  }

  /**
   * D74 — the schemes the bill's points moved under: the one its EARN row
   * names (a return takes back the way it earned) and the one its REDEEM rows
   * name (points given back are counted the way it redeems). null when the
   * bill has no such row, or the row names no scheme.
   */
  async billLoyaltyRules(
    c: Client,
    bill: Pick<BillHeaderFacts, 'sbId' | 'accYear'>,
  ): Promise<{ earn: LoyaltyRule | null; redeem: LoyaltyRule | null }> {
    const rows = await c.$queryRaw<
      {
        txn: string;
        lsc_id: string;
        lsc_points_decimals: number | null;
        lsc_rounding_method: string | null;
        lsc_return_mode: string | null;
      }[]
    >`
      SELECT DISTINCT ON (l.lld_txn_type) l.lld_txn_type AS txn, s.lsc_id,
             s.lsc_points_decimals, s.lsc_rounding_method, s.lsc_return_mode
        FROM sales.loyalty_ledger l
        JOIN sales.loyalty_scheme s ON s.lsc_id = l.lld_lsc_id
       WHERE l.lld_src_doc_type = 'SALE_BILL' AND l.lld_src_doc_id = ${bill.sbId}::uuid
         AND l.lld_src_acc_year = ${bill.accYear}::char(9)
         AND l.lld_txn_type IN ('EARN', 'REDEEM')
         AND l.lld_reversal_of_id IS NULL AND l.lld_is_deleted = false
       ORDER BY l.lld_txn_type, l.lld_row_no`;
    const ruleOf = (txn: string): LoyaltyRule | null => {
      const r = rows.find((x) => x.txn === txn);
      return r
        ? {
            lscId: String(r.lsc_id),
            decimals: Number(r.lsc_points_decimals ?? 0),
            rounding: r.lsc_rounding_method,
            returnMode: r.lsc_return_mode,
          }
        : null;
    };
    return { earn: ruleOf('EARN'), redeem: ruleOf('REDEEM') };
  }

  /** D51 — what other DRAFT returns hold of each bill line (they hold nothing; this is INFO). */
  async onDrafts(
    c: Client,
    bill: Pick<BillHeaderFacts, 'sbId' | 'accYear'>,
    excludeSrId: string | null,
  ): Promise<Map<string, DraftHold>> {
    const rows = await c.$queryRaw<{ id: string; base: Prisma.Decimal; refnos: string[] }[]>`
      SELECT ri.sri_bill_item_id AS id,
             SUM((ri.sri_return_qty + ri.sri_free_qty)
                 * CASE WHEN ri.sri_to_base_factor > 0 THEN ri.sri_to_base_factor
                        ELSE COALESCE(NULLIF(ru.iuc_to_base_factor, 0), 1) END) AS base,
             array_agg(DISTINCT r.sr_return_refno ORDER BY r.sr_return_refno) AS refnos
        FROM sales.sale_return_item ri
        JOIN sales.sale_return r ON r.sr_id = ri.sri_return_id AND r.sr_acc_year = ri.sri_acc_year
        LEFT JOIN inventory.item_unit_conversion ru ON ru.iuc_id = ri.sri_item_unit_id
       WHERE r.sr_bill_id = ${bill.sbId}::uuid AND r.sr_bill_acc_year = ${bill.accYear}::char(9)
         AND r.sr_status = 'DRAFT' AND r.sr_is_deleted = false AND ri.sri_is_deleted = false
         AND ri.sri_bill_item_id IS NOT NULL
         AND (ri.sri_return_qty + ri.sri_free_qty) > 0
         AND r.sr_id <> ${excludeSrId ?? NIL}::uuid
       GROUP BY ri.sri_bill_item_id`;
    return new Map(rows.map((r) => [String(r.id), { base: dec(r.base), refnos: r.refnos ?? [] }]));
  }

  /** The bill's charge rows, with what the posted returns gave back of each (magnitudes). */
  async billCharges(
    c: Client,
    bill: Pick<BillHeaderFacts, 'sbId' | 'accYear'>,
    excludeSrId: string | null,
  ): Promise<BillChargeFacts[]> {
    const rows = await c.$queryRaw<Record<string, unknown>[]>`
      SELECT cd.cd_id, cd.cd_acc_year, cd.cd_chg_id, cd.cd_chg_name, cd.cd_type, cd.cd_before_tax, cd.cd_sep_post,
             cd.cd_tax_apl, cd.cd_method, cd.cd_role, cd.cd_apply_on, cd.cd_ledger_code, led.led_name,
             cd.cd_tax_code, cd.cd_hsn, cd.cd_unit, cd.cd_tax_perc, cd.cd_cgst_perc, cd.cd_sgst_perc,
             cd.cd_igst_perc, cd.cd_cess_perc,
             ABS(COALESCE(cd.cd_amount, 0)) AS amount, ABS(COALESCE(cd.cd_cgst_amt, 0)) AS cgst,
             ABS(COALESCE(cd.cd_sgst_amt, 0)) AS sgst, ABS(COALESCE(cd.cd_igst_amt, 0)) AS igst,
             ABS(COALESCE(cd.cd_cess_amt, 0)) AS cess,
             COALESCE(b.amount, 0) AS b_amount, COALESCE(b.cgst, 0) AS b_cgst, COALESCE(b.sgst, 0) AS b_sgst,
             COALESCE(b.igst, 0) AS b_igst, COALESCE(b.cess, 0) AS b_cess
        FROM public.txn_charge_detail cd
        LEFT JOIN accounts.acc_ledger_master led ON led.led_id = cd.cd_ledger_code
        LEFT JOIN LATERAL (
          SELECT SUM(ABS(COALESCE(x.cd_amount, 0))) AS amount, SUM(ABS(COALESCE(x.cd_cgst_amt, 0))) AS cgst,
                 SUM(ABS(COALESCE(x.cd_sgst_amt, 0))) AS sgst, SUM(ABS(COALESCE(x.cd_igst_amt, 0))) AS igst,
                 SUM(ABS(COALESCE(x.cd_cess_amt, 0))) AS cess
            FROM public.txn_charge_detail x
            JOIN sales.sale_return r ON r.sr_id = x.cd_doc_id AND r.sr_acc_year = x.cd_acc_year
           WHERE x.cd_doc_type = 'SALE_RETURN' AND x.cd_src_cd_id = cd.cd_id AND x.cd_is_deleted = false
             AND r.sr_status = 'POSTED' AND r.sr_is_deleted = false AND r.sr_id <> ${excludeSrId ?? NIL}::uuid
        ) b ON true
       WHERE cd.cd_doc_type = 'INVOICE' AND cd.cd_doc_id = ${bill.sbId}::uuid
         AND cd.cd_acc_year = ${bill.accYear}::char(9) AND cd.cd_is_deleted = false
       ORDER BY cd.cd_slno, cd.cd_id`;
    return rows.map((r) => {
      const fig = (p: string): ChargeFigures => ({
        amount: dec(r[`${p}amount`]),
        cgst: dec(r[`${p}cgst`]),
        sgst: dec(r[`${p}sgst`]),
        igst: dec(r[`${p}igst`]),
        cess: dec(r[`${p}cess`]),
      });
      return {
        cdId: String(r.cd_id),
        accYear: String(r.cd_acc_year).trim(),
        chgId: String(r.cd_chg_id),
        name: str(r.cd_chg_name),
        type: r.cd_type === 'DEDUCT' ? 'DEDUCT' : 'ADD',
        beforeTax: r.cd_before_tax === true,
        sepPost: r.cd_sep_post === true,
        taxApl: r.cd_tax_apl === true,
        method: str(r.cd_method),
        role: str(r.cd_role),
        applyOn: str(r.cd_apply_on),
        ledgerId: String(r.cd_ledger_code),
        ledgerName: str(r.led_name),
        taxCode: str(r.cd_tax_code),
        hsn: str(r.cd_hsn),
        unit: str(r.cd_unit),
        taxPerc: dec(r.cd_tax_perc),
        cgstPerc: dec(r.cd_cgst_perc),
        sgstPerc: dec(r.cd_sgst_perc),
        igstPerc: dec(r.cd_igst_perc),
        cessPerc: dec(r.cd_cess_perc),
        onBill: fig(''),
        backBefore: fig('b_'),
      } satisfies BillChargeFacts;
    });
  }

  /**
   * The return's OWN charge rows with their carry keys — the charge-detail
   * payload leaves cd_src_cd_id / cd_carry_basis / cd_carried_amt out, and
   * /post re-works the give-back from them.
   */
  async returnCharges(c: Client, srId: string | null | undefined): Promise<ReturnChargeRow[]> {
    if (!srId) {
      return [];
    }
    const rows = await c.$queryRaw<Record<string, unknown>[]>`
      SELECT cd_id, cd_src_cd_id, cd_src_acc_year, cd_carry_basis, cd_amount, cd_carried_amt
        FROM public.txn_charge_detail
       WHERE cd_doc_type = 'SALE_RETURN' AND cd_doc_id = ${srId}::uuid AND cd_is_deleted = false`;
    return rows.map((r) => ({
      cdId: String(r.cd_id),
      cdSrcCdId: str(r.cd_src_cd_id),
      cdSrcAccYear: str(r.cd_src_acc_year)?.trim() ?? null,
      cdCarryBasis: str(r.cd_carry_basis),
      cdAmount: dec(r.cd_amount),
      cdCarriedAmt: dec(r.cd_carried_amt),
    }));
  }

  /**
   * The customer's open receivables in this branch, this bill first, then the
   * Receipt's order (`accounts.receipt_bill_sort`: DUE_DATE, else BILL_DATE),
   * refno breaking ties (D1). `lock` takes them FOR UPDATE, in id order.
   *
   * `addBack` (the /validate preview of an amend only — UnwindAddBack.bills):
   * each bill owes its pending PLUS what the amended return's own unwind will
   * give back on it, and a bill that return cleared in full (pending 0) is
   * open again. The amend's own read runs after its unwind and passes none.
   */
  async openBills(
    c: Client,
    q: {
      companyId: string;
      branchId: string;
      partyId: string;
      firstSbId: string | null;
      sort: string | null;
      lock?: boolean;
      addBack?: ReadonlyMap<string, Dec> | null;
    },
  ): Promise<OpenBillFacts[]> {
    const back = q.addBack ?? new Map<string, Dec>();
    const backIds = [...back.keys()];
    if (q.lock) {
      await c.$queryRaw`
        SELECT abl_id FROM accounts.acc_bill_balance
         WHERE abl_company_id = ${q.companyId}::uuid AND abl_branch_id = ${q.branchId}::uuid
           AND abl_party_id = ${q.partyId}::uuid AND abl_dr_cr = 'DR' AND abl_is_deleted = false
           AND abl_is_active = true
           AND (COALESCE(abl_pending_amount, 0) > 0 OR abl_id = ANY(${backIds}::uuid[]))
         ORDER BY abl_id
           FOR UPDATE`;
    }
    const byBillDate = (q.sort ?? '').toUpperCase() === 'BILL_DATE';
    const rows = await c.$queryRaw<Record<string, unknown>[]>`
      SELECT abl_id, abl_acc_year, abl_bill_type, abl_doc_refno, abl_doc_date, abl_due_date,
             abl_bill_amount, COALESCE(abl_pending_amount, 0) AS pending, abl_alloc_amount,
             abl_src_doc_type, abl_src_doc_id, abl_src_acc_year
        FROM accounts.acc_bill_balance
       WHERE abl_company_id = ${q.companyId}::uuid AND abl_branch_id = ${q.branchId}::uuid
         AND abl_party_id = ${q.partyId}::uuid AND abl_dr_cr = 'DR'
         AND abl_bill_type IN ('SALES', 'OPENING', 'INTEREST', 'JOURNAL', 'PURCHASE_RETURN')
         AND abl_is_deleted = false AND abl_is_active = true
         AND (COALESCE(abl_pending_amount, 0) > 0 OR abl_id = ANY(${backIds}::uuid[]))
       ORDER BY (abl_src_doc_type = 'SALE_BILL' AND abl_src_doc_id = ${q.firstSbId ?? NIL}::uuid) DESC,
                CASE WHEN ${byBillDate} THEN abl_doc_date ELSE COALESCE(abl_due_date, abl_doc_date) END,
                abl_doc_refno`;
    return rows
      .map((r) => {
        const ablId = String(r.abl_id);
        const given = back.get(ablId) ?? ZERO;
        return {
          ablId,
          ablAccYear: String(r.abl_acc_year).trim(),
          billType: String(r.abl_bill_type),
          refno: str(r.abl_doc_refno),
          docDate: iso(r.abl_doc_date),
          dueDate: iso(r.abl_due_date),
          billAmount: dec(r.abl_bill_amount),
          pending: dec(r.pending).plus(given),
          alloc: dec(r.abl_alloc_amount).minus(given),
          srcDocType: str(r.abl_src_doc_type),
          srcDocId: str(r.abl_src_doc_id),
          srcAccYear: str(r.abl_src_acc_year)?.trim() ?? null,
        };
      })
      .filter((b) => b.pending.gt(0));
  }

  /**
   * UnwindAddBack — what the amend of `srId` would give back when it unwinds,
   * or null when `srId` names no POSTED return (a draft, a first post: nothing
   * to unwind). The set-offs follow the unwind exactly: its targets are the
   * note's own Adjust at Post (OWN_ADJUST_AT_POST, as adjustedAtPost reads
   * them: a voucher-less NOTE_ADJUST against a DR receivable created before
   * the note), and what comes off each is every live, unreversed invoice-side
   * row between it and the note (reverseBillAdjustmentsWith).
   */
  async unwindAddBack(c: Client, srId: string | null | undefined): Promise<UnwindAddBack | null> {
    if (!srId || !/^[0-9a-f-]{36}$/i.test(srId)) {
      return null;
    }
    const [head] = await c.$queryRaw<
      {
        sr_status: string;
        note_id: string | null;
        note_year: string | null;
        note_pending: Prisma.Decimal | null;
        note_active: boolean | null;
        note_party: string | null;
      }[]
    >`
      SELECT r.sr_status, n.abl_id AS note_id, n.abl_acc_year AS note_year,
             COALESCE(n.abl_pending_amount, 0) AS note_pending, n.abl_is_active AS note_active,
             n.abl_party_id AS note_party
        FROM sales.sale_return r
        LEFT JOIN LATERAL (
              SELECT abl_id, abl_acc_year, abl_pending_amount, abl_is_active, abl_party_id
                FROM accounts.acc_bill_balance
               WHERE abl_src_doc_type = 'SALE_RETURN' AND abl_src_doc_id = r.sr_id
                 AND abl_acc_year = r.sr_acc_year AND abl_is_deleted = false
               LIMIT 1) n ON true
       WHERE r.sr_id = ${srId}::uuid AND r.sr_is_deleted = false`;
    if (!head || head.sr_status !== 'POSTED') {
      return null;
    }
    if (!head.note_id || !head.note_year) {
      return { bills: new Map(), balance: ZERO, partyId: null };
    }
    const rows = await c.$queryRaw<{ abl_id: string; active: boolean; amt: Prisma.Decimal }[]>`
      SELECT k.abl_id, bool_or(k.abl_is_active) AS active, SUM(j.abj_amount) AS amt
        FROM accounts.acc_bill_balance n
        JOIN accounts.acc_bill_adjustment j
          ON j.abj_against_bill_id = n.abl_id AND j.abj_against_bill_acc_year = n.abl_acc_year
        JOIN accounts.acc_bill_balance k ON k.abl_id = j.abj_bill_id AND k.abl_acc_year = j.abj_bill_acc_year
       WHERE n.abl_id = ${head.note_id}::uuid AND n.abl_acc_year = ${head.note_year}::char(9)
         AND j.abj_is_deleted = false AND j.abj_reversal_of_id IS NULL AND j.abj_voucher_id IS NULL
         AND j.abj_adj_type = 'NOTE_ADJUST'
         AND NOT EXISTS (SELECT 1 FROM accounts.acc_bill_adjustment x WHERE x.abj_reversal_of_id = j.abj_id AND x.abj_is_deleted = false)
         AND k.abl_dr_cr = 'DR' AND k.abl_is_deleted = false AND k.abl_created_on < n.abl_created_on
       GROUP BY k.abl_id`;
    const bills = new Map<string, Dec>();
    // The note leaves the balance (a CR: its retirement raises it), the bills owe again.
    let balance = head.note_active ? dec(head.note_pending) : ZERO;
    for (const r of rows) {
      const amt = dec(r.amt);
      if (amt.lte(0)) {
        continue;
      }
      bills.set(String(r.abl_id), amt);
      if (r.active) {
        balance = balance.plus(amt);
      }
    }
    return { bills, balance, partyId: head.note_party ? String(head.note_party) : null };
  }

  /** The bill's tender rows, as it was paid (D33: the refund grid starts from them). */
  async billTenderRows(
    c: Client,
    bill: Pick<BillHeaderFacts, 'sbId' | 'accYear'>,
  ): Promise<BillTenderRow[]> {
    const rows = await c.$queryRaw<Record<string, unknown>[]>`
      SELECT td.td_id, td.td_tender_id, td.td_tender_type_id, t.tnd_name, td.td_tender_ledger_id,
             td.td_amount, td.td_units_used, td.td_conversion_rate
        FROM accounts.acc_tender_detail td
        LEFT JOIN accounts.acc_tender_master t ON t.tnd_id = td.td_tender_id
       WHERE td.td_src_doc_type = 'SALE_BILL' AND td.td_src_doc_id = ${bill.sbId}::uuid
         AND td.td_acc_year = ${bill.accYear}::char(9) AND td.td_is_deleted = false
         AND COALESCE(td.td_is_voided, false) = false
       ORDER BY td.td_row_no`;
    return rows.map((r) => ({
      tdId: String(r.td_id),
      tenderId: str(r.td_tender_id),
      tenderTypeId: Number(r.td_tender_type_id),
      name: str(r.tnd_name),
      ledgerId: str(r.td_tender_ledger_id),
      amount: dec(r.td_amount),
      unitsUsed: dec(r.td_units_used),
      conversionRate: dec(r.td_conversion_rate),
    }));
  }

  /**
   * Plan v5 D3 (user 11-13) — money the customer paid on this bill AFTER it was
   * raised: Receipt allocations on its live SALE_BILL receivable, in money
   * (CASH · CARD · UPI · WALLET · CHEQUE · BANK · MIXED, the receipt's pooled
   * instant money). Not counted: the bill's own counter rows (they name one of
   * its tender rows, re-tenders included: those are `billTenderRows`); credit
   * notes, advances and other set-offs (NOTE_ADJUST / ADVANCE_ADJUST /
   * TRANSFER); a receipt's TDS / claim / journal deduction lines; discounts and
   * write-offs; a post-dated cheque before its date (the recompute's rule).
   * A cancelled, amended or bounced receipt files negative reversal rows with
   * the same mode, and a removed one is soft deleted, so the sum nets them out.
   */
  async receivedLater(c: Client, bill: Pick<BillHeaderFacts, 'sbId' | 'accYear'>): Promise<Dec> {
    const [r] = await c.$queryRaw<{ amt: Prisma.Decimal | null }[]>`
      SELECT COALESCE(SUM(a.abj_amount), 0) AS amt
        FROM accounts.acc_bill_balance b
        JOIN accounts.acc_bill_adjustment a
          ON a.abj_bill_id = b.abl_id AND a.abj_bill_acc_year = b.abl_acc_year
       WHERE b.abl_src_doc_type = 'SALE_BILL' AND b.abl_src_doc_id = ${bill.sbId}::uuid
         AND b.abl_acc_year = ${bill.accYear}::char(9)
         AND b.abl_dr_cr = 'DR' AND b.abl_is_deleted = false
         AND a.abj_is_deleted = false AND a.abj_adj_type = 'ALLOCATION'
         AND a.abj_settlement_mode IN ('CASH', 'CARD', 'UPI', 'WALLET', 'CHEQUE', 'BANK', 'MIXED')
         AND NOT (a.abj_is_post_dated AND a.abj_adj_date > CURRENT_DATE)
         AND NOT EXISTS (
               SELECT 1 FROM accounts.acc_tender_detail td
                WHERE td.td_id = a.abj_tender_id AND td.td_src_doc_type = 'SALE_BILL'
                  AND td.td_src_doc_id = ${bill.sbId}::uuid)`;
    return Prisma.Decimal.max(ZERO, dec(r?.amt));
  }

  /**
   * Review 11-14 N9 — of `years`, the ones the company may not write to: a
   * `fiscal_years` row that is not OPEN, or whose lock date has come (the
   * rule assertAccYearWritable applies). A year with no row is writable.
   * Adjust at Post writes its set-off rows in the BILL's year, so a bill of
   * such a year is left out of the proposal and refused in a split.
   */
  async closedYears(c: Client, companyId: string, years: readonly string[]): Promise<Set<string>> {
    const want = [...new Set(years.map((y) => y.trim()).filter(Boolean))];
    if (want.length === 0) {
      return new Set();
    }
    const rows = await c.$queryRaw<{ y: string }[]>`
      SELECT fy_year_name AS y FROM public.fiscal_years
       WHERE comp_id = ${companyId}::uuid AND is_deleted = false
         AND fy_year_name = ANY(${want}::text[])
         AND (fy_status <> 'OPEN' OR (fy_lock_date IS NOT NULL AND fy_lock_date <= CURRENT_DATE))`;
    return new Set(rows.map((r) => String(r.y).trim()));
  }

  /** The customer's bill-wise balance: Σ open DR − Σ open CR (receivable positive). */
  async customerBalance(c: Client, companyId: string, partyId: string): Promise<Dec> {
    const [r] = await c.$queryRaw<{ bal: Prisma.Decimal | null }[]>`
      SELECT SUM(CASE WHEN abl_dr_cr = 'DR' THEN COALESCE(abl_pending_amount, 0)
                      ELSE -COALESCE(abl_pending_amount, 0) END) AS bal
        FROM accounts.acc_bill_balance
       WHERE abl_company_id = ${companyId}::uuid AND abl_party_id = ${partyId}::uuid
         AND abl_is_deleted = false AND abl_is_active = true`;
    return dec(r?.bal);
  }

  /** Every approval request filed for this return, newest first (grid 209 reads the same rows). */
  async approvalsOf(c: Client, srId: string | null | undefined): Promise<ReturnApprovalRow[]> {
    if (!srId) {
      return [];
    }
    const rows = await c.$queryRaw<Record<string, unknown>[]>`
      SELECT a.tap_id, a.tap_acc_year, a.tap_event_code, a.tap_status, a.tap_amount,
             a.tap_requested_by, rq.usr_login_name AS requested_name, a.tap_requested_on, a.tap_request_note,
             a.tap_decided_by, dc.usr_login_name AS decided_name, a.tap_decided_on, a.tap_decision_note,
             a.tap_rule_snapshot ->> 'usedOn' AS used_on
        FROM accounts.till_approval a
        LEFT JOIN public.user_master rq ON rq.usr_id = a.tap_requested_by
        LEFT JOIN public.user_master dc ON dc.usr_id = a.tap_decided_by
       WHERE a.tap_src_doc_type = 'SALE_RETURN' AND a.tap_src_doc_id = ${srId}::uuid
         AND a.tap_is_deleted = false
       ORDER BY a.tap_requested_on DESC, a.tap_id DESC`;
    return rows.map((r) => ({
      tapId: String(r.tap_id),
      accYear: String(r.tap_acc_year).trim(),
      event: String(r.tap_event_code),
      status: String(r.tap_status),
      amount: dec(r.tap_amount),
      requestedBy: str(r.tap_requested_by),
      requestedByName: str(r.requested_name),
      requestedOn: (r.tap_requested_on as Date | null) ?? null,
      requestNote: str(r.tap_request_note),
      decidedBy: str(r.tap_decided_by),
      decidedByName: str(r.decided_name),
      decidedOn: (r.tap_decided_on as Date | null) ?? null,
      decisionNote: str(r.tap_decision_note),
      usedOn: str(r.used_on),
    }));
  }

  /** A till session's status, or null when the id names no till session (an ungoverned counter). */
  async sessionOf(
    c: Client,
    sessionId: string | null | undefined,
  ): Promise<{ status: string; sessionNo: string | null } | null> {
    if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
      return null;
    }
    const [r] = await c.$queryRaw<{ tss_status: string; tss_session_no: unknown }[]>`
      SELECT tss_status, tss_session_no FROM accounts.till_session
       WHERE tss_id = ${sessionId}::uuid AND tss_is_deleted = false`;
    return r ? { status: r.tss_status, sessionNo: str(r.tss_session_no) } : null;
  }

  /** The promotion schemes the bill's lines name, with their active slabs (D47). */
  async schemes(c: Client, ids: readonly string[]): Promise<Map<string, SchemeFacts>> {
    const want = [...new Set(ids.filter(Boolean))];
    const out = new Map<string, SchemeFacts>();
    if (want.length === 0) {
      return out;
    }
    const rows = await c.$queryRaw<Record<string, unknown>[]>`
      SELECT p.prm_id, p.prm_code, p.prm_name, p.prm_apply_on, p.prm_benefit, p.prm_include_tax,
             p.prm_min_qty, p.prm_min_bill_amount, s.prs_exceeds, s.prs_upto, s.prs_benefit
        FROM sales.promotion_scheme p
        LEFT JOIN sales.promotion_scheme_slab s
               ON s.prs_prm_id = p.prm_id AND s.prs_is_active = true AND s.prs_is_deleted = false
       WHERE p.prm_id = ANY(${want}::uuid[])
       ORDER BY p.prm_id, s.prs_slno`;
    for (const r of rows) {
      const id = String(r.prm_id);
      const s =
        out.get(id) ??
        ({
          prmId: id,
          code: str(r.prm_code),
          name: str(r.prm_name),
          applyOn: str(r.prm_apply_on),
          benefit: str(r.prm_benefit),
          includeTax: r.prm_include_tax === true,
          minQty: dec(r.prm_min_qty),
          minBillAmount: dec(r.prm_min_bill_amount),
          slabs: [],
        } satisfies SchemeFacts);
      if (r.prs_exceeds !== null && r.prs_exceeds !== undefined) {
        s.slabs.push({
          exceeds: dec(r.prs_exceeds),
          upto: dec(r.prs_upto),
          benefit: str(r.prs_benefit),
        });
      }
      out.set(id, s);
    }
    return out;
  }

  /** Item unit conversions by id (the units a return line names). */
  async units(c: Client, unitIds: readonly string[]): Promise<Map<string, UnitRow>> {
    const ids = [...new Set(unitIds.filter(Boolean))];
    if (ids.length === 0) {
      return new Map();
    }
    const rows = await c.$queryRaw<Record<string, unknown>[]>`
      SELECT iuc.iuc_id, iuc.iuc_item_id, iuc.iuc_to_base_factor, iuc.iuc_uom_weight, iuc.iuc_is_base_unit, um.unit_name
        FROM inventory.item_unit_conversion iuc
        LEFT JOIN inventory.item_unit_master um ON um.unit_id = iuc.iuc_unit_id
       WHERE iuc.iuc_id = ANY(${ids}::uuid[]) AND iuc.iuc_is_deleted = false`;
    return new Map(rows.map((r) => [String(r.iuc_id), unitRowOf(r)]));
  }

  /**
   * /get — the names a saved line shows: item, unit and godown, by id and
   * whatever their state today (a line keeps naming a since-deleted unit).
   * A no-bill return reloads with them (it has no /bill-lines to borrow from).
   */
  async lineNames(
    c: Client,
    lines: readonly { itemId: unknown; itemUnitId: unknown; godownId: unknown }[],
  ): Promise<{
    items: Map<string, string>;
    units: Map<string, string>;
    godowns: Map<string, string>;
  }> {
    const ids = (pick: (l: (typeof lines)[number]) => unknown): string[] => [
      ...new Set(lines.map(pick).filter((v): v is string => typeof v === 'string' && v !== '')),
    ];
    const itemIds = ids((l) => l.itemId);
    const unitIds = ids((l) => l.itemUnitId);
    const godownIds = ids((l) => l.godownId);
    type NameRow = { id: string; name: string | null };
    const [items, units, godowns] = await Promise.all([
      itemIds.length === 0
        ? ([] as NameRow[])
        : c.$queryRaw<NameRow[]>`
            SELECT item_id AS id, item_name_en AS name FROM inventory.item_master
             WHERE item_id = ANY(${itemIds}::uuid[])`,
      unitIds.length === 0
        ? ([] as NameRow[])
        : c.$queryRaw<NameRow[]>`
            SELECT iuc.iuc_id AS id, um.unit_name AS name
              FROM inventory.item_unit_conversion iuc
              LEFT JOIN inventory.item_unit_master um ON um.unit_id = iuc.iuc_unit_id
             WHERE iuc.iuc_id = ANY(${unitIds}::uuid[])`,
      godownIds.length === 0
        ? ([] as NameRow[])
        : c.$queryRaw<NameRow[]>`
            SELECT gdl_id AS id, gdl_name AS name FROM inventory.godown_locations
             WHERE gdl_id = ANY(${godownIds}::uuid[])`,
    ]);
    const byId = (rows: NameRow[]) =>
      new Map(rows.filter((r) => r.name !== null).map((r) => [r.id, r.name as string]));
    return { items: byId(items), units: byId(units), godowns: byId(godowns) };
  }

  /** Every live unit of each item, smallest slno first (D52). */
  async itemUnits(c: Client, itemIds: readonly string[]): Promise<Map<string, UnitRow[]>> {
    const ids = [...new Set(itemIds.filter(Boolean))];
    const out = new Map<string, UnitRow[]>();
    if (ids.length === 0) {
      return out;
    }
    const rows = await c.$queryRaw<Record<string, unknown>[]>`
      SELECT iuc.iuc_id, iuc.iuc_item_id, iuc.iuc_to_base_factor, iuc.iuc_uom_weight, iuc.iuc_is_base_unit, um.unit_name
        FROM inventory.item_unit_conversion iuc
        LEFT JOIN inventory.item_unit_master um ON um.unit_id = iuc.iuc_unit_id
       WHERE iuc.iuc_item_id = ANY(${ids}::uuid[]) AND iuc.iuc_is_deleted = false
       ORDER BY iuc.iuc_item_id, iuc.iuc_unit_slno`;
    for (const r of rows) {
      const u = unitRowOf(r);
      out.set(u.itemId, [...(out.get(u.itemId) ?? []), u]);
    }
    return out;
  }

  /** Item barcodes (item_ean_codes), per item. */
  async barcodes(
    c: Client,
    itemIds: readonly string[],
  ): Promise<Map<string, { code: string; itemUnitId: string | null }[]>> {
    const ids = [...new Set(itemIds.filter(Boolean))];
    const out = new Map<string, { code: string; itemUnitId: string | null }[]>();
    if (ids.length === 0) {
      return out;
    }
    const rows = await c.$queryRaw<
      { ean_item_id: string; ean_code: string; ean_uc_unit_id: string | null }[]
    >`
      SELECT ean_item_id, ean_code, ean_uc_unit_id FROM inventory.item_ean_codes
       WHERE ean_item_id = ANY(${ids}::uuid[]) AND ean_is_deleted = false AND ean_is_active = true
       ORDER BY ean_item_id, ean_sl_no`;
    for (const r of rows) {
      out.set(r.ean_item_id, [
        ...(out.get(r.ean_item_id) ?? []),
        { code: r.ean_code, itemUnitId: r.ean_uc_unit_id },
      ]);
    }
    return out;
  }

  /** The lots a return names (no-bill F12 picks, or the bill's), for the expiry warning (D57). */
  async lots(c: Client, lotIds: readonly string[]): Promise<Map<string, LotFacts>> {
    const ids = [...new Set(lotIds.filter(Boolean))];
    if (ids.length === 0) {
      return new Map();
    }
    const rows = await c.$queryRaw<
      { slt_id: string; slt_batch_no: string | null; slt_expiry_date: Date | null }[]
    >`
      SELECT slt_id, slt_batch_no, slt_expiry_date FROM stock.stock_lot WHERE slt_id = ANY(${ids}::uuid[])`;
    return new Map(
      rows.map((r) => [
        r.slt_id,
        { lotId: r.slt_id, batchNo: r.slt_batch_no, expiryDate: iso(r.slt_expiry_date) },
      ]),
    );
  }

  /** The bill's tenders by kind (D3 / D48): money, points, gift voucher, on account. */
  async billTenders(
    c: Client,
    bill: Pick<BillHeaderFacts, 'sbId' | 'accYear'>,
  ): Promise<BillTenderFacts> {
    const [r] = await c.$queryRaw<Record<string, unknown>[]>`
      SELECT COALESCE(SUM(td_amount) FILTER (WHERE td_tender_type_id NOT IN (7, 8, 9, 10, 11)), 0) AS money,
             COALESCE(SUM(td_amount) FILTER (WHERE td_tender_type_id = 10), 0) AS points,
             COALESCE(SUM(td_units_used) FILTER (WHERE td_tender_type_id = 10), 0) AS points_units,
             COALESCE(SUM(td_amount) FILTER (WHERE td_tender_type_id = 11), 0) AS voucher,
             COALESCE(SUM(td_amount) FILTER (WHERE td_tender_type_id IN (7, 8, 9)), 0) AS credit
        FROM accounts.acc_tender_detail
       WHERE td_src_doc_type = 'SALE_BILL' AND td_src_doc_id = ${bill.sbId}::uuid
         AND td_acc_year = ${bill.accYear}::char(9) AND td_is_deleted = false
         AND COALESCE(td_is_voided, false) = false`;
    return {
      money: dec(r?.money),
      points: dec(r?.points),
      pointsUnits: dec(r?.points_units),
      voucher: dec(r?.voucher),
      credit: dec(r?.credit),
    };
  }

  /**
   * What the bill still owes (its live SALE_BILL balance row) — plus, with
   * `addBack` (UnwindAddBack.bills of the return being amended), what that
   * return's own unwind gives back on it.
   */
  async billDue(
    c: Client,
    bill: Pick<BillHeaderFacts, 'sbId' | 'accYear'>,
    addBack?: ReadonlyMap<string, Dec> | null,
  ): Promise<Dec> {
    const [r] = await c.$queryRaw<{ abl_id: string; due: Prisma.Decimal | null }[]>`
      SELECT abl_id, abl_pending_amount AS due FROM accounts.acc_bill_balance
       WHERE abl_src_doc_id = ${bill.sbId}::uuid AND abl_acc_year = ${bill.accYear}::char(9)
         AND abl_src_doc_type = 'SALE_BILL' AND abl_is_deleted = false AND abl_is_active = true
       LIMIT 1`;
    return r ? dec(r.due).plus(addBack?.get(String(r.abl_id)) ?? ZERO) : ZERO;
  }

  /**
   * D56 step 2 — the customer's last posted sale of the item: the line the
   * client picked from grid 211 when it names one, else the newest in the
   * window (0 = any date). Every branch of the company (D78). Free lines never
   * price a return.
   */
  async lastSale(
    c: Client,
    q: {
      companyId: string;
      custId: string;
      itemId: string;
      windowDays: number;
      returnDate: string;
      srcItemId?: string | null;
      srcAccYear?: string | null;
    },
  ): Promise<{ facts: BillLineFacts; refno: string | null; date: string } | null> {
    const picked = q.srcItemId && q.srcAccYear;
    const rows = await c.$queryRaw<LineRow[]>`
      SELECT ${LINE_COLUMNS}, b.sb_bill_refno, b.sb_bill_date
        FROM sales.sale_bill_item bi
        JOIN sales.sale_bill b ON b.sb_id = bi.sbi_bill_id AND b.sb_acc_year = bi.sbi_acc_year
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = bi.sbi_item_unit_id
       WHERE b.sb_status = 'POSTED' AND b.sb_is_deleted = false AND bi.sbi_is_deleted = false
         AND b.sb_company_id = ${q.companyId}::uuid AND b.sb_cust_id = ${q.custId}::uuid
         AND bi.sbi_item_id = ${q.itemId}::uuid AND bi.sbi_is_free = false AND bi.sbi_bill_qty > 0
         AND (${picked ? q.srcItemId : NIL}::uuid = ${NIL}::uuid
              OR (bi.sbi_id = ${picked ? q.srcItemId : NIL}::uuid AND bi.sbi_acc_year = ${picked ? q.srcAccYear : '0000-0000'}::char(9)))
         AND (${picked ? 1 : 0}::int = 1 OR ${q.windowDays}::int <= 0
              OR b.sb_bill_date >= ${q.returnDate}::date - ${q.windowDays}::int)
         AND b.sb_bill_date <= ${q.returnDate}::date
       ORDER BY b.sb_bill_date DESC, b.sb_bill_slno DESC NULLS LAST, bi.sbi_line_no
       LIMIT 1`;
    const r = rows[0];
    if (!r) {
      return null;
    }
    return { facts: lineFactsOf(r), refno: str(r.sb_bill_refno), date: iso(r.sb_bill_date)! };
  }

  /**
   * D56 step 3 — today's price at the customer's price level, without tax,
   * per unit of `itemUnitId`. This branch's price row first, then the
   * company's; a row in another unit is converted by the factors.
   */
  async todayPrice(
    c: Client,
    q: {
      companyId: string;
      branchId: string;
      itemId: string;
      itemUnitId: string;
      priceLevel: number | null;
    },
    askFactor: Dec,
  ): Promise<TodayPriceFacts> {
    const rows = await c.$queryRaw<Record<string, unknown>[]>`
      SELECT p.ipm_uc_unit_id, iuc.iuc_to_base_factor,
             p.ipm_sales_price_a, p.ipm_sales_price_b, p.ipm_sales_price_c, p.ipm_sales_price_d,
             p.ipm_price_a_wot, p.ipm_price_b_wot, p.ipm_price_c_wot, p.ipm_price_d_wot,
             p.ipm_max_price, p.ipm_min_price, p.ipm_cost_price, p.ipm_cost_wot
        FROM inventory.item_price_master p
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = p.ipm_uc_unit_id
       WHERE p.ipm_company_id = ${q.companyId}::uuid AND p.ipm_item_id = ${q.itemId}::uuid
         AND p.ipm_is_deleted = false AND p.ipm_is_active = true
         AND (p.ipm_branch_id = ${q.branchId}::uuid OR p.ipm_branch_id IS NULL)
       ORDER BY (p.ipm_uc_unit_id = ${q.itemUnitId}::uuid) DESC, (p.ipm_branch_id IS NULL), (p.ipm_godown_id IS NULL) DESC
       LIMIT 1`;
    const [item] = await c.$queryRaw<Record<string, unknown>[]>`
      SELECT im.item_default_tax_id, im.item_hsn_code, t.tax_rate_perc, t.tax_cess_perc
        FROM inventory.item_master im
        LEFT JOIN inventory.tax_rate_master t ON t.tax_id = im.item_default_tax_id
       WHERE im.item_id = ${q.itemId}::uuid`;
    const taxPerc = dec(item?.tax_rate_perc);
    const cessPerc = dec(item?.tax_cess_perc);
    const level = q.priceLevel ?? 1;
    const p = rows[0];
    let incl = ZERO;
    let wot = ZERO;
    if (p) {
      const col = ['a', 'b', 'c', 'd'][level - 1];
      if (col) {
        incl = dec(p[`ipm_sales_price_${col}`]);
        wot = dec(p[`ipm_price_${col}_wot`]);
      } else if (level === 5) {
        incl = dec(p.ipm_max_price);
      } else if (level === 6) {
        incl = dec(p.ipm_min_price);
      } else if (level === 7) {
        incl = dec(p.ipm_cost_price);
        wot = dec(p.ipm_cost_wot);
      }
      const gross = ONE_HUNDRED.plus(taxPerc).plus(cessPerc);
      if (wot.lte(0) && incl.gt(0)) {
        wot = incl.times(ONE_HUNDRED).dividedBy(gross);
      }
      if (incl.lte(0) && wot.gt(0)) {
        incl = wot.times(gross).dividedBy(ONE_HUNDRED);
      }
      // A row in another unit: per base unit, then per the ask's unit.
      if (String(p.ipm_uc_unit_id) !== q.itemUnitId) {
        const rowFactor = resolveFactor(null, dec(p.iuc_to_base_factor));
        incl = incl.dividedBy(rowFactor).times(askFactor);
        wot = wot.dividedBy(rowFactor).times(askFactor);
      }
    }
    return {
      rateWot: wot,
      rate: incl,
      taxId: str(item?.item_default_tax_id),
      hsnCode: str(item?.item_hsn_code),
      taxPerc,
      cessPerc,
      priceLevel: level,
    };
  }

  /** The company's state code and e-invoice flag (supply nature, the register). */
  async company(
    c: Client,
    companyId: string,
  ): Promise<{ stateCode: string | null; einvoice: boolean }> {
    const [r] = await c.$queryRaw<
      { comp_state_code: string | null; comp_einvoice_applicable: boolean }[]
    >`
      SELECT comp_state_code, comp_einvoice_applicable FROM public.companys WHERE comp_id = ${companyId}::uuid`;
    return {
      stateCode: r?.comp_state_code ?? null,
      einvoice: r?.comp_einvoice_applicable ?? false,
    };
  }

  /** A stock reason's defaults (D12): give charges back, condition. */
  async reason(
    c: Client,
    reasonId: string | null | undefined,
  ): Promise<{ refundCharges: boolean | null; defaultCondition: string | null } | null> {
    if (!reasonId) {
      return null;
    }
    const [r] = await c.$queryRaw<
      { srm_refund_charges: boolean | null; srm_default_condition: string | null }[]
    >`
      SELECT srm_refund_charges, srm_default_condition FROM stock.stock_reason_master
       WHERE srm_id = ${reasonId}::uuid AND srm_is_deleted = false`;
    return r
      ? { refundCharges: r.srm_refund_charges, defaultCondition: r.srm_default_condition }
      : null;
  }
}

const ONE_HUNDRED = D(100);

function unitRowOf(r: Record<string, unknown>): UnitRow {
  return {
    itemUnitId: String(r.iuc_id),
    itemId: String(r.iuc_item_id),
    unitName: str(r.unit_name),
    factor: resolveFactor(null, dec(r.iuc_to_base_factor)),
    weight: decOrNull(r.iuc_uom_weight),
    isBase: r.iuc_is_base_unit === true,
  };
}
