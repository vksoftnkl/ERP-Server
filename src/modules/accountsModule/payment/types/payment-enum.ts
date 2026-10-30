import {
  BillAdjType,
  BillSettlementMode,
  BillType,
  DrCr,
  ReceiptBillSort,
} from '../../receipt/types/receipt-enum';

/**
 * The payment's vocabulary — the receipt's, mirrored (plan-backend-payment rev 2 §3).
 *
 * Everything that is the SAME vocabulary is re-exported from the receipt's
 * enum file rather than copied: `ck_avh_status`, `ck_abj_adj_type`,
 * `ck_apd_status` and the rest are one CHECK constraint each, and a second
 * copy of a value set drifts the day one of them is widened.
 */
export {
  BillAdjType,
  BillSettlementMode,
  BillStatus,
  BillType,
  CANCELLABLE_PDC_STATUSES,
  CHEQUE_TENDER_TYPE_ID,
  DrCr,
  FREE_LEDGER_SETTLEMENT_MODE,
  PdcInstrumentType,
  PdcPostingMode,
  PdcStatus,
  PdcTraType,
  ReceiptBillSort as PaymentBillSort,
  VOUCHER_STATUSES,
  VoucherDeviceType,
  VoucherStatus,
} from '../../receipt/types/receipt-enum';

// ─── The two lists of the payment screen ─────────────────────────────────────

/**
 * The bill types a party's OPEN PAYABLES are drawn from — the left-hand list
 * of the payment screen. CR on the party: what we owe them.
 *
 * PURCHASE is the invoice; OPENING is a go-live balance we owed; JOURNAL is a
 * credit passed by a journal voucher (the accountant's "we owe them this").
 * INTEREST is left out: an interest bill this system raises is on a
 * receivable, and interest we owe a supplier is keyed as INTEREST_PAID on the
 * payment itself.
 */
export const PAYABLE_BILL_TYPES: readonly BillType[] = [
  BillType.PURCHASE,
  BillType.OPENING,
  BillType.JOURNAL,
];

/**
 * The bill types a party's HELD DEBITS are drawn from — the right-hand list.
 * DR on the party: what they hold of ours.
 *
 * An ADVANCE we paid ahead, a PURCHASE_RETURN (their debit note), an OPENING
 * debit, a JOURNAL debit. The mirror of the receipt's `CREDIT_BILL_TYPES`.
 */
export const HELD_DEBIT_BILL_TYPES: readonly BillType[] = [
  BillType.ADVANCE,
  BillType.PURCHASE_RETURN,
  BillType.OPENING,
  BillType.JOURNAL,
];

// ─── The posting roles this module resolves ──────────────────────────────────

/**
 * `accounts.acc_ledger_role.alr_role` — resolved through `acc_ledger_map` by
 * ledger-map.helper, never by name (§12).
 */
export enum PaymentLedgerRole {
  /** Tax THIS company withholds when it pays a supplier. A liability; the mirror of TDS_RECEIVABLE. */
  TDS_PAYABLE = 'TDS_PAYABLE',
  /** The bank's charge on a transfer / the acquirer's cut. Our expense, on top of the bill. */
  BANK_CHARGES = 'BANK_CHARGES',
  /** Interest we pay a supplier on an overdue bill, with the payment. */
  INTEREST_PAID = 'INTEREST_PAID',
  /** A balance we owed and will not pay — income, the mirror of a write-off. */
  BALANCES_WRITTEN_BACK = 'BALANCES_WRITTEN_BACK',
  /** A prompt-payment discount the supplier gave us — income, the mirror of DISCOUNT_ALLOWED. */
  DISCOUNT_RECEIVED = 'DISCOUNT_RECEIVED',
  /** Pre-existing — where the paise rounded off a bill land. Shared with the receipt. */
  ROUND_OFF = 'ROUND_OFF',
  /** Created by 20260928200000 for the balance sheet; nothing posts to it — see the README. */
  ADVANCE_PAID = 'ADVANCE_PAID',
}

