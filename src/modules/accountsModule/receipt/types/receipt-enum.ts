/**
 * Every vocabulary this module speaks, in one file.
 *
 * All of these are VARCHAR + CHECK in the database, not PG enums — the app
 * layer owns the value sets, the same way `acc_tender_detail` does. Each enum
 * below names the constraint it mirrors, so a value added here without the
 * matching migration fails loudly at the constraint rather than quietly at a
 * comparison.
 */

// ─── accounts.acc_voucher_header ─────────────────────────────────────────────

/**
 * ck_avh_status admits four values; this module uses three.
 *
 * DRAFT -> POSTED -> CANCELLED. There is no approval step: /post runs from a
 * DRAFT, and APPROVED is left for whatever document eventually wants it.
 */
export enum VoucherStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  POSTED = 'POSTED',
  CANCELLED = 'CANCELLED',
}

/** ck_avh_device_type. */
export enum VoucherDeviceType {
  PC = 'PC',
  WEB = 'WEB',
  MOBILE = 'MOBILE',
  POS = 'POS',
  DESKTOP = 'DESKTOP',
}

/** Every value ck_avh_status admits, for reading the column back as an enum. */
export const VOUCHER_STATUSES: readonly VoucherStatus[] = Object.values(VoucherStatus);

// ─── accounts.acc_vouchers ───────────────────────────────────────────────────

/** ck_av_dr_cr / ck_abj_dr_cr / ck_abl_dr_cr / ck_td_dr_cr — TWO characters. */
export enum DrCr {
  DR = 'DR',
  CR = 'CR',
}

// ─── accounts.acc_bill_balance ───────────────────────────────────────────────

/** ck_abl_bill_type. */
export enum BillType {
  SALES = 'SALES',
  PURCHASE = 'PURCHASE',
  SALES_RETURN = 'SALES_RETURN',
  PURCHASE_RETURN = 'PURCHASE_RETURN',
  OPENING = 'OPENING',
  ADVANCE = 'ADVANCE',
  INTEREST = 'INTEREST',
  JOURNAL = 'JOURNAL',
}

/** `abl_status`, the GENERATED column. Never written. */
export enum BillStatus {
  OPEN = 'OPEN',
  PARTIAL = 'PARTIAL',
  CLOSED = 'CLOSED',
}

/**
 * The bill types a party's OPEN RECEIVABLES are drawn from — the left-hand
 * list on the receipt screen.
 *
 * JOURNAL is admitted here and is not admitted by
 * `TransactionService.getPartyAdjustableCredits`, because the two ask
 * different questions: a journal DEBIT is a plain receivable that money may be
 * received against, while a journal CREDIT is a balance whose settlement route
 * is an accounting decision nobody has taken. INTEREST likewise: an interest
 * bill raised on an overdue invoice is collected exactly like the invoice.
 */
export const RECEIVABLE_BILL_TYPES: readonly BillType[] = [
  BillType.SALES,
  BillType.OPENING,
  BillType.INTEREST,
  BillType.JOURNAL,
  BillType.PURCHASE_RETURN,
];

/**
 * The bill types a party's HELD CREDITS are drawn from — the right-hand list.
 *
 * All four credit types, and OPENING is the one that matters most: a go-live
 * loads every balance a party already held as an OPENING row, so a list
 * without it leaves the credit panel empty at EVERY new client, not just the
 * ones with an unusual ledger. The same is true of a JOURNAL credit passed by
 * a journal voucher.
 *
 * The routing question this list used to defer — `ck_abj_against` lets only
 * ADVANCE_ADJUST / NOTE_ADJUST / TRANSFER name an opposite bill, and which of
 * those an OPENING credit posts as — is settled in `creditRouting`: money the
 * company holds and has not earned is an advance whatever raised it, so
 * OPENING and JOURNAL post as ADVANCE_ADJUST / ADVANCE, exactly as ADVANCE
 * does. The constraint is satisfied because the credit bill IS the opposite
 * bill, so no migration is involved.
 *
 * This list is no longer identical to `AdjustableCreditBillType` in the
 * transaction module, which still offers the original two: the receipt screen
 * spends a credit, while the sale bill's panel adjusts one against an invoice
 * being raised, and widening that is a separate decision taken there.
 */
export const CREDIT_BILL_TYPES: readonly BillType[] = [
  BillType.ADVANCE,
  BillType.SALES_RETURN,
  BillType.OPENING,
  BillType.JOURNAL,
];

// ─── accounts.acc_bill_adjustment ────────────────────────────────────────────

/** ck_abj_adj_type. Unchanged by this module: TDS and a claim are ALLOCATION. */
export enum BillAdjType {
  ALLOCATION = 'ALLOCATION',
  ADVANCE_ADJUST = 'ADVANCE_ADJUST',
  NOTE_ADJUST = 'NOTE_ADJUST',
  DISCOUNT = 'DISCOUNT',
  WRITEOFF = 'WRITEOFF',
  TRANSFER = 'TRANSFER',
}

