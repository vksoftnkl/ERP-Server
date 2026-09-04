import type {
  ModuleApiErrorDetail,
  ModuleApiErrorResponse,
  ModuleApiSuccessResponse,
} from 'src/common/types/module-api.types';

export type TransactionErrorDetail = ModuleApiErrorDetail;
export type TransactionErrorResponse = ModuleApiErrorResponse<TransactionErrorDetail>;
export type TransactionSuccessResponse<
  T,
  TMeta = Record<string, unknown>,
  TStyles = unknown,
> = ModuleApiSuccessResponse<T, TMeta, TStyles>;

/**
 * The `abl_bill_type` values a party's credit may currently be offered from.
 *
 * OPENING and JOURNAL credits are deliberately absent: `ck_abj_against` only
 * lets ADVANCE_ADJUST / NOTE_ADJUST / TRANSFER name an opposite bill, and which
 * of those an opening credit should post as is an accounting decision, not one
 * to guess here. Adding one is this enum plus its {@link CREDIT_ADJUSTMENT_ROUTING}
 * entry — the SQL builds its IN list from the enum.
 */
export enum AdjustableCreditBillType {
  ADVANCE = 'ADVANCE',
  SALES_RETURN = 'SALES_RETURN',
}

/** `acc_bill_adjustment.abj_adj_type` — the settlement event (`ck_abj_adj_type`). */
export enum BillAdjType {
  /** An advance already held, being applied to the bill. */
  ADVANCE_ADJUST = 'ADVANCE_ADJUST',
  /** A credit / debit note set off against the bill. */
  NOTE_ADJUST = 'NOTE_ADJUST',
}

/** `acc_bill_adjustment.abj_settlement_mode` — how the money moved (`ck_abj_settlement_mode`). */
export enum BillSettlementMode {
  ADVANCE = 'ADVANCE',
  CREDIT_NOTE = 'CREDIT_NOTE',
}

/**
 * `abl_dr_cr` — which side of the party's account the open amount sits on.
 *
 * CR = payable = the company owes the party (a customer advance, a sales
 * return). DR = receivable = the party owes the company (a supplier advance
 * already paid out, a purchase return). `ADVANCE` is bidirectional in this
 * schema, so the side is a filter in its own right and not derivable from
 * `abl_bill_type`: without it a party who is both customer and supplier would
 * offer their own supplier advances as settlement for a sales invoice.
 */
export enum AdjustableCreditSide {
  CR = 'CR',
  DR = 'DR',
}

/** What the read defaults to when `type` is omitted — the credit side, which is what the adjustment panel asks for. */
export const DEFAULT_ADJUSTABLE_CREDIT_SIDE = AdjustableCreditSide.CR;

/** `abl_status`, the generated column. CLOSED never reaches the client — a bill with nothing left is not offered. */
export enum AdjustableCreditStatus {
  OPEN = 'OPEN',
  PARTIAL = 'PARTIAL',
}

/**
 * How a credit of each kind settles. This is why `billType` comes back on every
 * row rather than being dropped after the filter: the type decides the
 * adjustment posted against `abl_id`, which is what lets ONE tender row hold a
 * mixed set of credits instead of needing a separate row per kind.
 *
 * Resolved server-side so the routing has one definition. A client that
 * re-derives it from `billType` will drift from `ck_abj_adj_type` the first time
 * a third credit type is admitted above.
 */
export const CREDIT_ADJUSTMENT_ROUTING: Readonly<
  Record<AdjustableCreditBillType, { adjType: BillAdjType; settlementMode: BillSettlementMode }>
> = {
  [AdjustableCreditBillType.ADVANCE]: {
    adjType: BillAdjType.ADVANCE_ADJUST,
    settlementMode: BillSettlementMode.ADVANCE,
  },
  [AdjustableCreditBillType.SALES_RETURN]: {
    adjType: BillAdjType.NOTE_ADJUST,
    settlementMode: BillSettlementMode.CREDIT_NOTE,
  },
};

/**
 * One credit the party holds and has not spent: an advance taken against a sale
 * order, or a sales return not yet set off. Everything the adjustment panel
 * needs to show the line and to post the settlement it produces.
 *
 * Money is exact to two decimals — the SQL leaves `numeric(18,2)` as text and it
 * is converted once here, so no float touches the value. Dates are `YYYY-MM-DD`
 * (see PgService's DATE_AS_TEXT), never a UTC-shifted midnight.
 */
export interface AdjustableCredit {
  /**
   * `abl_id` — the key the adjustment posts against (`abj_bill_id`).
   *
   * NOT a key on its own: `acc_bill_balance` is partitioned by `abl_acc_year`
   * and its primary key is the pair. Post `billAccYear` alongside it as
   * `abj_bill_acc_year` or the reference does not resolve.
   */
  billId: string;
  /**
   * `abl_acc_year` — the FY the credit ORIGINATED in, and the second half of the
   * bill's key. A bill is never carried forward, so a March advance really does
   * adjust into an April invoice; show the year or the operator cannot tell two
   * same-numbered documents apart.
   */
  billAccYear: string;
  /** Decides how this row settles — see {@link CREDIT_ADJUSTMENT_ROUTING}. */
  billType: AdjustableCreditBillType;
  /**
   * `abl_dr_cr` — the side this row sits on, echoing the requested `type`. Sent
   * back because `billType` alone no longer says what the row is: an `ADVANCE`
   * on CR is the customer's money held, the same `ADVANCE` on DR is money the
   * company paid a supplier.
   */
  drCr: AdjustableCreditSide;
  /** `abl_doc_refno` — "SO-2201" / "SR-4412". */
  docRefno: string;
  docDate: string;
  /** Face value. Tooltip only: the panel adjusts against `pendingAmount`, which is what is LEFT. */
  billAmount: number;
  /** GENERATED: bill − alloc − disc − writeoff. The ceiling for this row's adjustment. */
  pendingAmount: number;
  status: AdjustableCreditStatus;

  /**
   * Which document the credit came from. `srcDocId` is the sale order (or sales
   * return) id, and it is what the bill screen matches on to pre-fill the panel
   * when an order is imported: adjusted = pending for every credit whose
   * `srcDocId` is the imported order.
   */
  srcModule: string | null;
  srcDocType: string | null;
  srcDocId: string | null;
  srcAccYear: string | null;

  narration: string | null;

  /** `abj_adj_type` to post for this row. Derived from `billType`. */
  adjType: BillAdjType;
  /** `abj_settlement_mode` to post for this row. Derived from `billType`. */
  settlementMode: BillSettlementMode;
}
