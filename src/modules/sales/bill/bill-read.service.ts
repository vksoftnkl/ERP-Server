import { Injectable } from '@nestjs/common';
import { Prisma, SaleBill } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { throwSalesNotFound } from 'src/common/utils/module-service.utils';
import { LoyaltyLedgerService } from '../posting/loyalty-ledger.service';
import { SalesContextService } from '../posting/sales-context.service';
import { SalesDocBlocksService } from '../posting/sales-doc-blocks.service';
import { loadDayClosed } from '../posting/sales.guards';
import { StatutoryService } from '../../../common/posting/statutory.service';
import { TransportBandService } from '../posting/transport-band.service';
import { STATUTORY_CODES } from '../../../common/posting/statutory.types';
import {
  SALES_MENU_ID,
  TENDER_TYPE,
  daysBetween,
  isoDate,
  isoToday,
  num,
  round2,
} from '../posting/sales-doc.utils';
import type {
  BillAdjustmentSummary,
  BillErrorDetail,
  BillErrorResponse,
  BillPayload,
  BillSourceSummary,
  BillTempCreditSummary,
} from './types/bill-api.types';

/**
 * The bill's READ side beyond the row itself — HANDOVER §2.7 (the blocks a GET
 * carries), §2.8 (`open-sources`), §2.9 (`party-context`) and §2.12a
 * (`tender-context`).
 *
 * Nothing here writes. Every figure is computed at the moment of the request
 * from the tables that own it: `locks` from the GST rows, `credit.used` from
 * `acc_bill_balance`, `cashToday` from the tender rows — never from a cache on
 * the bill.
 */