/**
 * The four adj types `fn_abl_recompute`'s successor folds into
 * `abl_alloc_amount`. DISCOUNT and WRITEOFF have columns of their own.
 */
export const ALLOCATING_ADJ_TYPES: readonly BillAdjType[] = [
  BillAdjType.ALLOCATION,
  BillAdjType.ADVANCE_ADJUST,
  BillAdjType.NOTE_ADJUST,
  BillAdjType.TRANSFER,
];

/** ck_abj_settlement_mode, as widened by migration 20260915120000. */
export enum BillSettlementMode {
  CASH = 'CASH',
  CARD = 'CARD',
  UPI = 'UPI',
  WALLET = 'WALLET',
  CHEQUE = 'CHEQUE',
  BANK = 'BANK',
  CREDIT_NOTE = 'CREDIT_NOTE',
  ADVANCE = 'ADVANCE',
  LOYALTY = 'LOYALTY',
  VOUCHER = 'VOUCHER',
  JOURNAL = 'JOURNAL',
  DISCOUNT = 'DISCOUNT',
  WRITEOFF = 'WRITEOFF',
  MIXED = 'MIXED',
  /** Added 20260915120000 — a customer withheld tax at source. */
  TDS = 'TDS',
  /** Added 20260915120000 — a damage / shortage / rate claim allowed. */
  CLAIM = 'CLAIM',
}

// ─── accounts.acc_pdc_register ───────────────────────────────────────────────

/** ck_apd_tra_type. R = received (this module), P = paid (the payment voucher). */
export enum PdcTraType {
  RECEIVED = 'R',
  PAID = 'P',
}

/** ck_apd_instrument. */
export enum PdcInstrumentType {
  CHEQUE = 'CHEQUE',
  DD = 'DD',
  PAY_ORDER = 'PAY_ORDER',
  ECS = 'ECS',
  NACH = 'NACH',
  UPI_MANDATE = 'UPI_MANDATE',
}

/** ck_apd_status. */
export enum PdcStatus {
  HELD = 'HELD',
  DEPOSITED = 'DEPOSITED',
  CLEARED = 'CLEARED',
  BOUNCED = 'BOUNCED',
  RETURNED = 'RETURNED',
  CANCELLED = 'CANCELLED',
  REPLACED = 'REPLACED',
}

/**
 * The statuses a receipt may still be cancelled from. Once an instrument has
 * left the drawer for the bank, cancelling the receipt behind it would leave
 * the bank holding paper this system says never existed (§4.8).
 */
export const CANCELLABLE_PDC_STATUSES: readonly PdcStatus[] = [PdcStatus.HELD];

/** ck_apd_posting_mode. */
export enum PdcPostingMode {
  ON_RECEIPT = 'ON_RECEIPT',
  ON_CLEARING = 'ON_CLEARING',
}

// ─── accounts.acc_tender_types ───────────────────────────────────────────────

/**
 * `ttm_type_id` of the seeded tender types. Only CHEQUE is named in code — it
 * is the one type whose handling genuinely differs (a register row, possibly a
 * voucher of its own). Everything else is driven by the master's own flags, so
 * a shop that adds a twelfth tender type needs no change here.
 */
export const CHEQUE_TENDER_TYPE_ID = 5;

// ─── The posting roles this module resolves ──────────────────────────────────

/**
 * `accounts.acc_ledger_role.alr_role` — resolved through `acc_ledger_map` by
 * ledger-map.helper, never by name (§12).
 */
export enum ReceiptLedgerRole {
  /** §2.7 — tax a customer withheld. An ASSET; the mirror of TDS_PAYABLE. */
  TDS_RECEIVABLE = 'TDS_RECEIVABLE',
  /** §2.7 — the acquirer's MDR on a card / UPI collection. */
  BANK_CHARGES = 'BANK_CHARGES',
  /** §2.7 — what the customer was charged for paying by card. */
  SURCHARGE_RECOVERED = 'SURCHARGE_RECOVERED',
  /** §2.7 — a damage / shortage claim settled at receipt time. */
  CLAIMS_ALLOWED = 'CLAIMS_ALLOWED',
  /** §2.7 — interest on an overdue bill, collected with the receipt. */
  INTEREST_INCOME = 'INTEREST_INCOME',
  /** Pre-existing — where a discount allowed is expensed. */
  DISCOUNT_ALLOWED = 'DISCOUNT_ALLOWED',
  /** Pre-existing — where a written-off balance is expensed. */
  WRITE_OFF = 'WRITE_OFF',
  /** Pre-existing — TCS collected under 206C(1H) when tcs_basis is RECEIPT. */
  TCS_PAYABLE = 'TCS_PAYABLE',
}

