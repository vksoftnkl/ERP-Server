import { PdcStatus } from '../../receipt/types/receipt-enum';

/**
 * Every vocabulary this module speaks that the receipt module does not
 * already own.
 *
 * The shared ones — `PdcStatus`, `PdcPostingMode`, `DrCr`, `BillType`,
 * `BillAdjType`, `BillSettlementMode`, `VoucherStatus` — are IMPORTED from
 * `../receipt/types/receipt-enum` and never restated. A vocabulary written
 * twice is a vocabulary that drifts, and these two modules write to the same
 * five tables.
 */

// ─── The transitions ─────────────────────────────────────────────────────────

/**
 * Which statuses each endpoint may act on. The service refuses by NAME (§6.3)
 * — "221870 is DEPOSITED — bounce or clear it" — rather than letting a CHECK
 * answer with a 23514 that names nothing.
 *
 * Read them together and the whole lifecycle is here:
 *
 *   HELD      → deposit → DEPOSITED → clear  → CLEARED
 *                                   → bounce → BOUNCED → re-present → DEPOSITED
 *                                                      → replace    → REPLACED
 *   HELD      → return                       → RETURNED | CANCELLED
 *   HELD      → replace                      → REPLACED
 */
export const DEPOSITABLE_STATUSES: readonly PdcStatus[] = [PdcStatus.HELD];
export const CLEARABLE_STATUSES: readonly PdcStatus[] = [PdcStatus.DEPOSITED];
export const BOUNCEABLE_STATUSES: readonly PdcStatus[] = [PdcStatus.DEPOSITED];
export const REPRESENTABLE_STATUSES: readonly PdcStatus[] = [PdcStatus.BOUNCED];
export const REPLACEABLE_STATUSES: readonly PdcStatus[] = [PdcStatus.BOUNCED, PdcStatus.HELD];
export const RETURNABLE_STATUSES: readonly PdcStatus[] = [PdcStatus.HELD];

/**
 * What `POST /cheques/return` may set the row to. Two words for two different
 * events, and the register keeps them apart:
 *
 *   RETURNED  — the paper went back to the party. They have it.
 *   CANCELLED — it is void. Nobody has it, and `ux_apd_instrument` excludes
 *               CANCELLED, so the same cheque number may be keyed again.
 */
export const RETURN_ACTIONS: readonly PdcStatus[] = [PdcStatus.RETURNED, PdcStatus.CANCELLED];

// ─── The due bucket (§10 — computed, never stored) ───────────────────────────

/**
 * What the grid's `due_bucket` column and `/cheques/get` both answer.
 *
 * A function of CURRENT_DATE, which is exactly why it has no column: a stored
 * copy is wrong every morning until something rewrites it, and nothing would.
 * The grid computes it in SQL and this computes it in TypeScript — the same
 * four boundaries, stated twice because the two readers cannot share code.
 */
export enum ChequeDueBucket {
  /** Post-dated: the day on the cheque has not arrived. */
  FUTURE = 'FUTURE',
  DUE_TODAY = 'DUE_TODAY',
  /** Mature, not yet banked. */
  OVERDUE = 'OVERDUE',
  /**
   * Older than three months — the statutory validity of a cheque in India.
   * The bank will refuse it; the party has to re-issue.
   */
  STALE = 'STALE',
}

/** Three months, in the only unit `daysBetween` speaks. */
export const STALE_AFTER_DAYS = 92;

// ─── The roles this module resolves ──────────────────────────────────────────

/**
 * `accounts.acc_ledger_role.alr_role`, through `acc_ledger_map` — never by
 * name (§10 "no ledger-name lookups").
 *
 * Only two, and BOTH are optional: a bounce with no charges on either side
 * resolves neither and posts neither. That is why they are not resolved up
 * front — an unmapped `BOUNCE_CHARGES_RECOVERED` must not stop an operator
 * recording a bounce they are not charging for.
 *
 * Cheques In Hand is deliberately NOT here. It is not a role: it comes from
 * the cheque's OWN tender row (§5), because a cheque taken last year under a
 * different tender configuration still sits in the ledger it was posted to.
 */
export enum ChequeLedgerRole {
  /** Migration 20260916120000 — what the PARTY is charged for bouncing. Income. */
  BOUNCE_CHARGES_RECOVERED = 'BOUNCE_CHARGES_RECOVERED',
  /** Pre-existing — the bank's return fee, charged to US. An expense. */
  BANK_CHARGES = 'BANK_CHARGES',
}

// ─── Document identity ───────────────────────────────────────────────────────

/**
 * `acc_voucher_types.vchr_type_code`, and NEVER an id (§6 of the receipt
 * README, rule 6). `vchr_type_id` is a serial: ChqClr landed on 13 here and
 * will be something else on the live box.
 */
export const CLEARING_VOUCHER_TYPE_CODE = 'ChqClr';
export const BOUNCE_VOUCHER_TYPE_CODE = 'ChqBnc';
/** The re-issue and the return reversal are RECEIPTS — see cheque-reissue.service. */
export const RECEIPT_VOUCHER_TYPE_CODE = 'Rct';

/**
 * `avh_src_module` / `avh_src_doc_type` / `avh_src_doc_id` on the CLEARING
 * voucher, and on nothing else.
 *
 * `ux_avh_src` is UNIQUE over (company, module, doc type, doc id, year) for
 * every live non-cancelled row, which makes filing the cheque's own id there
 * an idempotency key: a second clearing of the same cheque cannot be written,
 * and the service turns the 23505 into "already cleared on <date>" (§4.3).
 *
 * The bounce voucher files NOTHING there on purpose — a cheque may bounce,
 * be re-presented and bounce again, and each bounce is a real separate event.
 * Its link back is `avh_against_voucher_id`.
 */
export const CHEQUE_SRC_MODULE = 'ACCOUNTS';
export const CHEQUE_SRC_DOC_TYPE = 'PDC';

/** `abl_src_doc_type` of the JOURNAL bill a party bounce charge raises. */
export const BOUNCE_CHARGE_SRC_DOC_TYPE = 'CHEQUE_BOUNCE_CHARGE';

/** `ppo_code` of the deposit slip, seeded by 20260916120000 §6. */
export const DEPOSIT_SLIP_PRINT_PURPOSE_CODE = 'CHEQUE_DEPOSIT_SLIP';

// ─── Settings (§2.2) ─────────────────────────────────────────────────────────

export enum ChequeSettingKey {
  BOUNCE_CHARGE_TO_PARTY = 'accounts.bounce_charge_to_party',
  BOUNCE_REASONS = 'accounts.bounce_reasons',
}

/**
 * The seeded fallback for `accounts.bounce_reasons`.
 *
 * A PRE-FILL and not a whitelist: the service accepts any non-blank reason,
 * because a bank returns cheques for reasons no list anticipates and a bounce
 * that cannot be recorded is worse than one recorded with an unfamiliar
 * reason.
 */
export const DEFAULT_BOUNCE_REASONS: readonly string[] = [
  'Funds insufficient',
  'Payment stopped by drawer',
  'Signature differs',
  'Account closed',
  'Post-dated presented early',
  'Stale',
  'Other',
];

/** `apd_bounce_reason` is VarChar(150); `apd_cancel_reason` is VarChar(250). */
export const BOUNCE_REASON_MAX_LENGTH = 150;
export const CANCEL_REASON_MAX_LENGTH = 250;
