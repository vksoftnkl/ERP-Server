/**
 * Non-cash tender control, layers 3 and 4 (till/plan-noncash-tender-control.md
 * §5–§6, schema 49 = migration 20261008130000): a provider's statement
 * imported, matched to our tender rows, posted as one TSet per payout; the two
 * exception lists decided.
 */

/** fixed.menu_master — 20261008190000_tender_settlement. */
export const SETTLEMENT_MENU_ID = 278;
/** `<prefix>_RIGHT_<VERB>` on a rights refusal (rights.ts). */
export const SETTLEMENT_RIGHT_PREFIX = 'TSET';
export const SETTLEMENT_VOUCHER_TYPE_CODE = 'TSet';
/** §6.1: a write-off posts a TVar, as a close variance does. */
export const WRITE_OFF_VOUCHER_TYPE_CODE = 'TVar';
/** avh_src_module / avh_src_doc_type of the settlement's own vouchers (ux_avh_src). */
export const SETTLEMENT_SRC_MODULE = 'ACCOUNTS';
export const SETTLEMENT_SRC_DOC_TYPE = 'TENDER_SETTLEMENT';
export const RESOLVE_SRC_DOC_TYPE = 'SETTLEMENT_RESOLVE';
export const WRITE_OFF_SRC_DOC_TYPE = 'NONCASH_WRITE_OFF';

/**
 * The documents whose tender rows take the statement line's fee + tax into `td_mdr_amt` when a
 * TSet settles them (plan §5.5, notes 99 §2): the sales documents, which never post from that
 * column. A receipt / payment / expense / register row is left alone — there `td_mdr_amt` is the
 * document's own bank-charge split, rebuilt into its BANK_CHARGES leg on an amend, so the
 * acquirer's fee written there would be booked twice.
 */
export const MDR_FROM_STATEMENT_DOC_TYPES: readonly string[] = [
  'SALE_BILL',
  'SALE_RETURN',
  'SALES_ORDER',
];

/** The ledger roles a settlement posts to (47 / 49 seed them). */
export const SettlementRole = {
  TENDER_SUSPENSE: 'TENDER_SUSPENSE',
  BANK_CHARGES: 'BANK_CHARGES',
  GST_ON_CHARGES_PENDING: 'GST_ON_CHARGES_PENDING',
  WRITE_OFF: 'WRITE_OFF',
} as const;

/** The `tender.*` settings 49 seeded (§9). */
export enum TenderSettingKey {
  DUPLICATE_REF = 'tender.duplicate_ref',
  CLOSE_BY_TERMINAL = 'tender.close_by_terminal',
  MATCH_WINDOW_MINUTES = 'tender.match_window_minutes',
  MATCH_AMOUNT_TOLERANCE = 'tender.match_amount_tolerance',
  SETTLE_GRACE_DAYS = 'tender.settle_grace_days',
}

/** asi_source — ck_asi_source. */
export enum SettlementSource {
  CARD = 'CARD',
  UPI = 'UPI',
  WALLET = 'WALLET',
  /** UPI straight to the current account: no payout of its own, no fee (ck_asi_bank). */
  BANK = 'BANK',
}

/** asi_status — ck_asi_status. */
export enum SettlementImportStatus {
  IMPORTED = 'IMPORTED',
  /** Every customer line is matched, ignored or resolved: nothing waits on a person. */
  MATCHED = 'MATCHED',
  POSTED = 'POSTED',
  VOIDED = 'VOIDED',
}

/** asl_kind — ck_asl_kind. Amounts are positive; the kind is the direction. */
export enum SettlementLineKind {
  SALE = 'SALE',
  REFUND = 'REFUND',
  CHARGEBACK = 'CHARGEBACK',
  /** No customer behind it (terminal rent …): its fee and tax go straight to the voucher. */
  FEE = 'FEE',
  /** A provider correction with no bill: its gross waits in Tender suspense. */
  ADJUSTMENT = 'ADJUSTMENT',
}

/** asl_match_status — ck_asl_status. */
export enum SettlementMatchStatus {
  UNMATCHED = 'UNMATCHED',
  SUGGESTED = 'SUGGESTED',
  MATCHED = 'MATCHED',
  /** Not part of this payout (a summary row, a duplicate the provider printed): out of the totals. */
  IGNORED = 'IGNORED',
  RESOLVED = 'RESOLVED',
}

/** asl_match_rule — ck_asl_rule. */
export enum SettlementMatchRule {
  REF = 'REF',
  AUTH = 'AUTH',
  AMOUNT_TIME = 'AMOUNT_TIME',
  MANUAL = 'MANUAL',
}

/** asl_resolution — ck_asl_resolution (§6.2). */
export enum SettlementResolution {
  LINKED = 'LINKED',
  REFUNDED = 'REFUNDED',
  INCOME = 'INCOME',
  SUSPENSE = 'SUSPENSE',
}

