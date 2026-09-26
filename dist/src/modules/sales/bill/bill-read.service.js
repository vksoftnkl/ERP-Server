"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillReadService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const loyalty_ledger_service_1 = require("../posting/loyalty-ledger.service");
const sales_context_service_1 = require("../posting/sales-context.service");
const sales_doc_blocks_service_1 = require("../posting/sales-doc-blocks.service");
const sales_guards_1 = require("../posting/sales.guards");
const statutory_service_1 = require("../../../common/posting/statutory.service");
const transport_band_service_1 = require("../posting/transport-band.service");
const statutory_types_1 = require("../../../common/posting/statutory.types");
const sales_doc_utils_1 = require("../posting/sales-doc.utils");
let BillReadService = class BillReadService {
    prisma;
    salesContext;
    docBlocks;
    transportBand;
    statutory;
    loyalty;
    constructor(prisma, salesContext, docBlocks, transportBand, statutory, loyalty) {
        this.prisma = prisma;
        this.salesContext = salesContext;
        this.docBlocks = docBlocks;
        this.transportBand = transportBand;
        this.statutory = statutory;
        this.loyalty = loyalty;
    }
    async decorate(bill, payload, client) {
        const c = client ?? this.prisma;
        const [counts, rights, sources, tempCredits, adjustments, transport] = await Promise.all([
            this.lockCounts(c, bill),
            this.salesContext.rights(sales_doc_utils_1.SALES_MENU_ID.SALE_BILL, c),
            this.sources(c, bill),
            this.tempCredits(c, bill),
            this.adjustments(c, bill),
            this.transportBand.read({ docType: 'SALE_BILL', docId: bill.sbId, accYear: bill.sbAccYear }, c),
        ]);
        const { posting, locks } = await this.docBlocks.build({
            status: bill.sbStatus,
            companyId: bill.sbCompanyId,
            branchId: bill.sbBranchId,
            accYear: bill.sbAccYear,
            docDate: (0, sales_doc_utils_1.isoDate)(bill.sbBillDate) ?? (0, sales_doc_utils_1.isoToday)(),
            voucherId: bill.sbPostedVoucherId,
            registerId: bill.sbDocRegisterId,
            cogsAmt: (0, sales_doc_utils_1.num)(bill.sbCogsAmt),
            loyaltyEarned: (0, sales_doc_utils_1.num)(bill.sbLoyaltyEarned),
            loyaltyRedeemed: (0, sales_doc_utils_1.num)(bill.sbLoyaltyRedeemed),
            returns: counts.returns,
            allocations: counts.allocations,
        }, c);
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
    async lockCounts(c, bill) {
        const [row] = await c.$queryRaw `
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
    async sources(c, bill) {
        const rows = await c.$queryRaw `
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
            date: (0, sales_doc_utils_1.isoDate)(r.doc_date),
            lines: Number(r.lines),
            takenQty: (0, sales_doc_utils_1.num)(r.taken_qty),
            openQtyAfter: r.open_after === null ? null : (0, sales_doc_utils_1.num)(r.open_after),
        }));
    }
    async tempCredits(c, bill) {
        const rows = await c.accTempCredit.findMany({
            where: { atcSrcDocId: bill.sbId, atcAccYear: bill.sbAccYear, atcIsDeleted: false },
            orderBy: { atcCreatedOn: 'asc' },
        });
        return rows.map((r) => ({
            atcId: r.atcId,
            name: r.atcName,
            mobile: r.atcMobile,
            balance: (0, sales_doc_utils_1.num)(r.atcBalanceAmount),
            dueDate: (0, sales_doc_utils_1.isoDate)(r.atcDueDate),
            status: r.atcStatus,
        }));
    }
    async adjustments(c, bill) {
        const rows = await c.$queryRaw `
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
            amount: (0, sales_doc_utils_1.num)(r.abj_amount),
            adjType: r.abj_adj_type,
        }));
    }
    async openSources(q) {
        return q.kind === 'DC' ? this.openChallans(q) : this.openOrders(q);
    }
    async openChallans(q) {
        const today = (0, sales_doc_utils_1.isoToday)();
        const window = await this.statutory.limit(q.companyId, statutory_types_1.STATUTORY_CODES.DC_RETURN_WINDOW_DAYS, today);
        const rows = await this.prisma.$queryRaw `
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
            const age = (0, sales_doc_utils_1.daysBetween)(doc.date ?? today, today);
            return {
                ageDays: age,
                pastWindow: window?.value != null ? age > window.value : false,
                convertRequired: doc.purpose !== 'SUPPLY',
            };
        });
    }
    async openOrders(q) {
        const today = (0, sales_doc_utils_1.isoToday)();
        const rows = await this.prisma.$queryRaw `
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
            ageDays: (0, sales_doc_utils_1.daysBetween)(doc.date ?? today, today),
            pastWindow: false,
        }));
    }
    async partyContext(q) {
        const billDate = q.billDate ?? (0, sales_doc_utils_1.isoToday)();
        const settings = await this.salesContext.settings(q.companyId, q.branchId);
        const [cus] = await this.prisma.$queryRaw `
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
            (0, module_service_utils_1.throwSalesNotFound)('Customer not found', 'partyId', `No customer found with id ${q.partyId}`);
        }
        const [open] = await this.prisma.$queryRaw `
      SELECT SUM(abl_pending_amount) AS pending, COUNT(*) AS bills, MIN(abl_doc_date) AS oldest
        FROM accounts.acc_bill_balance
       WHERE abl_company_id = ${q.companyId}::uuid AND abl_party_id = ${q.partyId}::uuid
         AND abl_dr_cr = 'DR' AND abl_status = 'OPEN' AND abl_is_deleted = false AND abl_is_active = true`;
        const used = (0, sales_doc_utils_1.num)(open?.pending);
        const openBills = Number(open?.bills ?? 0);
        const oldestOpenDays = open?.oldest ? (0, sales_doc_utils_1.daysBetween)((0, sales_doc_utils_1.isoDate)(open.oldest), billDate) : 0;
        const limitAmount = (0, sales_doc_utils_1.num)(cus.cus_credit_amt_limit);
        const limitBills = cus.cus_credit_bill_limit ?? 0;
        const creditDays = cus.cus_credit_days ?? 0;
        const [cash] = await this.prisma.$queryRaw `
      SELECT SUM(td_amount) AS cash
        FROM accounts.acc_tender_detail t
        JOIN sales.sale_bill b ON b.sb_id = t.td_src_doc_id AND b.sb_acc_year = t.td_acc_year
       WHERE t.td_party_ledger_id = ${q.partyId}::uuid AND t.td_tender_type_id = ${sales_doc_utils_1.TENDER_TYPE.CASH}
         AND t.td_doc_date = ${billDate}::date AND t.td_is_deleted = false AND t.td_is_voided = false
         AND t.td_src_module = 'SALES' AND t.td_src_doc_type = 'SALE_BILL' AND b.sb_status = 'POSTED'`;
        const credits = await this.prisma.$queryRaw `
      SELECT abl_id, abl_acc_year, abl_doc_refno, abl_pending_amount, abl_doc_date, abl_bill_type
        FROM accounts.acc_bill_balance
       WHERE abl_company_id = ${q.companyId}::uuid AND abl_party_id = ${q.partyId}::uuid
         AND abl_dr_cr = 'CR' AND abl_status IN ('OPEN', 'PARTIAL') AND abl_pending_amount > 0
         AND abl_is_deleted = false AND abl_is_active = true
         AND abl_bill_type IN ('ADVANCE', 'SALES_RETURN')
       ORDER BY abl_doc_date, abl_doc_refno`;
        const toCredit = (r) => ({
            ablId: r.abl_id,
            ablAccYear: r.abl_acc_year.trim(),
            refno: r.abl_doc_refno,
            pending: (0, sales_doc_utils_1.num)(r.abl_pending_amount),
            date: (0, sales_doc_utils_1.isoDate)(r.abl_doc_date),
        });
        const member = await this.prisma.$queryRaw `
      SELECT lmb_id, lmb_card_no, lmb_balance_points, lmb_lsc_id
        FROM sales.loyalty_member
       WHERE lmb_comp_id = ${q.companyId}::uuid AND lmb_cust_id = ${q.partyId}::uuid
         AND lmb_is_deleted = false AND lmb_status = 'ACTIVE'
       ORDER BY lmb_enrolled_on DESC LIMIT 1`;
        let loyalty = null;
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
        const shipTo = await this.prisma.$queryRaw `
      SELECT saa_id, saa_trade_name, saa_contact_name, saa_addr1, saa_addr2, saa_addr3, saa_location, saa_pin,
             saa_state_code, saa_gstin, saa_is_default, saa_phone, saa_distance_km
        FROM accounts.acc_ship_addrs
       WHERE saa_ledger_id = ${q.partyId}::uuid AND saa_is_deleted = false AND saa_is_active = true
       ORDER BY saa_is_default DESC, saa_sort, saa_created_on`;
        const temp = await this.prisma.$queryRaw `
      SELECT atc_id, atc_bill_refno, atc_balance_amount, atc_due_date, atc_mobile, atc_name
        FROM accounts.acc_temp_credit
       WHERE atc_company_id = ${q.companyId}::uuid AND atc_party_id = ${q.partyId}::uuid
         AND atc_status IN ('OPEN', 'PARTIAL') AND atc_is_deleted = false
       ORDER BY atc_due_date`;
        const [counts] = await this.prisma.$queryRaw `
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
                panVerifiedOn: (0, sales_doc_utils_1.isoDate)(cus.cus_pan_verified_on),
                form60On: (0, sales_doc_utils_1.isoDate)(cus.cus_form60_on),
                creditAllowed: cus.cus_credit_allowed,
                defaultPriceLevel: cus.cus_price_level_id,
                addr: [cus.cus_addr1, cus.cus_addr2, cus.cus_addr3].filter((a) => a?.trim()).join(', ') || null,
                place: cus.cus_city,
                pin: cus.cus_pin,
                phone: cus.cus_phone1,
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
                used: (0, sales_doc_utils_1.round2)(used),
                openBills,
                oldestOpenDays,
                amtExceeded: limitAmount > 0 && used > limitAmount,
                billExceeded: limitBills > 0 && openBills >= limitBills,
                daysExceeded: creditDays > 0 && oldestOpenDays > creditDays,
                mode: settings.creditLimitMode,
            },
            cashToday: (0, sales_doc_utils_1.round2)((0, sales_doc_utils_1.num)(cash?.cash)),
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
                distanceKm: s.saa_distance_km === null ? null : (0, sales_doc_utils_1.num)(s.saa_distance_km),
                isDefault: s.saa_is_default,
            })),
            tempCredits: temp.map((t) => ({
                atcId: t.atc_id,
                billRefno: t.atc_bill_refno,
                name: t.atc_name,
                mobile: t.atc_mobile,
                balance: (0, sales_doc_utils_1.num)(t.atc_balance_amount),
                dueDate: (0, sales_doc_utils_1.isoDate)(t.atc_due_date),
            })),
            openSources: { dc: Number(counts?.dc ?? 0), orders: Number(counts?.orders ?? 0) },
        };
    }
    async tenderContext(keys) {
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
            (0, module_service_utils_1.throwSalesNotFound)('Bill not found', 'sbId', `No active bill found with id ${keys.sbId}`);
        }
        const tenders = await this.prisma.$queryRaw `
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
        const billDate = (0, sales_doc_utils_1.isoDate)(bill.sbBillDate) ?? (0, sales_doc_utils_1.isoToday)();
        const dayClosed = await (0, sales_guards_1.loadDayClosed)(this.prisma, bill.sbCompanyId, bill.sbBranchId, billDate);
        const reason = bill.sbStatus === 'CANCELLED' ? 'bill cancelled' : dayClosed ? 'day closed' : null;
        return {
            sbBillRefno: bill.sbBillRefno,
            sbBillDate: billDate,
            sbCustName: bill.sbCustName,
            sbBillAmt: (0, sales_doc_utils_1.num)(bill.sbBillAmt),
            sbPaidAmt: (0, sales_doc_utils_1.num)(bill.sbPaidAmt),
            sbBalanceAmt: (0, sales_doc_utils_1.num)(bill.sbBalanceAmt),
            sbStatus: bill.sbStatus,
            tenders: tenders.map((t) => ({
                tdId: t.td_id,
                tenderName: t.tnd_name,
                tdTenderId: t.td_tender_id,
                tdTenderTypeId: t.td_tender_type_id,
                tdAmount: (0, sales_doc_utils_1.num)(t.td_amount),
                tdIsPdc: t.td_is_pdc,
                pdcMoved: (t.apd_status !== null && t.apd_status !== 'HELD') ||
                    (t.td_is_pdc &&
                        ['SETTLED', 'PARTIAL'].includes((t.td_settle_status ?? '').toUpperCase())),
                isLoyalty: t.td_tender_type_id === sales_doc_utils_1.TENDER_TYPE.LOYALTY,
                isTempCredit: t.td_tender_type_id === sales_doc_utils_1.TENDER_TYPE.TEMP_CREDIT,
                isVoided: t.td_is_voided,
                replacesId: t.td_replaces_id,
            })),
            canRetender: reason === null,
            reason,
        };
    }
};
exports.BillReadService = BillReadService;
exports.BillReadService = BillReadService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        sales_context_service_1.SalesContextService,
        sales_doc_blocks_service_1.SalesDocBlocksService,
        transport_band_service_1.TransportBandService,
        statutory_service_1.StatutoryService,
        loyalty_ledger_service_1.LoyaltyLedgerService])
], BillReadService);
function groupOpen(rows, extra) {
    const by = new Map();
    for (const r of rows) {
        const key = `${r.doc_id}|${r.acc_year}`;
        let doc = by.get(key);
        if (!doc) {
            doc = {
                docId: r.doc_id,
                accYear: r.acc_year.trim(),
                refno: r.refno,
                date: (0, sales_doc_utils_1.isoDate)(r.doc_date),
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
            docQty: (0, sales_doc_utils_1.num)(r.doc_qty),
            openQty: (0, sales_doc_utils_1.num)(r.open_qty),
            freeQty: (0, sales_doc_utils_1.num)(r.free_qty),
            rate: (0, sales_doc_utils_1.num)(r.rate),
            taxId: r.tax_id,
            taxPerc: (0, sales_doc_utils_1.num)(r.tax_perc),
            hsnCode: r.hsn_code,
            allowNegativeStock: r.allow_negative_stock,
        });
    }
    return [...by.values()].map((d) => ({ ...d, ...extra(d) }));
}
//# sourceMappingURL=bill-read.service.js.map