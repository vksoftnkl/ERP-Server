import type { SupplyNature } from '../../../accountsModule/ledgerRole/ledger-map.helper';

/**
 * One line of a voucher.
 *
 * **Amounts are ALWAYS POSITIVE and `drCr` carries the side** (flow §5.3).
 * A negative amount would fail `ck_av_amount`, and more importantly it would
 * let one leg mean two things depending on who read it.
 *
 * A leg names EITHER a role — resolved through `acc_ledger_map` /
 * `tax_rate_ledger` — OR an explicit ledger, which is what the party and
 * tender legs use because their ledger is a fact of the document rather than a
 * configuration.
 */
export interface SalesLeg {
  /** `acc_ledger_role.alr_role`, e.g. 'SALES' or 'OUTPUT_CGST'. */
  role?: string | null;
  /** An explicit ledger. Mutually exclusive with `role`. */
  ledgerId?: string | null;
  drCr: 'DR' | 'CR';
  /** Positive. `drCr` is the sign. */
  amount: number;
  /** The rate this line was taxed under — picks a per-rate ledger override. */
  taxId?: string | null;
  supplyNature?: SupplyNature | null;
  remarks?: string | null;
  /** Bill-wise: which document row this leg settles. */
  docId?: string | null;
  docAccYear?: string | null;
  docRefno?: string | null;
  /** Where an unresolved role should report itself, e.g. `items.3.sbiTaxId`. */
  field?: string;
  /** Written to `av_role`, so a report can find "every sales leg" later. */
  roleTag?: string | null;
}

/** The voucher header this leg set belongs to. */
export interface SalesVoucherHeader {
  companyId: string;
  branchId: string;
  tenantId?: string | null;
  accYear: string;
  voucherTypeId: number;
  voucherDate: string;
  srcModule: 'SALES';
  /** `ux_avh_src` makes (company, module, doc_type, doc_id, year) unique. */
  srcDocType: string;
  srcDocId: string;
  docRefno?: string | null;
  docDate?: string | null;
  usrRefno?: string | null;
  /** `avh_doc_amount` — the document's face value, not the leg total. */
  docAmount: number;
  roundOff?: number;
  partyId: string;
  userId: string;
  sessionId?: string | null;
  deviceType?: string | null;
  deviceId?: string | null;
  remarks?: string | null;
  /** POS → the device's own series; WHOLESALE → `seq_device_code 'MAIN'`. */
  deviceCode?: string | null;
  createdBy?: string;
  /**
   * A number the DOCUMENT already holds (`sb_bill_refno`, drawn from the same
   * voucher type at `/create`). When set, the voucher takes it instead of
   * drawing a second one — a bill and its voucher must print the same number.
   */
  presetRefno?: string | null;
  presetNo?: bigint | null;
}

/** What a document hands `SalesPostingService`. */
export interface SalesLegSource {
  header: SalesVoucherHeader;
  legs: SalesLeg[];
}

export interface SalesPostingResult {
  voucherId: string;
  voucherNo: string | null;
  voucherRefno: string | null;
  voucherSlno: bigint;
  /** The numeric counter behind `voucherRefno` — `gdr_voucher_no` wants it. */
  voucherLastNo: bigint;
  postedOn: Date;
  totalDebit: number;
  totalCredit: number;
  legCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════
//  The three leg sources of §3.2, as the shapes their builders consume
// ═══════════════════════════════════════════════════════════════════════════

/** One GST rate's worth of output tax on a document. */
export interface TaxBucket {
  taxId: string | null;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  acess: number;
}

/** A `txn_charge_detail` row, as the leg builder reads it. */
export interface ChargeLegInput {
  ledgerId: string | null;
  /** Signed: a negative charge posts on the other side. */
  amount: number;
  separatelyPosted: boolean;
  taxId?: string | null;
  cgst?: number;
  sgst?: number;
  igst?: number;
  cess?: number;
  name?: string | null;
}

/** An `acc_tender_detail` row, as the leg builder reads it. */
export interface TenderLegInput {
  tenderTypeId: number;
  tenderLedgerId: string | null;
  amount: number;
  /** Type 10. Posts DR LOYALTY_REDEMPTION, and the master's ledger is IGNORED. */
  isLoyalty: boolean;
  /** Types 9 and 8: no leg at all — the party stays debited. */
  isCredit: boolean;
  name?: string | null;
}

/** Everything the bill's leg list is built from (flow §5.3). */
export interface BillLegInput {
  partyLedgerId: string;
  supplyNature: SupplyNature;
  /** Net of line-level discounts, which fold into Sales — Tally's default. */
  salesAmount: number;
  taxes: TaxBucket[];
  charges: ChargeLegInput[];
  /** `sb_cash_disc` — bill-level, after tax. */
  cashDiscount: number;
  /** Only posted separately when `sales.post_scheme_disc_separately`. */
  schemeDiscount: number;
  roundOff: number;
  tcsAmount: number;
  advanceAdjusted: number;
  tenders: TenderLegInput[];
  /** DR COGS / CR INVENTORY, from `StockPostingService.post()`. */
  cogsAmount: number;
}

/** A sale return is the bill's mirror, and its sales leg is its own role. */
export interface ReturnLegInput extends Omit<BillLegInput, 'tcsAmount' | 'advanceAdjusted'> {
  tcsAmount?: number;
  advanceAdjusted?: number;
}