/** §6.1 — where a card / UPI amount that never arrived is booked. */
export enum WriteOffTreatment {
  /** The cashier's (or someone's) recovery ledger, named on the request. */
  RECOVER = 'RECOVER',
  /** Still chasing: Tender suspense. */
  SUSPENSE = 'SUSPENSE',
  /** The WRITE_OFF role. */
  LOSS = 'LOSS',
}

/** §7's codes, plus the few the build needed. */
export enum SettlementErrorCode {
  FILE_DUPLICATE = 'SETTLEMENT_FILE_DUPLICATE',
  FORMAT_MISSING = 'SETTLEMENT_FORMAT_MISSING',
  /** The column map is not usable (a required column unnamed, an unknown date format). */
  FORMAT_INVALID = 'SETTLEMENT_FORMAT_INVALID',
  /** A row of the file could not be read (a date, an amount, net ≠ gross − fee − tax). */
  FILE_INVALID = 'SETTLEMENT_FILE_INVALID',
  OTHER_STORE = 'SETTLEMENT_OTHER_STORE',
  /** A terminal id / VPA on a line names no tender of this company. */
  TERMINAL_UNKNOWN = 'SETTLEMENT_TERMINAL_UNKNOWN',
  /** The tender has no settlement (bank) ledger: there is nowhere to post the payout. */
  BANK_MISSING = 'SETTLEMENT_BANK_MISSING',
  TD_ALREADY_MATCHED = 'SETTLEMENT_TD_ALREADY_MATCHED',
  /** The tender row cannot take this line (another tender, settled, voided, wrong side). */
  TD_NOT_CANDIDATE = 'SETTLEMENT_TD_NOT_CANDIDATE',
  NOT_BALANCED = 'SETTLEMENT_NOT_BALANCED',
  /** A suggestion waits for a person: confirm or unlink it before posting. */
  SUGGESTIONS_OPEN = 'SETTLEMENT_SUGGESTIONS_OPEN',
  /** The import or line is not in the state the action needs. */
  STATE = 'SETTLEMENT_STATE',
  /** A posted payout something has since built on (a resolution, a written-off chargeback). */
  POSTED_LOCKED = 'SETTLEMENT_POSTED_LOCKED',
  NOT_FOUND = 'SETTLEMENT_NOT_FOUND',
  /** Menu 278 OVERRIDE stands in for the NONCASH_WRITE_OFF approval until phase 3. */
  WRITE_OFF_NEEDS_APPROVAL = 'NONCASH_WRITE_OFF_NEEDS_APPROVAL',
  /** Menu 278 OVERRIDE stands in for the SETTLEMENT_RESOLVE approval until phase 3. */
  RESOLVE_NEEDS_APPROVAL = 'SETTLEMENT_RESOLVE_NEEDS_APPROVAL',
  /** A ledger named on the request is not usable (missing, another company, wrong nature). */
  LEDGER_INVALID = 'SETTLEMENT_LEDGER_INVALID',
  /** A role (TENDER_SUSPENSE, BANK_CHARGES …) has no ledger on the Ledger Map. */
  LEDGER_UNMAPPED = 'SETTLEMENT_LEDGER_UNMAPPED',
  REASON_INVALID = 'SETTLEMENT_REASON_INVALID',
}

export const SETTLEMENT_ERROR_STATUS: Readonly<Record<SettlementErrorCode, number>> = {
  [SettlementErrorCode.FILE_DUPLICATE]: 409,
  [SettlementErrorCode.FORMAT_MISSING]: 422,
  [SettlementErrorCode.FORMAT_INVALID]: 422,
  [SettlementErrorCode.FILE_INVALID]: 422,
  [SettlementErrorCode.OTHER_STORE]: 422,
  [SettlementErrorCode.TERMINAL_UNKNOWN]: 422,
  [SettlementErrorCode.BANK_MISSING]: 422,
  [SettlementErrorCode.TD_ALREADY_MATCHED]: 409,
  [SettlementErrorCode.TD_NOT_CANDIDATE]: 422,
  [SettlementErrorCode.NOT_BALANCED]: 422,
  [SettlementErrorCode.SUGGESTIONS_OPEN]: 409,
  [SettlementErrorCode.STATE]: 409,
  [SettlementErrorCode.POSTED_LOCKED]: 409,
  [SettlementErrorCode.NOT_FOUND]: 404,
  [SettlementErrorCode.WRITE_OFF_NEEDS_APPROVAL]: 403,
  [SettlementErrorCode.RESOLVE_NEEDS_APPROVAL]: 403,
  [SettlementErrorCode.LEDGER_INVALID]: 422,
  [SettlementErrorCode.LEDGER_UNMAPPED]: 422,
  [SettlementErrorCode.REASON_INVALID]: 422,
};

/** till_reason.trs_category of the reasons a write-off / resolve names (49 seeds ten). */
export const NONCASH_REASON_CATEGORY = 'NONCASH';

export const IMPORT_MAX_BYTES = 10 * 1024 * 1024;
export const IMPORT_MAX_LINES = 20_000;
