/**
 * The vocabularies this module writes. Each one is constrained in the database
 * too; these exist so a bad value is a 400 naming the field rather than a 500
 * naming a constraint (§5.1 rule 8).
 */

/** ck_op_source. Only these three — there is no fourth (DECISION 7). */
export enum OpeningSource {
  /** Written by carry-forward. The only source a regenerate may overwrite. */
  CARRY_FORWARD = 'CARRY_FORWARD',
  /** Typed or corrected by a human. Spared by a regenerate unless told otherwise. */
  MANUAL = 'MANUAL',
  /** Loaded when the company was first put on the system. Also spared. */
  MIGRATION = 'MIGRATION',
}

/**
 * ck_op_dr_cr — ONE character, on acc_opening_balance.
 *
 * Do not unify this with BillDrCr in a DTO (§2.7, §6). They are different
 * columns on different tables and both are already constrained.
 */
export enum OpeningDrCr {
  DEBIT = 'D',
  CREDIT = 'C',
}

/** ck_abl_dr_cr — TWO characters, on acc_bill_balance. See the note above. */
export enum BillDrCr {
  DEBIT = 'DR',
  CREDIT = 'CR',
}

/**
 * acc_group_master.acc_group_nature. Only the two balance-sheet natures may
 * carry an opening: an opening on an income ledger is a category error, not a
 * zero (§5.1 rule 1). Income and Expenses net off into the P&L result instead
 * (§5.2 step 3).
 */
export const BALANCE_SHEET_NATURES = ['Assets', 'Liabilities'] as const;
export const PROFIT_AND_LOSS_NATURES = ['Income', 'Expenses'] as const;

/**
 * The two posting roles this module resolves through accounts.acc_ledger_map,
 * exactly as the sale bill resolves ROUND_OFF. Never by ledger NAME (§12).
 * Seeded by migration 20260915090000.
 */
export enum OpeningLedgerRole {
  /** The plug. Where an unbalanced opening set's difference is offered (§7.1). */
  OPENING_DIFFERENCE = 'OPENING_DIFFERENCE',
  /** Where the previous year's P&L result lands on carry-forward (DECISION 2). */
  RETAINED_EARNINGS = 'RETAINED_EARNINGS',
}

/** avh_voucher_status. Only POSTED builds a closing balance (§5.2 step 1). */
export const POSTED_VOUCHER_STATUS = 'POSTED';

/** What this module writes into abl_src_module / abl_src_doc_type (§5.3). */
export const OPENING_SRC_MODULE = 'ACCOUNTS';
export const OPENING_SRC_DOC_TYPE = 'OPENING_BALANCE';

/** ck_abl_bill_type — the only bill type this module writes. */
export const OPENING_BILL_TYPE = 'OPENING';

/** ck_fy_status, as constrained by migration 20260915090000. */
export enum FiscalYearStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  LOCKED = 'LOCKED',
}

/** ck_op_stale_reason (migration 20260915090000). */
export enum OpeningStaleReason {
  VOUCHER_POSTED = 'VOUCHER_POSTED',
  VOUCHER_CANCELLED = 'VOUCHER_CANCELLED',
  SOURCE_OPENING_EDITED = 'SOURCE_OPENING_EDITED',
  YEAR_REOPENED = 'YEAR_REOPENED',
  MANUAL = 'MANUAL',
}
