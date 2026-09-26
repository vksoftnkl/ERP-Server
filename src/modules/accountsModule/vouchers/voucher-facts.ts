import { Prisma } from '@prisma/client';
import {
  resolveRoleLedgers,
  type ResolvedRoleLedger,
  type SupplyNature,
} from '../ledgerRole/ledger-map.helper';

/**
 * The facts the derivation (voucher-derive.ts) is fed. Every read the
 * posting routine needs is here, so `derive()` itself touches no database and
 * is unit-testable with a hand-made input.
 */

export interface CompanyFacts {
  companyId: string;
  name: string;
  stateCode: string;
  gstin: string | null;
  einvoiceApplicable: boolean;
}

export interface LedgerFacts {
  ledId: string;
  name: string;
  isActive: boolean;
  isDeleted: boolean;
  groupId: string;
  groupName: string;
  /** This ledger's group and every ancestor, nearest first. */
  groupPath: string[];
  groupNames: string[];
  isParty: boolean;
  isBillByBill: boolean;
  taxId: string | null;
  /** The ledger's OWN vocabulary (chk_led_itc_eligibility). */
  itcEligibility: string | null;
  isTdsApplicable: boolean;
  tdsSection: string | null;
  tdsDeducteeType: string | null;
  pan: string | null;
  gstin: string | null;
  gstType: string | null;
  stateCode: string | null;
  stateName: string | null;
  addr1: string | null;
  addr2: string | null;
  addr3: string | null;
  city: string | null;
  pin: string | null;
}

export interface TaxRateFacts {
  taxId: string;
  name: string;
  ratePerc: Prisma.Decimal;
  cgstPerc: Prisma.Decimal;
  sgstPerc: Prisma.Decimal;
  igstPerc: Prisma.Decimal;
  cessPerc: Prisma.Decimal;
  cessBasis: string;
  taxability: string;
  isReverseCharge: boolean;
  isActive: boolean;
}

export interface TdsRateFacts {
  section: string;
  sectionName: string;
  deducteeType: string;
  rate: Prisma.Decimal;
  noPanRate: Prisma.Decimal;
  thresholdSingle: Prisma.Decimal;
  thresholdAnnual: Prisma.Decimal;
}

export interface BillFacts {
  ablId: string;
  ablAccYear: string;
  partyId: string;
  billType: string;
  docRefno: string;
  docDate: Date;
  side: 'DR' | 'CR';
  billAmount: Prisma.Decimal;
  pendingAmount: Prisma.Decimal;
  isDeleted: boolean;
  isActive: boolean;
  companyId: string;
}

const PARTY_GROUPS = new Set(['sundry debtors', 'sundry creditors']);
const MONEY_GROUPS = new Set(['cash-in-hand', 'bank accounts', 'bank od a/c']);