/**
 * Which side each role posts on, so the server can refuse a line that claims
 * the wrong one rather than silently unbalancing the voucher.
 *
 * An expense or an asset is a DEBIT; income and a tax payable are a CREDIT.
 */
export const ROLE_SIDE: Readonly<Record<ReceiptLedgerRole, DrCr>> = {
  [ReceiptLedgerRole.TDS_RECEIVABLE]: DrCr.DR,
  [ReceiptLedgerRole.BANK_CHARGES]: DrCr.DR,
  [ReceiptLedgerRole.SURCHARGE_RECOVERED]: DrCr.CR,
  [ReceiptLedgerRole.CLAIMS_ALLOWED]: DrCr.DR,
  [ReceiptLedgerRole.INTEREST_INCOME]: DrCr.CR,
  [ReceiptLedgerRole.DISCOUNT_ALLOWED]: DrCr.DR,
  [ReceiptLedgerRole.WRITE_OFF]: DrCr.DR,
  [ReceiptLedgerRole.TCS_PAYABLE]: DrCr.CR,
};

/**
 * The settlement mode a role's line posts under when it settles a bill.
 *
 * This is why `av_role` and `abj_settlement_mode` are both worth carrying: the
 * leg says which ledger and why, the adjustment row says how the bill was
 * settled, and a TDS report can start from either end.
 *
 * A role not listed here cannot settle a bill (BANK_CHARGES is the MDR half of
 * an instrument split, SURCHARGE_RECOVERED and INTEREST_INCOME are income the
 * customer paid ON TOP, not a reduction of what they owe).
 */
export const ROLE_SETTLEMENT_MODE: Readonly<Partial<Record<string, BillSettlementMode>>> = {
  [ReceiptLedgerRole.TDS_RECEIVABLE]: BillSettlementMode.TDS,
  [ReceiptLedgerRole.CLAIMS_ALLOWED]: BillSettlementMode.CLAIM,
};

/**
 * What a free-ledger line — one naming `ledgerId` with no role at all — settles
 * as. JOURNAL is the honest answer: the operator has pointed at a ledger of
 * their own choosing and the system has no name for what it means.
 */
export const FREE_LEDGER_SETTLEMENT_MODE = BillSettlementMode.JOURNAL;

// ─── Settings (§2.8) ─────────────────────────────────────────────────────────

export enum ReceiptSettingKey {
  PDC_POSTING_MODE = 'accounts.pdc_posting_mode',
  BILL_SORT = 'accounts.receipt_bill_sort',
  SALESMAN_MANDATORY = 'accounts.receipt_salesman_mandatory',
  WRITEOFF_APPROVAL_ABOVE = 'accounts.writeoff_approval_above',
  TCS_BASIS = 'accounts.tcs_basis',
  PPD_SLABS = 'accounts.ppd_slabs',
  /**
   * R20 — whether POST /receipts/amend exists for this client at all.
   *
   * COMPANY scope, not BRANCH like the six above: those are operating
   * decisions a branch may reasonably differ on, this is a decision about how
   * the business is CONTROLLED, and a BRANCH ceiling would let a branch switch
   * on for itself what head office turned off.
   */
  ALLOW_POSTED_AMEND = 'accounts.allow_posted_amend',
}

/** `accounts.receipt_bill_sort` (R12). */
export enum ReceiptBillSort {
  DUE_DATE = 'DUE_DATE',
  BILL_DATE = 'BILL_DATE',
}

/** `accounts.tcs_basis` (R15). */
export enum TcsBasis {
  /** 206C(1H) — collected when the money arrives. The receipt seeds a line. */
  RECEIPT = 'RECEIPT',
  /** Collected on the invoice. The receipt seeds nothing. */
  SALES = 'SALES',
}

// ─── Document identity ───────────────────────────────────────────────────────

/**
 * `acc_voucher_types.vchr_type_code`, and NOT an id.
 *
 * `vchr_type_id` is a serial: it is 10 on the box this was written against and
 * will be something else on the live one. A hard-coded id would post receipts
 * as whatever document type happens to hold that number there.
 */
export const RECEIPT_VOUCHER_TYPE_CODE = 'Rct';

/** `td_src_module` / `td_src_doc_type` / `tsl_src_*` for everything this module writes. */
export const RECEIPT_SRC_MODULE = 'ACCOUNTS';
export const RECEIPT_SRC_DOC_TYPE = 'RECEIPT';

/**
 * `abl_src_doc_type` of the ADVANCE bill a remainder creates. The receipt's own
 * voucher id goes in `abl_src_doc_id`, so "which receipt is this advance from"
 * is a keyed lookup and not a join on (party, date, amount).
 */
export const ADVANCE_SRC_DOC_TYPE = 'RECEIPT_ADVANCE';

/** `public.print_purpose.ppo_code` of the formal receipt (already seeded). */
export const RECEIPT_PRINT_PURPOSE_CODE = 'RECEIPT_VOUCHER';
