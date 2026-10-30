import type { SupplyNature } from '../../../accountsModule/ledgerRole/ledger-map.helper';
import type {
  VoucherHeaderInput,
  VoucherLeg,
  VoucherLegSource,
  VoucherPostingResult,
} from '../../../../common/posting/voucher-leg.types';

// The leg, header, source and result shapes were lifted to
// src/common/posting/voucher-leg.types.ts (the Voucher Register's routine is
// the same routine). The sales names stay as aliases so no document changes.
export type SalesLeg = VoucherLeg;
export type SalesVoucherHeader = VoucherHeaderInput;
export type SalesLegSource = VoucherLegSource;
export type SalesPostingResult = VoucherPostingResult;

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
  /**
   * The bill's set-offs, one per ledger that HELD the credit being spent. A
   * credit held on the party ledger itself (credit notes, receipt advances, an
   * order with no advance ledger) moves nothing and is left out: the party was
   * credited when the credit came in, and the bill debits it now.
   */
  setOffs: SetOffLegInput[];
  tenders: TenderLegInput[];
  /** DR COGS / CR INVENTORY, from `StockPostingService.post()`. */
  cogsAmount: number;
}

/** A sale return is the bill's mirror, and its sales leg is its own role. */
export interface ReturnLegInput extends Omit<BillLegInput, 'tcsAmount' | 'setOffs'> {
  tcsAmount?: number;
}

/** One ledger's worth of set-off: DR it, CR the party. */
export interface SetOffLegInput {
  ledgerId: string;
  amount: number;
  remarks?: string | null;
}