export async function loadCompanyFacts(
  tx: Prisma.TransactionClient,
  companyId: string,
): Promise<CompanyFacts | null> {
  const rows = await tx.$queryRaw<
    {
      comp_id: string;
      comp_name: string;
      comp_state_code: string;
      comp_gstin_no: string | null;
      comp_einvoice_applicable: boolean;
    }[]
  >`
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

/**
 * The ledgers named, with their whole group ancestry — one round trip, one
 * recursive CTE. A ledger visible to the company: shared (`led_company_id IS
 * NULL`) or the company's own.
 */
export async function loadLedgerFacts(
  tx: Prisma.TransactionClient,
  companyId: string,
  ledgerIds: readonly string[],
): Promise<Map<string, LedgerFacts>> {
  const out = new Map<string, LedgerFacts>();
  const ids = [...new Set(ledgerIds.filter((id) => !!id))];
  if (ids.length === 0) {
    return out;
  }
  const rows = await tx.$queryRaw<
    {
      led_id: string;
      led_name: string;
      led_is_active: boolean;
      led_is_deleted: boolean;
      led_group_id: string;
      led_is_bill_by_bill: boolean;
      led_tax_id: string | null;
      led_itc_eligibility: string | null;
      led_is_tds_applicable: boolean;
      led_tds_nature_of_payment: string | null;
      led_tds_deductee_type: string | null;
      led_pan_no: string | null;
      led_gstin_no: string | null;
      led_gst_party_reg_type: string | null;
      led_state_code: string | null;
      led_state_name: string | null;
      led_addr1: string | null;
      led_addr2: string | null;
      led_addr3: string | null;
      led_city: string | null;
      led_pin: string | null;
      group_path: string[];
      group_names: string[];
    }[]
  >`
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

/** Is this ledger under a cash / bank group? (Any ancestor counts.) */
export function isMoneyLedger(l: Pick<LedgerFacts, 'groupNames'>): boolean {
  return l.groupNames.some((n) => MONEY_GROUPS.has(n.toLowerCase()));
}

/**
 * §3 "No leg on an instrument-controlled ledger": Cheques in Hand (the
 * function the reconcile uses), plus the holding / clearing ledger of every
 * non-cash tender of the company — EXCEPT a bank or cash ledger a tender
 * settles straight into, which a Contra must be free to move. Those belong to
 * Received / Issued Cheques (menus 51 / 52).
 */
export async function loadInstrumentLedgers(
  tx: Prisma.TransactionClient,
  companyId: string,
): Promise<Set<string>> {
  const rows = await tx.$queryRaw<{ led_id: string }[]>`
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

export async function loadTaxRates(
  tx: Prisma.TransactionClient,
  taxIds: readonly string[],
): Promise<Map<string, TaxRateFacts>> {
  const out = new Map<string, TaxRateFacts>();
  const ids = [...new Set(taxIds.filter((id) => !!id))];
  if (ids.length === 0) {
    return out;
  }
  const rows = await tx.$queryRaw<
    {
      tax_id: string;
      tax_name: string;
      tax_rate_perc: Prisma.Decimal;
      tax_cgst_perc: Prisma.Decimal | null;
      tax_sgst_perc: Prisma.Decimal | null;
      tax_igst_perc: Prisma.Decimal | null;
      tax_cess_perc: Prisma.Decimal;
      tax_cess_basis: string;
      tax_taxability: string;
      tax_is_reverse_charge: boolean;
      tax_is_active: boolean;
    }[]
  >`
    SELECT tax_id, tax_name, tax_rate_perc, tax_cgst_perc, tax_sgst_perc, tax_igst_perc,
           tax_cess_perc, tax_cess_basis, tax_taxability, tax_is_reverse_charge, tax_is_active
      FROM inventory.tax_rate_master
     WHERE tax_id = ANY(${ids}::uuid[]) AND tax_is_deleted = false`;
  for (const r of rows) {
    out.set(r.tax_id, {
      taxId: r.tax_id,
      name: r.tax_name,
      ratePerc: new Prisma.Decimal(r.tax_rate_perc),
      cgstPerc: new Prisma.Decimal(r.tax_cgst_perc ?? 0),
      sgstPerc: new Prisma.Decimal(r.tax_sgst_perc ?? 0),
      igstPerc: new Prisma.Decimal(r.tax_igst_perc ?? 0),
      cessPerc: new Prisma.Decimal(r.tax_cess_perc),
      cessBasis: r.tax_cess_basis,
      taxability: r.tax_taxability,
      isReverseCharge: r.tax_is_reverse_charge,
      isActive: r.tax_is_active,
    });
  }
  return out;
}

/** The roles whose ledgers the band GENERATES; a typed line on one is refused on a GST type. */
export const GENERATED_ROLES = [
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
] as const;

/** Every ledger any of these roles maps to, globally or for this company / branch. */
export async function loadGeneratedRoleLedgers(
  tx: Prisma.TransactionClient,
  companyId: string,
  branchId: string,
): Promise<Set<string>> {
  const roles = [...GENERATED_ROLES];
  const rows = await tx.$queryRaw<{ led_id: string }[]>`
    SELECT alm_ledger_id AS led_id FROM accounts.acc_ledger_map
     WHERE alm_role = ANY(${roles}::text[]) AND alm_is_deleted = false AND alm_is_active = true
       AND (alm_company_id IS NULL OR alm_company_id = ${companyId}::uuid)
       AND (alm_branch_id IS NULL OR alm_branch_id = ${branchId}::uuid)
    UNION
    SELECT trl_ledger_id FROM inventory.tax_rate_ledger
     WHERE trl_role = ANY(${roles}::text[]) AND trl_is_deleted = false AND trl_is_active = true`;
  return new Set(rows.map((r) => r.led_id));
}

export interface RoleLedgerAsk {
  role: string;
  taxId: string | null;
  supplyNature: SupplyNature | null;
}

/**
 * Which ledger each (role, rate, supply nature) posts to — `tax_rate_ledger`
 * first, then `acc_ledger_map` — through the one resolver every posting uses.
 * Non-throwing: a gap comes back as null and the derivation names it.
 */
export async function resolveRoleLedgerMap(
  tx: Prisma.TransactionClient,
  companyId: string,
  branchId: string,
  asks: readonly RoleLedgerAsk[],
): Promise<Map<string, ResolvedRoleLedger | null>> {
  if (asks.length === 0) {
    return new Map();
  }
  return resolveRoleLedgers(
    tx,
    asks.map((a) => ({ role: a.role, taxId: a.taxId, supplyNature: a.supplyNature })),
    { companyId, branchId, where: 'voucher register' },
  );
}

/**
 * §5.6 / §7.3 step 5 — the TDS rate in force: section × deductee type × date,
 * the company's own row over the shared one, the exact deductee over 'ANY'.
 */
export async function loadTdsRate(
  tx: Prisma.TransactionClient,
  companyId: string,
  section: string,
  deducteeType: string | null,
  onDate: string,
): Promise<TdsRateFacts | null> {
  const deductee = deducteeType?.trim().toUpperCase() || 'ANY';
  const rows = await tx.$queryRaw<
    {
      tdr_section: string;
      tdr_section_name: string;
      tdr_deductee_type: string;
      tdr_rate: Prisma.Decimal;
      tdr_no_pan_rate: Prisma.Decimal;
      tdr_threshold_single: Prisma.Decimal;
      tdr_threshold_annual: Prisma.Decimal;
    }[]
  >`
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
        rate: new Prisma.Decimal(r.tdr_rate),
        noPanRate: new Prisma.Decimal(r.tdr_no_pan_rate),
        thresholdSingle: new Prisma.Decimal(r.tdr_threshold_single),
        thresholdAnnual: new Prisma.Decimal(r.tdr_threshold_annual),
      }
    : null;
}