/**
 * Which side each OTHER-LINE role posts on, so the server can refuse a line
 * that claims the wrong one rather than silently unbalancing the voucher.
 *
 * Only the four roles a payment ACCEPTS AS OTHER-LINES are here. DISCOUNT_RECEIVED,
 * WRITE_OFF and ROUND_OFF are deliberately absent: they ride on
 * `allocations[].discount / .writeoff / .roundoff`, and a line naming one of
 * them is refused — sending both is the double-count the receipt already hit
 * (`linesThatTravel()`).
 *
 * A DR is an expense on top of the bills (money out); a CR is a deduction that
 * settles a bill without leaving as money.
 */
export const PAYMENT_ROLE_SIDE: Readonly<Partial<Record<PaymentLedgerRole, DrCr>>> = {
  [PaymentLedgerRole.TDS_PAYABLE]: DrCr.CR,
  [PaymentLedgerRole.BANK_CHARGES]: DrCr.DR,
  [PaymentLedgerRole.INTEREST_PAID]: DrCr.DR,
  [PaymentLedgerRole.BALANCES_WRITTEN_BACK]: DrCr.CR,
};

/**
 * The settlement mode a role's line posts under when it settles a bill.
 * A role not listed here cannot settle (BANK_CHARGES and INTEREST_PAID are
 * money paid ON TOP, not a reduction of what we owe).
 */
export const PAYMENT_ROLE_SETTLEMENT_MODE: Readonly<Partial<Record<string, BillSettlementMode>>> = {
  [PaymentLedgerRole.TDS_PAYABLE]: BillSettlementMode.TDS,
  [PaymentLedgerRole.BALANCES_WRITTEN_BACK]: BillSettlementMode.WRITEOFF,
};

/** The role each per-bill reduction on `allocations[]` posts to. All three are CR: income. */
export const PAYMENT_REDUCTION_ROLE = {
  discount: PaymentLedgerRole.DISCOUNT_RECEIVED,
  writeoff: PaymentLedgerRole.BALANCES_WRITTEN_BACK,
  roundoff: PaymentLedgerRole.ROUND_OFF,
} as const;

/** How each kind of held debit settles — the receipt's `creditRouting`, mirrored. */
export function debitRouting(billType: BillType): {
  adjType: BillAdjType;
  settlementMode: BillSettlementMode;
} {
  return billType === BillType.PURCHASE_RETURN
    ? { adjType: BillAdjType.NOTE_ADJUST, settlementMode: BillSettlementMode.CREDIT_NOTE }
    : { adjType: BillAdjType.ADVANCE_ADJUST, settlementMode: BillSettlementMode.ADVANCE };
}

// ─── Settings ────────────────────────────────────────────────────────────────

/**
 * Reused from the receipt where the plan says so (§2.5), plus the one
 * payment-only key. `accounts.receipt_bill_sort` orders payables the same way
 * it orders receivables: one setting, one screen order.
 */
export enum PaymentSettingKey {
  PDC_POSTING_MODE = 'accounts.pdc_posting_mode',
  BILL_SORT = 'accounts.receipt_bill_sort',
  SALESMAN_MANDATORY = 'accounts.payment_salesman_mandatory',
  WRITEOFF_APPROVAL_ABOVE = 'accounts.writeoff_approval_above',
  ALLOW_POSTED_AMEND = 'accounts.allow_posted_amend',
}

export { ReceiptBillSort };

// ─── Document identity ───────────────────────────────────────────────────────

/** `acc_voucher_types.vchr_type_code`, and NOT an id — the id is a serial. */
export const PAYMENT_VOUCHER_TYPE_CODE = 'Pmt';

/** `fixed.menu_master.menu_id` of the Payment screen. */
export const PAYMENT_MENU_ID = 100;

/** `td_src_module` / `td_src_doc_type` / `tsl_src_*` for everything this module writes. */
export const PAYMENT_SRC_MODULE = 'ACCOUNTS';
export const PAYMENT_SRC_DOC_TYPE = 'PAYMENT';

/** `abl_src_doc_type` of the ADVANCE (DR) bill a remainder creates. */
export const PAYMENT_ADVANCE_SRC_DOC_TYPE = 'PAYMENT_ADVANCE';
