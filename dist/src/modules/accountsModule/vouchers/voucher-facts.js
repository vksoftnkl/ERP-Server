"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GENERATED_ROLES = void 0;
exports.loadCompanyFacts = loadCompanyFacts;
exports.loadLedgerFacts = loadLedgerFacts;
exports.isMoneyLedger = isMoneyLedger;
exports.loadInstrumentLedgers = loadInstrumentLedgers;
exports.loadTaxRates = loadTaxRates;
exports.loadGeneratedRoleLedgers = loadGeneratedRoleLedgers;
exports.resolveRoleLedgerMap = resolveRoleLedgerMap;
exports.loadTdsRate = loadTdsRate;
exports.loadTdsAnnualBase = loadTdsAnnualBase;
exports.loadPartyCreditDays = loadPartyCreditDays;
exports.loadStateName = loadStateName;
exports.loadBills = loadBills;
exports.billKey = billKey;
exports.itcClassOf = itcClassOf;
const client_1 = require("@prisma/client");
const ledger_map_helper_1 = require("../ledgerRole/ledger-map.helper");
const PARTY_GROUPS = new Set(['sundry debtors', 'sundry creditors']);
const MONEY_GROUPS = new Set(['cash-in-hand', 'bank accounts', 'bank od a/c']);
async function loadCompanyFacts(tx, companyId) {
    const rows = await tx.$queryRaw `
    SELECT comp_id, comp_name, comp_state_code, comp_gstin_no, comp_einvoice_applicable
      FROM public.companys WHERE comp_id = ${companyId}::uuid`;
    const r = rows[0];
    return r
        ? {
            companyId: r.comp_id,
            name: r.comp_name,
            stateCode: r.comp_state_code.trim(),
            gstin: r.comp_gstin_no,
            einvoiceApplicable: r.comp_einvoice_applicable,
        }
        : null;
}
async function loadLedgerFacts(tx, companyId, ledgerIds) {
    const out = new Map();
    const ids = [...new Set(ledgerIds.filter((id) => !!id))];
    if (ids.length === 0) {
        return out;
    }
    const rows = await tx.$queryRaw `
    WITH RECURSIVE anc AS (
      SELECT l.led_id, g.acc_group_id, g.acc_group_name, g.acc_group_parent_id, 0 AS depth
        FROM accounts.acc_ledger_master l
        JOIN accounts.acc_group_master g ON g.acc_group_id = l.led_group_id
       WHERE l.led_id = ANY(${ids}::uuid[])
      UNION ALL
      SELECT a.led_id, p.acc_group_id, p.acc_group_name, p.acc_group_parent_id, a.depth + 1
        FROM anc a
        JOIN accounts.acc_group_master p ON p.acc_group_id = a.acc_group_parent_id
       WHERE a.depth < 24
    ),
    path AS (
      SELECT led_id,
             array_agg(acc_group_id ORDER BY depth)   AS group_path,
             array_agg(acc_group_name ORDER BY depth) AS group_names
        FROM anc GROUP BY led_id
    )
    SELECT l.led_id, l.led_name, l.led_is_active, l.led_is_deleted, l.led_group_id,
           l.led_is_bill_by_bill, l.led_tax_id, l.led_itc_eligibility,
           l.led_is_tds_applicable, l.led_tds_nature_of_payment, l.led_tds_deductee_type,
           l.led_pan_no, l.led_gstin_no, l.led_gst_party_reg_type, l.led_state_code,
           l.led_state_name, l.led_addr1, l.led_addr2, l.led_addr3, l.led_city, l.led_pin,
           p.group_path, p.group_names
      FROM accounts.acc_ledger_master l
      JOIN path p ON p.led_id = l.led_id
     WHERE l.led_id = ANY(${ids}::uuid[])
       AND (l.led_company_id IS NULL OR l.led_company_id = ${companyId}::uuid)`;
    for (const r of rows) {
        const names = r.group_names.map((n) => n.toLowerCase());
        out.set(r.led_id, {
            ledId: r.led_id,
            name: r.led_name,
            isActive: r.led_is_active,
            isDeleted: r.led_is_deleted,
            groupId: r.led_group_id,
            groupName: r.group_names[0] ?? '',
            groupPath: r.group_path,
            groupNames: r.group_names,
            isParty: names.some((n) => PARTY_GROUPS.has(n)),
            isBillByBill: r.led_is_bill_by_bill,
            taxId: r.led_tax_id,
            itcEligibility: r.led_itc_eligibility,
            isTdsApplicable: r.led_is_tds_applicable,
            tdsSection: r.led_tds_nature_of_payment,
            tdsDeducteeType: r.led_tds_deductee_type,
            pan: r.led_pan_no,
            gstin: r.led_gstin_no,
            gstType: r.led_gst_party_reg_type,
            stateCode: r.led_state_code?.trim() ?? null,
            stateName: r.led_state_name,
            addr1: r.led_addr1,
            addr2: r.led_addr2,
            addr3: r.led_addr3,
            city: r.led_city,
            pin: r.led_pin,
        });
    }
    return out;
}
function isMoneyLedger(l) {
    return l.groupNames.some((n) => MONEY_GROUPS.has(n.toLowerCase()));
}
async function loadInstrumentLedgers(tx, companyId) {
    const rows = await tx.$queryRaw `
    WITH RECURSIVE tl AS (
      SELECT t.tnd_ledger_id AS led_id
        FROM accounts.acc_tender_master t
        JOIN accounts.acc_tender_types y ON y.ttm_type_id = t.tnd_type_id
       WHERE t.tnd_company_id = ${companyId}::uuid AND t.tnd_is_deleted = false
         AND y.ttm_is_cash = false
      UNION
      SELECT t.tnd_settlement_ledger_id
        FROM accounts.acc_tender_master t
        JOIN accounts.acc_tender_types y ON y.ttm_type_id = t.tnd_type_id
       WHERE t.tnd_company_id = ${companyId}::uuid AND t.tnd_is_deleted = false
         AND y.ttm_is_cash = false AND t.tnd_settlement_ledger_id IS NOT NULL
    ),
    anc AS (
      SELECT l.led_id, g.acc_group_id, g.acc_group_name, g.acc_group_parent_id, 0 AS depth
        FROM accounts.acc_ledger_master l
        JOIN accounts.acc_group_master g ON g.acc_group_id = l.led_group_id
       WHERE l.led_id IN (SELECT led_id FROM tl)
      UNION ALL
      SELECT a.led_id, p.acc_group_id, p.acc_group_name, p.acc_group_parent_id, a.depth + 1
        FROM anc a JOIN accounts.acc_group_master p ON p.acc_group_id = a.acc_group_parent_id
       WHERE a.depth < 24
    ),
    money AS (
      SELECT DISTINCT led_id FROM anc
       WHERE lower(acc_group_name) IN ('cash-in-hand', 'bank accounts', 'bank od a/c')
    )
    SELECT led_id FROM tl WHERE led_id NOT IN (SELECT led_id FROM money)
    UNION
    SELECT l.led_id FROM accounts.acc_ledger_master l
     WHERE (l.led_company_id IS NULL OR l.led_company_id = ${companyId}::uuid)
       AND l.led_is_deleted = false
       AND accounts.fn_is_cheques_in_hand_ledger(l.led_id)`;
    return new Set(rows.map((r) => r.led_id));
}
async function loadTaxRates(tx, taxIds) {
    const out = new Map();
    const ids = [...new Set(taxIds.filter((id) => !!id))];
    if (ids.length === 0) {
        return out;
    }
    const rows = await tx.$queryRaw `
    SELECT tax_id, tax_name, tax_rate_perc, tax_cgst_perc, tax_sgst_perc, tax_igst_perc,
           tax_cess_perc, tax_cess_basis, tax_taxability, tax_is_reverse_charge, tax_is_active
      FROM inventory.tax_rate_master
     WHERE tax_id = ANY(${ids}::uuid[]) AND tax_is_deleted = false`;
    for (const r of rows) {
        out.set(r.tax_id, {
            taxId: r.tax_id,
            name: r.tax_name,
            ratePerc: new client_1.Prisma.Decimal(r.tax_rate_perc),
            cgstPerc: new client_1.Prisma.Decimal(r.tax_cgst_perc ?? 0),
            sgstPerc: new client_1.Prisma.Decimal(r.tax_sgst_perc ?? 0),
            igstPerc: new client_1.Prisma.Decimal(r.tax_igst_perc ?? 0),
            cessPerc: new client_1.Prisma.Decimal(r.tax_cess_perc),
            cessBasis: r.tax_cess_basis,
            taxability: r.tax_taxability,
            isReverseCharge: r.tax_is_reverse_charge,
            isActive: r.tax_is_active,
        });
    }
    return out;
}
exports.GENERATED_ROLES = [
    'INPUT_CGST',
    'INPUT_SGST',
    'INPUT_IGST',
    'INPUT_CESS',
    'OUTPUT_CGST',
    'OUTPUT_SGST',
    'OUTPUT_IGST',
    'OUTPUT_CESS',
    'RCM_CGST_PAYABLE',
    'RCM_SGST_PAYABLE',
    'RCM_IGST_PAYABLE',
    'TDS_PAYABLE',
];
async function loadGeneratedRoleLedgers(tx, companyId, branchId) {
    const roles = [...exports.GENERATED_ROLES];
    const rows = await tx.$queryRaw `
    SELECT alm_ledger_id AS led_id FROM accounts.acc_ledger_map
     WHERE alm_role = ANY(${roles}::text[]) AND alm_is_deleted = false AND alm_is_active = true
       AND (alm_company_id IS NULL OR alm_company_id = ${companyId}::uuid)
       AND (alm_branch_id IS NULL OR alm_branch_id = ${branchId}::uuid)
    UNION
    SELECT trl_ledger_id FROM inventory.tax_rate_ledger
     WHERE trl_role = ANY(${roles}::text[]) AND trl_is_deleted = false AND trl_is_active = true`;
    return new Set(rows.map((r) => r.led_id));
}
async function resolveRoleLedgerMap(tx, companyId, branchId, asks) {
    if (asks.length === 0) {
        return new Map();
    }
    return (0, ledger_map_helper_1.resolveRoleLedgers)(tx, asks.map((a) => ({ role: a.role, taxId: a.taxId, supplyNature: a.supplyNature })), { companyId, branchId, where: 'voucher register' });
}
async function loadTdsRate(tx, companyId, section, deducteeType, onDate) {
    const deductee = deducteeType?.trim().toUpperCase() || 'ANY';
    const rows = await tx.$queryRaw `
    SELECT tdr_section, tdr_section_name, tdr_deductee_type, tdr_rate, tdr_no_pan_rate,
           tdr_threshold_single, tdr_threshold_annual
      FROM accounts.tds_rates
     WHERE tdr_section = ${section}
       AND tdr_deductee_type IN (${deductee}, 'ANY')
       AND tdr_is_deleted = false AND tdr_is_active = true
       AND tdr_effective_from <= ${onDate}::date
       AND (tdr_effective_to IS NULL OR tdr_effective_to >= ${onDate}::date)
       AND (tdr_company_id IS NULL OR tdr_company_id = ${companyId}::uuid)
     ORDER BY (tdr_company_id IS NOT NULL) DESC,
              (tdr_deductee_type <> 'ANY') DESC,
              tdr_effective_from DESC
     LIMIT 1`;
    const r = rows[0];
    return r
        ? {
            section: r.tdr_section,
            sectionName: r.tdr_section_name,
            deducteeType: r.tdr_deductee_type,
            rate: new client_1.Prisma.Decimal(r.tdr_rate),
            noPanRate: new client_1.Prisma.Decimal(r.tdr_no_pan_rate),
            thresholdSingle: new client_1.Prisma.Decimal(r.tdr_threshold_single),
            thresholdAnnual: new client_1.Prisma.Decimal(r.tdr_threshold_annual),
        }
        : null;
}
async function loadTdsAnnualBase(tx, companyId, partyId, accYear, section) {
    const rows = await tx.$queryRaw `
    SELECT SUM(t.atd_base_amount) AS base
      FROM accounts.acc_tds_register t
     WHERE t.atd_company_id = ${companyId}::uuid
       AND t.atd_party_id   = ${partyId}::uuid
       AND t.atd_acc_year   = ${accYear}::char(9)
       AND t.atd_section    = ${section}
       AND t.atd_direction  = 'DEDUCTED'
       AND t.atd_is_deleted = false
       AND t.atd_reversal_of_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM accounts.acc_tds_register r
                        WHERE r.atd_reversal_of_id = t.atd_id AND r.atd_is_deleted = false)`;
    return new client_1.Prisma.Decimal(rows[0]?.base ?? 0);
}
async function loadPartyCreditDays(tx, partyId) {
    const rows = await tx.$queryRaw `
    SELECT COALESCE(
             (SELECT c.cus_credit_days FROM sales.customers c WHERE c.cus_id = ${partyId}::uuid LIMIT 1),
             (SELECT s.sup_credit_days FROM purchase.suppliers s WHERE s.sup_id = ${partyId}::uuid LIMIT 1),
             0)::int AS days`;
    return Number(rows[0]?.days ?? 0);
}
async function loadStateName(tx, stateCode) {
    if (!stateCode) {
        return null;
    }
    const rows = await tx.$queryRaw `
    SELECT state_name FROM fixed.state_codes WHERE state_code = ${stateCode}::bpchar LIMIT 1`;
    return rows[0]?.state_name ?? null;
}
async function loadBills(tx, bills, lock) {
    const out = new Map();
    if (bills.length === 0) {
        return out;
    }
    const ids = [...new Set(bills.map((b) => b.billId))];
    const years = [...new Set(bills.map((b) => b.billAccYear))];
    const rows = await tx.$queryRaw `
    SELECT abl_id, abl_acc_year, abl_party_id, abl_bill_type, abl_doc_refno, abl_doc_date,
           abl_dr_cr, abl_bill_amount, abl_pending_amount, abl_is_deleted, abl_is_active,
           abl_company_id
      FROM accounts.acc_bill_balance
     WHERE abl_id = ANY(${ids}::uuid[]) AND abl_acc_year = ANY(${years}::bpchar[])
     ORDER BY abl_id
     ${lock ? client_1.Prisma.sql `FOR UPDATE` : client_1.Prisma.empty}`;
    for (const r of rows) {
        out.set(billKey(r.abl_id, r.abl_acc_year), {
            ablId: r.abl_id,
            ablAccYear: r.abl_acc_year.trim(),
            partyId: r.abl_party_id,
            billType: r.abl_bill_type,
            docRefno: r.abl_doc_refno,
            docDate: r.abl_doc_date,
            side: r.abl_dr_cr.trim(),
            billAmount: new client_1.Prisma.Decimal(r.abl_bill_amount),
            pendingAmount: new client_1.Prisma.Decimal(r.abl_pending_amount),
            isDeleted: r.abl_is_deleted,
            isActive: r.abl_is_active,
            companyId: r.abl_company_id,
        });
    }
    return out;
}
function billKey(billId, accYear) {
    return `${billId}|${accYear.trim()}`;
}
function itcClassOf(ledgerItc) {
    switch ((ledgerItc ?? '').toUpperCase()) {
        case 'ELIGIBLE':
            return 'INPUTS';
        case 'INPUT_SERVICES':
            return 'INPUT_SERVICES';
        case 'CAPITAL_GOODS':
            return 'CAPITAL_GOODS';
        case 'INELIGIBLE_17_5':
        case 'INELIGIBLE_OTHER':
            return 'INELIGIBLE';
        default:
            return null;
    }
}
//# sourceMappingURL=voucher-facts.js.map