/** Σ base already deducted from this party under this section in the year — live rows only. */
export async function loadTdsAnnualBase(
  tx: Prisma.TransactionClient,
  companyId: string,
  partyId: string,
  accYear: string,
  section: string,
): Promise<Prisma.Decimal> {
  const rows = await tx.$queryRaw<{ base: Prisma.Decimal | null }[]>`
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
  return new Prisma.Decimal(rows[0]?.base ?? 0);
}

/** cus_credit_days / sup_credit_days — the party's master row shares the ledger's id. */
export async function loadPartyCreditDays(
  tx: Prisma.TransactionClient,
  partyId: string,
): Promise<number> {
  const rows = await tx.$queryRaw<{ days: number | null }[]>`
    SELECT COALESCE(
             (SELECT c.cus_credit_days FROM sales.customers c WHERE c.cus_id = ${partyId}::uuid LIMIT 1),
             (SELECT s.sup_credit_days FROM purchase.suppliers s WHERE s.sup_id = ${partyId}::uuid LIMIT 1),
             0)::int AS days`;
  return Number(rows[0]?.days ?? 0);
}

export async function loadStateName(
  tx: Prisma.TransactionClient,
  stateCode: string | null,
): Promise<string | null> {
  if (!stateCode) {
    return null;
  }
  const rows = await tx.$queryRaw<{ state_name: string }[]>`
    SELECT state_name FROM fixed.state_codes WHERE state_code = ${stateCode}::bpchar LIMIT 1`;
  return rows[0]?.state_name ?? null;
}

/** Bills by (id, year), read plainly or under FOR UPDATE — the post locks, the validate reads. */
export async function loadBills(
  tx: Prisma.TransactionClient,
  bills: readonly { billId: string; billAccYear: string }[],
  lock: boolean,
): Promise<Map<string, BillFacts>> {
  const out = new Map<string, BillFacts>();
  if (bills.length === 0) {
    return out;
  }
  const ids = [...new Set(bills.map((b) => b.billId))];
  const years = [...new Set(bills.map((b) => b.billAccYear))];
  const rows = await tx.$queryRaw<
    {
      abl_id: string;
      abl_acc_year: string;
      abl_party_id: string;
      abl_bill_type: string;
      abl_doc_refno: string;
      abl_doc_date: Date;
      abl_dr_cr: string;
      abl_bill_amount: Prisma.Decimal;
      abl_pending_amount: Prisma.Decimal;
      abl_is_deleted: boolean;
      abl_is_active: boolean;
      abl_company_id: string;
    }[]
  >`
    SELECT abl_id, abl_acc_year, abl_party_id, abl_bill_type, abl_doc_refno, abl_doc_date,
           abl_dr_cr, abl_bill_amount, abl_pending_amount, abl_is_deleted, abl_is_active,
           abl_company_id
      FROM accounts.acc_bill_balance
     WHERE abl_id = ANY(${ids}::uuid[]) AND abl_acc_year = ANY(${years}::bpchar[])
     ORDER BY abl_id
     ${lock ? Prisma.sql`FOR UPDATE` : Prisma.empty}`;
  for (const r of rows) {
    out.set(billKey(r.abl_id, r.abl_acc_year), {
      ablId: r.abl_id,
      ablAccYear: r.abl_acc_year.trim(),
      partyId: r.abl_party_id,
      billType: r.abl_bill_type,
      docRefno: r.abl_doc_refno,
      docDate: r.abl_doc_date,
      side: r.abl_dr_cr.trim() as 'DR' | 'CR',
      billAmount: new Prisma.Decimal(r.abl_bill_amount),
      pendingAmount: new Prisma.Decimal(r.abl_pending_amount),
      isDeleted: r.abl_is_deleted,
      isActive: r.abl_is_active,
      companyId: r.abl_company_id,
    });
  }
  return out;
}

export function billKey(billId: string, accYear: string): string {
  return `${billId}|${accYear.trim()}`;
}

/** The ledger's ITC vocabulary → GSTR-3B table 4's (ck_vtx_itc). */
export function itcClassOf(ledgerItc: string | null | undefined): string | null {
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