@Injectable()
export class BillReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly salesContext: SalesContextService,
    private readonly docBlocks: SalesDocBlocksService,
    private readonly transportBand: TransportBandService,
    private readonly statutory: StatutoryService,
    private readonly loyalty: LoyaltyLedgerService,
  ) {}

  /** §2.7 — add `posting`, `locks`, `rights`, `sources`, `tempCredits`, `transport`. */
  async decorate(
    bill: SaleBill,
    payload: BillPayload,
    client?: Prisma.TransactionClient,
  ): Promise<BillPayload> {
    const c = client ?? this.prisma;
    const [counts, rights, sources, tempCredits, adjustments, transport] = await Promise.all([
      this.lockCounts(c, bill),
      this.salesContext.rights(SALES_MENU_ID.SALE_BILL, c),
      this.sources(c, bill),
      this.tempCredits(c, bill),
      this.adjustments(c, bill),
      this.transportBand.read(
        { docType: 'SALE_BILL', docId: bill.sbId, accYear: bill.sbAccYear },
        c,
      ),
    ]);
    const { posting, locks } = await this.docBlocks.build(
      {
        status: bill.sbStatus,
        companyId: bill.sbCompanyId,
        branchId: bill.sbBranchId,
        accYear: bill.sbAccYear,
        docDate: isoDate(bill.sbBillDate) ?? isoToday(),
        voucherId: bill.sbPostedVoucherId,
        registerId: bill.sbDocRegisterId,
        cogsAmt: num(bill.sbCogsAmt),
        loyaltyEarned: num(bill.sbLoyaltyEarned),
        loyaltyRedeemed: num(bill.sbLoyaltyRedeemed),
        returns: counts.returns,
        allocations: counts.allocations,
      },
      c,
    );
    return {
      ...payload,
      posting,
      locks,
      rights,
      sources,
      tempCredits,
      adjustments,
      transport,
      sbShipAddrId: transport?.to.addrId ?? null,
      sbShipName: transport?.to.name ?? null,
      sbShipAddr: transport?.to.addr ?? null,
      sbShipPlace: transport?.to.place ?? null,
      sbShipPin: transport?.to.pin ?? null,
      sbShipPhone: transport?.to.phone ?? null,
      sbShipStcd: transport?.to.stcd ?? null,
      sbShipGstin: transport?.to.gstin ?? null,
      sbDispatchGodownId: transport?.from.godownId ?? null,
      sbDispatchBranchId: transport?.from.branchId ?? null,
      sbTransportMode: transport?.mode ?? null,
      sbTransporterId: transport?.transporterId ?? null,
      sbTransporterName: transport?.transporterName ?? null,
      sbTransporterGstin: transport?.transporterGstin ?? null,
      sbLrNo: transport?.lrNo ?? null,
      sbLrDate: transport?.lrDate ?? null,
      sbDistanceKm: transport?.distanceKm ?? null,
    };
  }

  /** Flow §11 — a return locks its bill; an allocation against its balance row locks it too. */
  async lockCounts(
    c: Prisma.TransactionClient,
    bill: SaleBill,
  ): Promise<{ returns: number; allocations: number }> {
    const [row] = await c.$queryRaw<{ returns: bigint; allocations: bigint }[]>`
      SELECT
        (SELECT COUNT(*) FROM sales.sale_return r
          WHERE r.sr_bill_id = ${bill.sbId}::uuid AND r.sr_is_deleted = false
            AND r.sr_status <> 'CANCELLED') AS returns,
        (SELECT COUNT(*) FROM accounts.acc_bill_adjustment j
           JOIN accounts.acc_bill_balance b
             ON b.abl_id = j.abj_bill_id AND b.abl_acc_year = j.abj_bill_acc_year
          WHERE b.abl_src_doc_id = ${bill.sbId}::uuid AND b.abl_acc_year = ${bill.sbAccYear}::char(9)
            AND j.abj_is_deleted = false
            -- Same exclusion as assertCancellable: only the set-offs the bill's
            -- own /post wrote, which carry no voucher.
            AND NOT (j.abj_adj_type IN ('ADVANCE_ADJUST', 'NOTE_ADJUST')
                     AND j.abj_voucher_id IS NULL)
            -- …and not what was paid at the counter (notes 49): rows naming the
            -- bill's own tender rows.
            AND NOT EXISTS (SELECT 1 FROM accounts.acc_tender_detail t
                             WHERE t.td_id = j.abj_tender_id
                               AND t.td_src_module = 'SALES' AND t.td_src_doc_type = 'SALE_BILL'
                               AND t.td_src_doc_id = ${bill.sbId}::uuid)) AS allocations`;
    return { returns: Number(row?.returns ?? 0), allocations: Number(row?.allocations ?? 0) };
  }

  private async sources(c: Prisma.TransactionClient, bill: SaleBill): Promise<BillSourceSummary[]> {
    const rows = await c.$queryRaw<
      {
        kind: string;
        doc_id: string;
        acc_year: string;
        refno: string | null;
        doc_date: Date | null;
        lines: bigint;
        taken_qty: Prisma.Decimal | null;
        open_after: Prisma.Decimal | null;
      }[]
    >`
      WITH refs AS (
        SELECT sbi_src_doc_type AS kind, sbi_src_doc_id AS doc_id, sbi_src_doc_year AS acc_year,
               COUNT(*) AS lines, SUM(sbi_bill_qty) AS taken_qty,
               SUM(CASE WHEN sbi_src_doc_type = 'DELIVERY_CHALLAN' THEN d.sdi_open_qty
                        WHEN sbi_src_doc_type = 'SALES_ORDER' THEN o.soi_pending_qty END) AS open_after
          FROM sales.sale_bill_item i
          LEFT JOIN sales.sale_dc_item d ON d.sdi_id = i.sbi_src_item_id AND i.sbi_src_doc_type = 'DELIVERY_CHALLAN'
          LEFT JOIN sales.sale_order_item o ON o.soi_id = i.sbi_src_item_id AND i.sbi_src_doc_type = 'SALES_ORDER'
         WHERE i.sbi_bill_id = ${bill.sbId}::uuid AND i.sbi_acc_year = ${bill.sbAccYear}::char(9)
           AND i.sbi_is_deleted = false AND i.sbi_src_doc_id IS NOT NULL
         GROUP BY 1, 2, 3
        UNION ALL
        SELECT sb_src_doc_type, sb_src_doc_id, sb_src_doc_year, 0, 0, NULL
          FROM sales.sale_bill
         WHERE sb_id = ${bill.sbId}::uuid AND sb_acc_year = ${bill.sbAccYear}::char(9)
           AND sb_src_doc_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sales.sale_bill_item x
                            WHERE x.sbi_bill_id = sb_id AND x.sbi_acc_year = sb_acc_year
                              AND x.sbi_is_deleted = false AND x.sbi_src_doc_id = sb_src_doc_id)
      )
      SELECT r.kind, r.doc_id, r.acc_year,
             COALESCE(dc.sdc_dc_refno, so.so_order_refno, sq.sq_quote_refno) AS refno,
             COALESCE(dc.sdc_dc_date, so.so_order_date, sq.sq_quote_date)     AS doc_date,
             r.lines, r.taken_qty, r.open_after
        FROM refs r
        LEFT JOIN sales.sale_dc dc ON dc.sdc_id = r.doc_id AND r.kind = 'DELIVERY_CHALLAN'
        LEFT JOIN sales.sale_order so ON so.so_id = r.doc_id AND r.kind = 'SALES_ORDER'
        LEFT JOIN sales.sale_quotation sq ON sq.sq_id = r.doc_id AND r.kind = 'QUOTATION'`;
    return rows.map((r) => ({
      kind: r.kind === 'DELIVERY_CHALLAN' ? 'DC' : r.kind === 'SALES_ORDER' ? 'ORDER' : 'QUOTATION',
      docId: r.doc_id,
      accYear: (r.acc_year ?? '').trim(),
      refno: r.refno,
      date: isoDate(r.doc_date),
      lines: Number(r.lines),
      takenQty: num(r.taken_qty),
      openQtyAfter: r.open_after === null ? null : num(r.open_after),
    }));
  }

  private async tempCredits(
    c: Prisma.TransactionClient,
    bill: SaleBill,
  ): Promise<BillTempCreditSummary[]> {
    const rows = await c.accTempCredit.findMany({
      where: { atcSrcDocId: bill.sbId, atcAccYear: bill.sbAccYear, atcIsDeleted: false },
      orderBy: { atcCreatedOn: 'asc' },
    });
    return rows.map((r) => ({
      atcId: r.atcId,
      name: r.atcName,
      mobile: r.atcMobile,
      balance: num(r.atcBalanceAmount),
      dueDate: isoDate(r.atcDueDate),
      status: r.atcStatus,
    }));
  }

  private async adjustments(
    c: Prisma.TransactionClient,
    bill: SaleBill,
  ): Promise<BillAdjustmentSummary[]> {
    const rows = await c.$queryRaw<
      {
        abj_against_bill_id: string;
        abj_against_bill_acc_year: string;
        refno: string | null;
        abj_amount: Prisma.Decimal;
        abj_adj_type: string;
      }[]
    >`
      SELECT j.abj_against_bill_id, j.abj_against_bill_acc_year, k.abl_doc_refno AS refno, j.abj_amount, j.abj_adj_type
        FROM accounts.acc_bill_adjustment j
        JOIN accounts.acc_bill_balance b ON b.abl_id = j.abj_bill_id AND b.abl_acc_year = j.abj_bill_acc_year
        LEFT JOIN accounts.acc_bill_balance k ON k.abl_id = j.abj_against_bill_id AND k.abl_acc_year = j.abj_against_bill_acc_year
       WHERE b.abl_src_doc_id = ${bill.sbId}::uuid AND b.abl_acc_year = ${bill.sbAccYear}::char(9)
         AND j.abj_is_deleted = false AND j.abj_reversal_of_id IS NULL
         AND j.abj_adj_type IN ('ADVANCE_ADJUST', 'NOTE_ADJUST') AND j.abj_dr_cr = 'CR'
         AND NOT EXISTS (SELECT 1 FROM accounts.acc_bill_adjustment r WHERE r.abj_reversal_of_id = j.abj_id AND r.abj_is_deleted = false)
       ORDER BY j.abj_row_no`;
    return rows.map((r) => ({
      againstBillId: r.abj_against_bill_id,
      againstBillAccYear: (r.abj_against_bill_acc_year ?? '').trim(),
      refno: r.refno,
      amount: num(r.abj_amount),
      adjType: r.abj_adj_type,
    }));
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §2.8 — GET /bills/open-sources
  // ═════════════════════════════════════════════════════════════════════════

  async openSources(q: {
    companyId: string;
    branchId: string;
    partyId: string;
    kind: 'DC' | 'ORDER';
    accYear?: string | null;
  }): Promise<OpenSourceDoc[]> {
    return q.kind === 'DC' ? this.openChallans(q) : this.openOrders(q);
  }

  private async openChallans(q: {
    companyId: string;
    branchId: string;
    partyId: string;
    accYear?: string | null;
  }): Promise<OpenSourceDoc[]> {
    const today = isoToday();
    const window = await this.statutory.limit(
      q.companyId,
      STATUTORY_CODES.DC_RETURN_WINDOW_DAYS,
      today,
    );
    const rows = await this.prisma.$queryRaw<OpenLineRow[]>`
      SELECT h.sdc_id AS doc_id, h.sdc_acc_year AS acc_year, h.sdc_dc_refno AS refno, h.sdc_dc_date AS doc_date,
             h.sdc_purpose AS purpose,
             d.sdi_id AS line_id, d.sdi_line_no AS line_no, d.sdi_item_id AS item_id, im.item_name_en AS item_name,
             d.sdi_item_unit_id AS unit_id, u.unit_name, d.sdi_lot_id AS lot_id, d.sdi_batch_no AS batch_no,
             d.sdi_godown_id AS godown_id, d.sdi_dc_qty AS doc_qty, d.sdi_open_qty AS open_qty,
             d.sdi_rate AS rate, d.sdi_tax_id AS tax_id, d.sdi_tax_perc AS tax_perc, d.sdi_hsn_code AS hsn_code,
             d.sdi_free_qty AS free_qty,
             -- The challan already moved the stock; billing it takes none.
             true AS allow_negative_stock
        FROM sales.sale_dc h
        JOIN sales.sale_dc_item d ON d.sdi_dc_id = h.sdc_id AND d.sdi_acc_year = h.sdc_acc_year AND d.sdi_is_deleted = false
        JOIN inventory.item_master im ON im.item_id = d.sdi_item_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = d.sdi_item_unit_id
        LEFT JOIN inventory.item_unit_master u ON u.unit_id = iuc.iuc_unit_id
       WHERE h.sdc_company_id = ${q.companyId}::uuid AND h.sdc_branch_id = ${q.branchId}::uuid
         AND h.sdc_cust_id = ${q.partyId}::uuid AND h.sdc_status = 'POSTED' AND h.sdc_is_deleted = false
         AND (${q.accYear ?? null}::text IS NULL OR h.sdc_acc_year = ${q.accYear ?? null}::char(9))
         AND d.sdi_open_qty > 0
       ORDER BY h.sdc_dc_date, h.sdc_dc_refno, d.sdi_line_no`;
    return groupOpen(rows, (doc) => {
      const age = daysBetween(doc.date ?? today, today);
      return {
        ageDays: age,
        pastWindow: window?.value != null ? age > window.value : false,
        convertRequired: doc.purpose !== 'SUPPLY',
      };
    });
  }

  private async openOrders(q: {
    companyId: string;
    branchId: string;
    partyId: string;
    accYear?: string | null;
  }): Promise<OpenSourceDoc[]> {
    const today = isoToday();
    const rows = await this.prisma.$queryRaw<OpenLineRow[]>`
      SELECT h.so_id AS doc_id, h.so_acc_year AS acc_year, h.so_order_refno AS refno, h.so_order_date AS doc_date,
             NULL::text AS purpose,
             d.soi_id AS line_id, d.soi_line_no AS line_no, d.soi_item_id AS item_id, im.item_name_en AS item_name,
             d.soi_item_unit_id AS unit_id, u.unit_name, NULL::uuid AS lot_id, NULL::text AS batch_no,
             d.soi_godown_id AS godown_id, d.soi_order_qty AS doc_qty, d.soi_pending_qty AS open_qty,
             d.soi_rate AS rate, d.soi_tax_id AS tax_id, d.soi_tax_perc AS tax_perc, d.soi_hsn_code AS hsn_code,
             0::numeric AS free_qty,
             (im.item_is_service OR NOT (g.gdl_negative_stock IS FALSE
                                         AND c.comp_negstk_apl IS FALSE
                                         AND im.item_allow_neg_stock IS FALSE)) AS allow_negative_stock
        FROM sales.sale_order h
        JOIN sales.sale_order_item d ON d.soi_order_id = h.so_id AND d.soi_acc_year = h.so_acc_year AND d.soi_is_deleted = false
        JOIN inventory.item_master im ON im.item_id = d.soi_item_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = d.soi_item_unit_id
        LEFT JOIN inventory.item_unit_master u ON u.unit_id = iuc.iuc_unit_id
        -- notes (51): the line's allow-negative switch, as soiAllowNegativeStock
        -- derives it. Its godown is the line's own; a line with none takes the
        -- sale-line default (price row godown, else the live branch default —
        -- sale-line-godown.utils).
        LEFT JOIN public.companys c ON c.comp_id = h.so_company_id AND c.comp_is_deleted = false
        LEFT JOIN LATERAL (
          SELECT p.ipm_godown_id FROM inventory.item_price_master p
           WHERE p.ipm_item_id = d.soi_item_id AND p.ipm_uc_unit_id = d.soi_item_unit_id
             AND p.ipm_is_deleted = false
             AND (p.ipm_branch_id = h.so_branch_id OR p.ipm_branch_id IS NULL)
           ORDER BY (p.ipm_branch_id IS NULL), p.ipm_id
           LIMIT 1) pr ON true
        LEFT JOIN public.branch_master br ON br.br_id = h.so_branch_id
        LEFT JOIN inventory.godown_locations bg ON bg.gdl_id = br.br_default_godown_id AND bg.gdl_is_deleted = false
        LEFT JOIN inventory.godown_locations g
               ON g.gdl_id = COALESCE(d.soi_godown_id, pr.ipm_godown_id, bg.gdl_id)
       WHERE h.so_company_id = ${q.companyId}::uuid AND h.so_branch_id = ${q.branchId}::uuid
         AND h.so_cust_id = ${q.partyId}::uuid AND h.so_status IN ('CONFIRMED', 'PARTIAL') AND h.so_is_deleted = false
         AND (${q.accYear ?? null}::text IS NULL OR h.so_acc_year = ${q.accYear ?? null}::char(9))
         AND d.soi_pending_qty > 0
       ORDER BY h.so_order_date, h.so_order_refno, d.soi_line_no`;
    return groupOpen(rows, (doc) => ({
      ageDays: daysBetween(doc.date ?? today, today),
      pastWindow: false,
    }));
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §2.9 — GET /bills/party-context
  // ═════════════════════════════════════════════════════════════════════════

  async partyContext(q: {
    partyId: string;
    companyId: string;
    branchId: string;
    accYear: string;
    billDate?: string | null;
  }): Promise<Record<string, unknown>> {
    const billDate = q.billDate ?? isoToday();
    const settings = await this.salesContext.settings(q.companyId, q.branchId);

    const [cus] = await this.prisma.$queryRaw<
      {
        cus_id: string;
        cus_name: string | null;
        cus_gst_type: string | null;
        cus_gst_no: string | null;
        cus_state_code: string | null;
        cus_pan_no: string | null;
        cus_pan_verified_on: Date | null;
        cus_form60_on: Date | null;
        cus_credit_allowed: boolean;
        cus_price_level_id: number | null;
        cus_credit_amt_limit: Prisma.Decimal | null;
        cus_credit_bill_limit: number | null;
        cus_credit_days: number | null;
        cus_group_id: string | null;
        cus_addr1: string | null;
        cus_addr2: string | null;
        cus_addr3: string | null;
        cus_city: string | null;
        cus_pin: string | null;
        cus_phone1: string | null;
        cus_area_id: string | null;
        cus_default_salesman: string | null;
        cus_freight_charge: boolean;
        cus_loading_charge: boolean;
        cus_unloading_charge: boolean;
        cus_allow_discount: boolean;
        cus_allow_promotion: boolean;
        cus_allow_loyalty: boolean;
        arm_name: string | null;
        arm_distance_km: number | null;
        emp_name: string | null;
      }[]
    >`
      SELECT c.cus_id, c.cus_name, c.cus_gst_type, c.cus_gst_no, c.cus_state_code, c.cus_pan_no,
             c.cus_pan_verified_on, c.cus_form60_on, c.cus_credit_allowed, c.cus_price_level_id,
             c.cus_credit_amt_limit, c.cus_credit_bill_limit, c.cus_credit_days, c.cus_group_id,
             c.cus_addr1, c.cus_addr2, c.cus_addr3, c.cus_city, c.cus_pin, c.cus_phone1,
             c.cus_area_id, c.cus_default_salesman,
             c.cus_freight_charge, c.cus_loading_charge, c.cus_unloading_charge,
             c.cus_allow_discount, c.cus_allow_promotion, c.cus_allow_loyalty,
             a.arm_name, a.arm_distance_km, e.emp_name
        FROM sales.customers c
        LEFT JOIN sales.area_master a ON a.arm_id = c.cus_area_id
        LEFT JOIN public.employee_master e
               ON e.emp_id = c.cus_default_salesman AND e.emp_is_deleted = false
       WHERE c.cus_id = ${q.partyId}::uuid`;
    if (!cus) {
      throwSalesNotFound<BillErrorDetail, BillErrorResponse>(
        'Customer not found',
        'partyId',
        `No customer found with id ${q.partyId}`,
      );
    }

    const [open] = await this.prisma.$queryRaw<
      { pending: Prisma.Decimal | null; bills: bigint; oldest: Date | null }[]
    >`
      SELECT SUM(abl_pending_amount) AS pending, COUNT(*) AS bills, MIN(abl_doc_date) AS oldest
        FROM accounts.acc_bill_balance
       WHERE abl_company_id = ${q.companyId}::uuid AND abl_party_id = ${q.partyId}::uuid
         AND abl_dr_cr = 'DR' AND abl_status = 'OPEN' AND abl_is_deleted = false AND abl_is_active = true`;
    const used = num(open?.pending);
    const openBills = Number(open?.bills ?? 0);
    const oldestOpenDays = open?.oldest ? daysBetween(isoDate(open.oldest)!, billDate) : 0;
    const limitAmount = num(cus.cus_credit_amt_limit);
    const limitBills = cus.cus_credit_bill_limit ?? 0;
    const creditDays = cus.cus_credit_days ?? 0;

    const [cash] = await this.prisma.$queryRaw<{ cash: Prisma.Decimal | null }[]>`
      SELECT SUM(td_amount) AS cash
        FROM accounts.acc_tender_detail t
        JOIN sales.sale_bill b ON b.sb_id = t.td_src_doc_id AND b.sb_acc_year = t.td_acc_year
       WHERE t.td_party_ledger_id = ${q.partyId}::uuid AND t.td_tender_type_id = ${TENDER_TYPE.CASH}
         AND t.td_doc_date = ${billDate}::date AND t.td_is_deleted = false AND t.td_is_voided = false
         AND t.td_src_module = 'SALES' AND t.td_src_doc_type = 'SALE_BILL' AND b.sb_status = 'POSTED'`;

    const credits = await this.prisma.$queryRaw<
      {
        abl_id: string;
        abl_acc_year: string;
        abl_doc_refno: string | null;
        abl_pending_amount: Prisma.Decimal | null;
        abl_doc_date: Date;
        abl_bill_type: string;
      }[]
    >`
      SELECT abl_id, abl_acc_year, abl_doc_refno, abl_pending_amount, abl_doc_date, abl_bill_type
        FROM accounts.acc_bill_balance
       WHERE abl_company_id = ${q.companyId}::uuid AND abl_party_id = ${q.partyId}::uuid
         AND abl_dr_cr = 'CR' AND abl_status IN ('OPEN', 'PARTIAL') AND abl_pending_amount > 0
         AND abl_is_deleted = false AND abl_is_active = true
         AND abl_bill_type IN ('ADVANCE', 'SALES_RETURN')
       ORDER BY abl_doc_date, abl_doc_refno`;
    const toCredit = (r: (typeof credits)[number]) => ({
      ablId: r.abl_id,
      ablAccYear: r.abl_acc_year.trim(),
      refno: r.abl_doc_refno,
      pending: num(r.abl_pending_amount),
      date: isoDate(r.abl_doc_date),
    });

    const member = await this.prisma.$queryRaw<
      {
        lmb_id: string;
        lmb_card_no: string | null;
        lmb_balance_points: Prisma.Decimal | null;
        lmb_lsc_id: string | null;
      }[]
    >`
      SELECT lmb_id, lmb_card_no, lmb_balance_points, lmb_lsc_id
        FROM sales.loyalty_member
       WHERE lmb_comp_id = ${q.companyId}::uuid AND lmb_cust_id = ${q.partyId}::uuid
         AND lmb_is_deleted = false AND lmb_status = 'ACTIVE'
       ORDER BY lmb_enrolled_on DESC LIMIT 1`;
    let loyalty: Record<string, unknown> | null = null;
    if (member[0]) {
      const preview = await this.loyalty.preview({
        docId: '00000000-0000-0000-0000-000000000000',
        accYear: q.accYear,
        companyId: q.companyId,
        branchId: q.branchId,
        custId: q.partyId,
        docDate: billDate,
        docRefno: null,
        docType: 'SALE_BILL',
        billType: null,
        memberId: member[0].lmb_id,
        chargesAmt: 0,
        redeemedAmount: 0,
        custGroupId: cus.cus_group_id,
        lines: [],
      });
      loyalty = {
        memberId: member[0].lmb_id,
        cardNo: member[0].lmb_card_no,
        balance: preview.balance,
        redeemable: preview.redeemable,
        rate: preview.rate,
        minPoints: preview.minPoints,
        maxPoints: preview.maxPoints,
        maxRedeemPerc: null,
        maxRedeemAmount: preview.maxRedeemAmount,
        multiple: preview.multiple,
        schemeId: preview.schemeId,
        allowPointRedeem: preview.allowPointRedeem,
      };
    }

    const shipTo = await this.prisma.$queryRaw<
      {
        saa_id: string;
        saa_trade_name: string | null;
        saa_contact_name: string | null;
        saa_addr1: string | null;
        saa_addr2: string | null;
        saa_addr3: string | null;
        saa_location: string | null;
        saa_pin: string | null;
        saa_state_code: string | null;
        saa_gstin: string | null;
        saa_is_default: boolean;
        saa_phone: string | null;
        saa_distance_km: Prisma.Decimal | null;
      }[]
    >`
      SELECT saa_id, saa_trade_name, saa_contact_name, saa_addr1, saa_addr2, saa_addr3, saa_location, saa_pin,
             saa_state_code, saa_gstin, saa_is_default, saa_phone, saa_distance_km
        FROM accounts.acc_ship_addrs
       WHERE saa_ledger_id = ${q.partyId}::uuid AND saa_is_deleted = false AND saa_is_active = true
       ORDER BY saa_is_default DESC, saa_sort, saa_created_on`;

    const temp = await this.prisma.$queryRaw<
      {
        atc_id: string;
        atc_bill_refno: string | null;
        atc_balance_amount: Prisma.Decimal;
        atc_due_date: Date;
        atc_mobile: string;
        atc_name: string;
      }[]
    >`
      SELECT atc_id, atc_bill_refno, atc_balance_amount, atc_due_date, atc_mobile, atc_name
        FROM accounts.acc_temp_credit
       WHERE atc_company_id = ${q.companyId}::uuid AND atc_party_id = ${q.partyId}::uuid
         AND atc_status IN ('OPEN', 'PARTIAL') AND atc_is_deleted = false
       ORDER BY atc_due_date`;

    const [counts] = await this.prisma.$queryRaw<{ dc: bigint; orders: bigint }[]>`
      SELECT (SELECT COUNT(DISTINCT h.sdc_id) FROM sales.sale_dc h
                JOIN sales.sale_dc_item d ON d.sdi_dc_id = h.sdc_id AND d.sdi_acc_year = h.sdc_acc_year AND d.sdi_is_deleted = false
               WHERE h.sdc_company_id = ${q.companyId}::uuid AND h.sdc_branch_id = ${q.branchId}::uuid
                 AND h.sdc_cust_id = ${q.partyId}::uuid AND h.sdc_status = 'POSTED' AND h.sdc_is_deleted = false
                 AND d.sdi_open_qty > 0) AS dc,
             (SELECT COUNT(DISTINCT h.so_id) FROM sales.sale_order h
                JOIN sales.sale_order_item d ON d.soi_order_id = h.so_id AND d.soi_acc_year = h.so_acc_year AND d.soi_is_deleted = false
               WHERE h.so_company_id = ${q.companyId}::uuid AND h.so_branch_id = ${q.branchId}::uuid
                 AND h.so_cust_id = ${q.partyId}::uuid AND h.so_status IN ('CONFIRMED', 'PARTIAL') AND h.so_is_deleted = false
                 AND d.soi_pending_qty > 0) AS orders`;

    return {
      party: {
        ledId: cus.cus_id,
        name: cus.cus_name,
        gstType: cus.cus_gst_type,
        gstin: cus.cus_gst_no,
        stateCode: cus.cus_state_code,
        isWalkIn: settings.defaultCustomerId === cus.cus_id,
        panNo: cus.cus_pan_no,
        panVerifiedOn: isoDate(cus.cus_pan_verified_on),
        form60On: isoDate(cus.cus_form60_on),
        creditAllowed: cus.cus_credit_allowed,
        defaultPriceLevel: cus.cus_price_level_id,
        // The BILL-TO snapshot the header stamps into sb_cust_*. Joined the same
        // way `shipTo[].addr` is, so the two bands read identically.
        addr:
          [cus.cus_addr1, cus.cus_addr2, cus.cus_addr3].filter((a) => a?.trim()).join(', ') || null,
        place: cus.cus_city,
        pin: cus.cus_pin,
        phone: cus.cus_phone1,
        // The rest of what `/master-lookups/customer-detail` carried for this
        // screen, so the pick is ONE call. `distanceKm` is the AREA's distance —
        // the same figure customer-detail returned, not cus_distance_km.
        areaId: cus.cus_area_id,
        areaName: cus.arm_name,
        distanceKm: cus.arm_distance_km,
        salesmanId: cus.cus_default_salesman,
        salesmanName: cus.emp_name,
        freightCharge: cus.cus_freight_charge,
        loadingCharge: cus.cus_loading_charge,
        unloadingCharge: cus.cus_unloading_charge,
        allowDiscount: cus.cus_allow_discount,
        allowPromotion: cus.cus_allow_promotion,
        allowLoyalty: cus.cus_allow_loyalty,
      },
      credit: {
        limitAmount,
        limitBills,
        creditDays,
        used: round2(used),
        openBills,
        oldestOpenDays,
        amtExceeded: limitAmount > 0 && used > limitAmount,
        billExceeded: limitBills > 0 && openBills >= limitBills,
        daysExceeded: creditDays > 0 && oldestOpenDays > creditDays,
        mode: settings.creditLimitMode,
      },
      cashToday: round2(num(cash?.cash)),
      advances: credits.filter((r) => r.abl_bill_type === 'ADVANCE').map(toCredit),
      creditNotes: credits.filter((r) => r.abl_bill_type === 'SALES_RETURN').map(toCredit),
      loyalty,
      shipTo: shipTo.map((s) => ({
        saaId: s.saa_id,
        name: s.saa_trade_name ?? s.saa_contact_name,
        addr: [s.saa_addr1, s.saa_addr2, s.saa_addr3].filter((a) => a?.trim()).join(', ') || null,
        place: s.saa_location,
        pin: s.saa_pin,
        stcd: s.saa_state_code,
        gstin: s.saa_gstin,
        phone: s.saa_phone,
        distanceKm: s.saa_distance_km === null ? null : num(s.saa_distance_km),
        isDefault: s.saa_is_default,
      })),
      tempCredits: temp.map((t) => ({
        atcId: t.atc_id,
        billRefno: t.atc_bill_refno,
        name: t.atc_name,
        mobile: t.atc_mobile,
        balance: num(t.atc_balance_amount),
        dueDate: isoDate(t.atc_due_date),
      })),
      openSources: { dc: Number(counts?.dc ?? 0), orders: Number(counts?.orders ?? 0) },
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §2.12a — GET /bills/tender-context: the re-tender dialog's ONLY read
  // ═════════════════════════════════════════════════════════════════════════

  async tenderContext(keys: {
    sbId: string;
    sbCompanyId: string;
    sbBranchId: string;
    sbAccYear: string;
  }): Promise<Record<string, unknown>> {
    const bill = await this.prisma.saleBill.findFirst({
      where: {
        sbId: keys.sbId,
        sbCompanyId: keys.sbCompanyId,
        sbBranchId: keys.sbBranchId,
        sbAccYear: keys.sbAccYear,
        sbIsDeleted: false,
      },
      select: {
        sbBillRefno: true,
        sbBillDate: true,
        sbCustName: true,
        sbBillAmt: true,
        sbPaidAmt: true,
        sbBalanceAmt: true,
        sbStatus: true,
        sbCompanyId: true,
        sbBranchId: true,
      },
    });
    if (!bill) {
      throwSalesNotFound<BillErrorDetail, BillErrorResponse>(
        'Bill not found',
        'sbId',
        `No active bill found with id ${keys.sbId}`,
      );
    }
    const tenders = await this.prisma.$queryRaw<
      {
        td_id: string;
        tnd_name: string | null;
        td_tender_id: string;
        td_tender_type_id: number;
        td_amount: Prisma.Decimal;
        td_is_pdc: boolean;
        td_settle_status: string | null;
        td_is_voided: boolean;
        td_replaces_id: string | null;
        apd_status: string | null;
      }[]
    >`
      SELECT t.td_id, m.tnd_name, t.td_tender_id, t.td_tender_type_id, t.td_amount, t.td_is_pdc, t.td_settle_status,
             t.td_is_voided, t.td_replaces_id,
             -- The cheque register row (notes 46): past HELD, the bank has it.
             (SELECT p.apd_status FROM accounts.acc_pdc_register p
               WHERE p.apd_tender_id = t.td_id AND p.apd_is_deleted = false
                 AND p.apd_status <> 'CANCELLED'
               LIMIT 1) AS apd_status
        FROM accounts.acc_tender_detail t
        LEFT JOIN accounts.acc_tender_master m ON m.tnd_id = t.td_tender_id
       WHERE t.td_src_module = 'SALES' AND t.td_src_doc_type = 'SALE_BILL' AND t.td_src_doc_id = ${keys.sbId}::uuid
         AND t.td_acc_year = ${keys.sbAccYear}::char(9) AND t.td_is_deleted = false
       ORDER BY t.td_row_no`;
    const billDate = isoDate(bill.sbBillDate) ?? isoToday();
    const dayClosed = await loadDayClosed(
      this.prisma as unknown as Prisma.TransactionClient,
      bill.sbCompanyId,
      bill.sbBranchId,
      billDate,
    );
    const reason =
      bill.sbStatus === 'CANCELLED' ? 'bill cancelled' : dayClosed ? 'day closed' : null;
    return {
      sbBillRefno: bill.sbBillRefno,
      sbBillDate: billDate,
      sbCustName: bill.sbCustName,
      sbBillAmt: num(bill.sbBillAmt),
      sbPaidAmt: num(bill.sbPaidAmt),
      sbBalanceAmt: num(bill.sbBalanceAmt),
      sbStatus: bill.sbStatus,
      tenders: tenders.map((t) => ({
        tdId: t.td_id,
        tenderName: t.tnd_name,
        tdTenderId: t.td_tender_id,
        tdTenderTypeId: t.td_tender_type_id,
        tdAmount: num(t.td_amount),
        tdIsPdc: t.td_is_pdc,
        pdcMoved:
          (t.apd_status !== null && t.apd_status !== 'HELD') ||
          (t.td_is_pdc &&
            ['SETTLED', 'PARTIAL'].includes((t.td_settle_status ?? '').toUpperCase())),
        isLoyalty: t.td_tender_type_id === TENDER_TYPE.LOYALTY,
        isTempCredit: t.td_tender_type_id === TENDER_TYPE.TEMP_CREDIT,
        isVoided: t.td_is_voided,
        replacesId: t.td_replaces_id,
      })),
      canRetender: reason === null,
      reason,
    };
  }
}

// ─── open-sources shapes ────────────────────────────────────────────────────

interface OpenLineRow {
  doc_id: string;
  acc_year: string;
  refno: string | null;
  doc_date: Date | null;
  purpose: string | null;
  line_id: string;
  line_no: number;
  item_id: string;
  item_name: string | null;
  unit_id: string | null;
  unit_name: string | null;
  lot_id: string | null;
  batch_no: string | null;
  godown_id: string | null;
  doc_qty: Prisma.Decimal | null;
  open_qty: Prisma.Decimal | null;
  rate: Prisma.Decimal | null;
  tax_id: string | null;
  tax_perc: Prisma.Decimal | null;
  hsn_code: string | null;
  free_qty: Prisma.Decimal | null;
  allow_negative_stock: boolean;
}

export interface OpenSourceDoc {
  docId: string;
  accYear: string;
  refno: string | null;
  date: string | null;
  purpose: string | null;
  ageDays: number;
  pastWindow: boolean;
  convertRequired?: boolean;
  lines: {
    lineId: string;
    lineNo: number;
    itemId: string;
    itemName: string | null;
    unitId: string | null;
    unitName: string | null;
    lotId: string | null;
    batchNo: string | null;
    godownId: string | null;
    docQty: number;
    openQty: number;
    freeQty: number;
    rate: number;
    taxId: string | null;
    taxPerc: number;
    hsnCode: string | null;
    // notes (51): whether this line may take stock below zero. Always true for
    // a DC line (the challan already moved the stock); an order line derives
    // it as soiAllowNegativeStock does.
    allowNegativeStock: boolean;
  }[];
}

function groupOpen(
  rows: OpenLineRow[],
  extra: (doc: OpenSourceDoc) => Partial<OpenSourceDoc>,
): OpenSourceDoc[] {
  const by = new Map<string, OpenSourceDoc>();
  for (const r of rows) {
    const key = `${r.doc_id}|${r.acc_year}`;
    let doc = by.get(key);
    if (!doc) {
      doc = {
        docId: r.doc_id,
        accYear: r.acc_year.trim(),
        refno: r.refno,
        date: isoDate(r.doc_date),
        purpose: r.purpose,
        ageDays: 0,
        pastWindow: false,
        lines: [],
      };
      by.set(key, doc);
    }
    doc.lines.push({
      lineId: r.line_id,
      lineNo: r.line_no,
      itemId: r.item_id,
      itemName: r.item_name,
      unitId: r.unit_id,
      unitName: r.unit_name,
      lotId: r.lot_id,
      batchNo: r.batch_no,
      godownId: r.godown_id,
      docQty: num(r.doc_qty),
      openQty: num(r.open_qty),
      freeQty: num(r.free_qty),
      rate: num(r.rate),
      taxId: r.tax_id,
      taxPerc: num(r.tax_perc),
      hsnCode: r.hsn_code,
      allowNegativeStock: r.allow_negative_stock,
    });
  }
  return [...by.values()].map((d) => ({ ...d, ...extra(d) }));
}
