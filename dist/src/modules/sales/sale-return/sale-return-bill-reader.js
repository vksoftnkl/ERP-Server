"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaleReturnBillReader = void 0;
exports.lineFactsOf = lineFactsOf;
const client_1 = require("@prisma/client");
const sale_return_money_1 = require("./sale-return-money");
const NIL = '00000000-0000-0000-0000-000000000000';
const LINE_COLUMNS = client_1.Prisma.sql `
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
const dec = (v) => v === null || v === undefined
    ? sale_return_money_1.ZERO
    : v instanceof client_1.Prisma.Decimal
        ? v
        : (0, sale_return_money_1.D)(v);
const decOrNull = (v) => (v === null || v === undefined ? null : dec(v));
const str = (v) => typeof v === 'string'
    ? v
    : typeof v === 'number' || typeof v === 'bigint' || typeof v === 'boolean'
        ? String(v)
        : null;
const iso = (v) => v instanceof Date
    ? v.toISOString().slice(0, 10)
    : typeof v === 'string' && v
        ? v.slice(0, 10)
        : null;
function lineFactsOf(r) {
    const parts = (0, sale_return_money_1.zeroParts)();
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
        factor: (0, sale_return_money_1.resolveFactor)(dec(r.sbi_to_base_factor), dec(r.unit_factor)),
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
            priceLevel: r.sbi_price_level === null || r.sbi_price_level === undefined
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
class SaleReturnBillReader {
    async billHeader(c, sbId, accYear) {
        const [b] = await c.$queryRaw `
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
            date: iso(b.sb_bill_date),
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
            salesmanIds: b.sb_salesman_id ?? [],
            loadmanIds: b.sb_loadman_id ?? [],
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
    async billLines(c, bill) {
        const rows = await c.$queryRaw `
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
    async lockBillHeader(tx, bill) {
        const rows = await tx.$queryRaw `
      SELECT sb_id FROM sales.sale_bill
       WHERE sb_id = ${bill.sbId}::uuid AND sb_acc_year = ${bill.accYear}::char(9)
         FOR UPDATE`;
        return rows.length;
    }
    async lockBillLines(tx, bill) {
        const rows = await tx.$queryRaw `
      SELECT sbi_id FROM sales.sale_bill_item
       WHERE sbi_bill_id = ${bill.sbId}::uuid AND sbi_acc_year = ${bill.accYear}::char(9) AND sbi_is_deleted = false
       ORDER BY sbi_id
         FOR UPDATE`;
        return rows.length;
    }
    async lockBillCharges(tx, bill) {
        const rows = await tx.$queryRaw `
      SELECT cd_id FROM public.txn_charge_detail
       WHERE cd_doc_type = 'INVOICE' AND cd_doc_id = ${bill.sbId}::uuid AND cd_acc_year = ${bill.accYear}::char(9)
         AND cd_is_deleted = false
       ORDER BY cd_id
         FOR UPDATE`;
        return rows.length;
    }
    async priorBack(c, bill, excludeSrId) {
        const rows = await c.$queryRaw `
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
        const out = new Map();
        for (const r of rows) {
            const parts = (0, sale_return_money_1.zeroParts)();
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
    async priorHeader(c, bill, excludeSrId) {
        const [r] = await c.$queryRaw `
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
    async billLoyaltyRules(c, bill) {
        const rows = await c.$queryRaw `
      SELECT DISTINCT ON (l.lld_txn_type) l.lld_txn_type AS txn, s.lsc_id,
             s.lsc_points_decimals, s.lsc_rounding_method, s.lsc_return_mode
        FROM sales.loyalty_ledger l
        JOIN sales.loyalty_scheme s ON s.lsc_id = l.lld_lsc_id
       WHERE l.lld_src_doc_type = 'SALE_BILL' AND l.lld_src_doc_id = ${bill.sbId}::uuid
         AND l.lld_src_acc_year = ${bill.accYear}::char(9)
         AND l.lld_txn_type IN ('EARN', 'REDEEM')
         AND l.lld_reversal_of_id IS NULL AND l.lld_is_deleted = false
       ORDER BY l.lld_txn_type, l.lld_row_no`;
        const ruleOf = (txn) => {
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
    async onDrafts(c, bill, excludeSrId) {
        const rows = await c.$queryRaw `
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
    async billCharges(c, bill, excludeSrId) {
        const rows = await c.$queryRaw `
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
            const fig = (p) => ({
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
            };
        });
    }
    async returnCharges(c, srId) {
        if (!srId) {
            return [];
        }
        const rows = await c.$queryRaw `
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
    async openBills(c, q) {
        const back = q.addBack ?? new Map();
        const backIds = [...back.keys()];
        if (q.lock) {
            await c.$queryRaw `
        SELECT abl_id FROM accounts.acc_bill_balance
         WHERE abl_company_id = ${q.companyId}::uuid AND abl_branch_id = ${q.branchId}::uuid
           AND abl_party_id = ${q.partyId}::uuid AND abl_dr_cr = 'DR' AND abl_is_deleted = false
           AND abl_is_active = true
           AND (COALESCE(abl_pending_amount, 0) > 0 OR abl_id = ANY(${backIds}::uuid[]))
         ORDER BY abl_id
           FOR UPDATE`;
        }
        const byBillDate = (q.sort ?? '').toUpperCase() === 'BILL_DATE';
        const rows = await c.$queryRaw `
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
            const given = back.get(ablId) ?? sale_return_money_1.ZERO;
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
    async unwindAddBack(c, srId) {
        if (!srId || !/^[0-9a-f-]{36}$/i.test(srId)) {
            return null;
        }
        const [head] = await c.$queryRaw `
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
            return { bills: new Map(), balance: sale_return_money_1.ZERO, partyId: null };
        }
        const rows = await c.$queryRaw `
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
        const bills = new Map();
        let balance = head.note_active ? dec(head.note_pending) : sale_return_money_1.ZERO;
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
    async billTenderRows(c, bill) {
        const rows = await c.$queryRaw `
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
    async receivedLater(c, bill) {
        const [r] = await c.$queryRaw `
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
        return client_1.Prisma.Decimal.max(sale_return_money_1.ZERO, dec(r?.amt));
    }
    async closedYears(c, companyId, years) {
        const want = [...new Set(years.map((y) => y.trim()).filter(Boolean))];
        if (want.length === 0) {
            return new Set();
        }
        const rows = await c.$queryRaw `
      SELECT fy_year_name AS y FROM public.fiscal_years
       WHERE comp_id = ${companyId}::uuid AND is_deleted = false
         AND fy_year_name = ANY(${want}::text[])
         AND (fy_status <> 'OPEN' OR (fy_lock_date IS NOT NULL AND fy_lock_date <= CURRENT_DATE))`;
        return new Set(rows.map((r) => String(r.y).trim()));
    }
    async customerBalance(c, companyId, partyId) {
        const [r] = await c.$queryRaw `
      SELECT SUM(CASE WHEN abl_dr_cr = 'DR' THEN COALESCE(abl_pending_amount, 0)
                      ELSE -COALESCE(abl_pending_amount, 0) END) AS bal
        FROM accounts.acc_bill_balance
       WHERE abl_company_id = ${companyId}::uuid AND abl_party_id = ${partyId}::uuid
         AND abl_is_deleted = false AND abl_is_active = true`;
        return dec(r?.bal);
    }
    async approvalsOf(c, srId) {
        if (!srId) {
            return [];
        }
        const rows = await c.$queryRaw `
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
            requestedOn: r.tap_requested_on ?? null,
            requestNote: str(r.tap_request_note),
            decidedBy: str(r.tap_decided_by),
            decidedByName: str(r.decided_name),
            decidedOn: r.tap_decided_on ?? null,
            decisionNote: str(r.tap_decision_note),
            usedOn: str(r.used_on),
        }));
    }
    async sessionOf(c, sessionId) {
        if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
            return null;
        }
        const [r] = await c.$queryRaw `
      SELECT tss_status, tss_session_no FROM accounts.till_session
       WHERE tss_id = ${sessionId}::uuid AND tss_is_deleted = false`;
        return r ? { status: r.tss_status, sessionNo: str(r.tss_session_no) } : null;
    }
    async schemes(c, ids) {
        const want = [...new Set(ids.filter(Boolean))];
        const out = new Map();
        if (want.length === 0) {
            return out;
        }
        const rows = await c.$queryRaw `
      SELECT p.prm_id, p.prm_code, p.prm_name, p.prm_apply_on, p.prm_benefit, p.prm_include_tax,
             p.prm_min_qty, p.prm_min_bill_amount, s.prs_exceeds, s.prs_upto, s.prs_benefit
        FROM sales.promotion_scheme p
        LEFT JOIN sales.promotion_scheme_slab s
               ON s.prs_prm_id = p.prm_id AND s.prs_is_active = true AND s.prs_is_deleted = false
       WHERE p.prm_id = ANY(${want}::uuid[])
       ORDER BY p.prm_id, s.prs_slno`;
        for (const r of rows) {
            const id = String(r.prm_id);
            const s = out.get(id) ??
                {
                    prmId: id,
                    code: str(r.prm_code),
                    name: str(r.prm_name),
                    applyOn: str(r.prm_apply_on),
                    benefit: str(r.prm_benefit),
                    includeTax: r.prm_include_tax === true,
                    minQty: dec(r.prm_min_qty),
                    minBillAmount: dec(r.prm_min_bill_amount),
                    slabs: [],
                };
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
    async units(c, unitIds) {
        const ids = [...new Set(unitIds.filter(Boolean))];
        if (ids.length === 0) {
            return new Map();
        }
        const rows = await c.$queryRaw `
      SELECT iuc.iuc_id, iuc.iuc_item_id, iuc.iuc_to_base_factor, iuc.iuc_uom_weight, iuc.iuc_is_base_unit, um.unit_name
        FROM inventory.item_unit_conversion iuc
        LEFT JOIN inventory.item_unit_master um ON um.unit_id = iuc.iuc_unit_id
       WHERE iuc.iuc_id = ANY(${ids}::uuid[]) AND iuc.iuc_is_deleted = false`;
        return new Map(rows.map((r) => [String(r.iuc_id), unitRowOf(r)]));
    }
    async lineNames(c, lines) {
        const ids = (pick) => [
            ...new Set(lines.map(pick).filter((v) => typeof v === 'string' && v !== '')),
        ];
        const itemIds = ids((l) => l.itemId);
        const unitIds = ids((l) => l.itemUnitId);
        const godownIds = ids((l) => l.godownId);
        const [items, units, godowns] = await Promise.all([
            itemIds.length === 0
                ? []
                : c.$queryRaw `
            SELECT item_id AS id, item_name_en AS name FROM inventory.item_master
             WHERE item_id = ANY(${itemIds}::uuid[])`,
            unitIds.length === 0
                ? []
                : c.$queryRaw `
            SELECT iuc.iuc_id AS id, um.unit_name AS name
              FROM inventory.item_unit_conversion iuc
              LEFT JOIN inventory.item_unit_master um ON um.unit_id = iuc.iuc_unit_id
             WHERE iuc.iuc_id = ANY(${unitIds}::uuid[])`,
            godownIds.length === 0
                ? []
                : c.$queryRaw `
            SELECT gdl_id AS id, gdl_name AS name FROM inventory.godown_locations
             WHERE gdl_id = ANY(${godownIds}::uuid[])`,
        ]);
        const byId = (rows) => new Map(rows.filter((r) => r.name !== null).map((r) => [r.id, r.name]));
        return { items: byId(items), units: byId(units), godowns: byId(godowns) };
    }
    async itemUnits(c, itemIds) {
        const ids = [...new Set(itemIds.filter(Boolean))];
        const out = new Map();
        if (ids.length === 0) {
            return out;
        }
        const rows = await c.$queryRaw `
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
    async barcodes(c, itemIds) {
        const ids = [...new Set(itemIds.filter(Boolean))];
        const out = new Map();
        if (ids.length === 0) {
            return out;
        }
        const rows = await c.$queryRaw `
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
    async lots(c, lotIds) {
        const ids = [...new Set(lotIds.filter(Boolean))];
        if (ids.length === 0) {
            return new Map();
        }
        const rows = await c.$queryRaw `
      SELECT slt_id, slt_batch_no, slt_expiry_date FROM stock.stock_lot WHERE slt_id = ANY(${ids}::uuid[])`;
        return new Map(rows.map((r) => [
            r.slt_id,
            { lotId: r.slt_id, batchNo: r.slt_batch_no, expiryDate: iso(r.slt_expiry_date) },
        ]));
    }
    async billTenders(c, bill) {
        const [r] = await c.$queryRaw `
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
    async billDue(c, bill, addBack) {
        const [r] = await c.$queryRaw `
      SELECT abl_id, abl_pending_amount AS due FROM accounts.acc_bill_balance
       WHERE abl_src_doc_id = ${bill.sbId}::uuid AND abl_acc_year = ${bill.accYear}::char(9)
         AND abl_src_doc_type = 'SALE_BILL' AND abl_is_deleted = false AND abl_is_active = true
       LIMIT 1`;
        return r ? dec(r.due).plus(addBack?.get(String(r.abl_id)) ?? sale_return_money_1.ZERO) : sale_return_money_1.ZERO;
    }
    async lastSale(c, q) {
        const picked = q.srcItemId && q.srcAccYear;
        const rows = await c.$queryRaw `
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
        return { facts: lineFactsOf(r), refno: str(r.sb_bill_refno), date: iso(r.sb_bill_date) };
    }
    async todayPrice(c, q, askFactor) {
        const rows = await c.$queryRaw `
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
        const [item] = await c.$queryRaw `
      SELECT im.item_default_tax_id, im.item_hsn_code, t.tax_rate_perc, t.tax_cess_perc
        FROM inventory.item_master im
        LEFT JOIN inventory.tax_rate_master t ON t.tax_id = im.item_default_tax_id
       WHERE im.item_id = ${q.itemId}::uuid`;
        const taxPerc = dec(item?.tax_rate_perc);
        const cessPerc = dec(item?.tax_cess_perc);
        const level = q.priceLevel ?? 1;
        const p = rows[0];
        let incl = sale_return_money_1.ZERO;
        let wot = sale_return_money_1.ZERO;
        if (p) {
            const col = ['a', 'b', 'c', 'd'][level - 1];
            if (col) {
                incl = dec(p[`ipm_sales_price_${col}`]);
                wot = dec(p[`ipm_price_${col}_wot`]);
            }
            else if (level === 5) {
                incl = dec(p.ipm_max_price);
            }
            else if (level === 6) {
                incl = dec(p.ipm_min_price);
            }
            else if (level === 7) {
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
            if (String(p.ipm_uc_unit_id) !== q.itemUnitId) {
                const rowFactor = (0, sale_return_money_1.resolveFactor)(null, dec(p.iuc_to_base_factor));
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
    async company(c, companyId) {
        const [r] = await c.$queryRaw `
      SELECT comp_state_code, comp_einvoice_applicable FROM public.companys WHERE comp_id = ${companyId}::uuid`;
        return {
            stateCode: r?.comp_state_code ?? null,
            einvoice: r?.comp_einvoice_applicable ?? false,
        };
    }
    async reason(c, reasonId) {
        if (!reasonId) {
            return null;
        }
        const [r] = await c.$queryRaw `
      SELECT srm_refund_charges, srm_default_condition FROM stock.stock_reason_master
       WHERE srm_id = ${reasonId}::uuid AND srm_is_deleted = false`;
        return r
            ? { refundCharges: r.srm_refund_charges, defaultCondition: r.srm_default_condition }
            : null;
    }
}
exports.SaleReturnBillReader = SaleReturnBillReader;
const ONE_HUNDRED = (0, sale_return_money_1.D)(100);
function unitRowOf(r) {
    return {
        itemUnitId: String(r.iuc_id),
        itemId: String(r.iuc_item_id),
        unitName: str(r.unit_name),
        factor: (0, sale_return_money_1.resolveFactor)(null, dec(r.iuc_to_base_factor)),
        weight: decOrNull(r.iuc_uom_weight),
        isBase: r.iuc_is_base_unit === true,
    };
}
//# sourceMappingURL=sale-return-bill-reader.js.map