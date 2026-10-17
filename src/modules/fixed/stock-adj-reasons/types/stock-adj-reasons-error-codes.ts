/**
 * Notes 119 / 127 §5 — every Stock Adjustment Reasons refusal carries one of
 * these in `errors[].code`; the client words its box by the code alone. (The
 * stock adjustment voucher's own STOCK_ADJ_* codes live with that module.) A
 * code keeps its meaning forever: a new refusal gets a new member.
 */
export enum StockAdjReasonsErrorCode {
  /** No stock adjustment reason has the sarId asked for (404). */
  NOT_FOUND = 'STOCK_ADJ_REASONS_NOT_FOUND',
}
