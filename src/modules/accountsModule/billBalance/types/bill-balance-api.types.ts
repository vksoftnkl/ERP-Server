/**
 * A party's outstanding position joined to their configured credit ceilings —
 * everything the sale bill / sales order entry screen needs to run a credit
 * check in one round-trip.
 *
 * Money is exact to two decimals: the SQL casts every monetary aggregate to
 * `numeric(18,2)` before it leaves Postgres, so these numbers carry no float
 * drift. (JSON has no way to keep a trailing `.00`, so `125000.00` serialises
 * as `125000` — the VALUE is the fixed-point one, its rendering is the
 * client's.)
 */
export interface PartyCreditSummary {
  partyId: string;
  partyName: string | null;
  /**
   * Echoed back from the request, null when the caller omitted it. It does NOT
   * scope the aggregation — see {@link BillBalanceService.getCreditSummary} for
   * why outstanding is read across every accounting year.
   */
  accYear: string | null;
  /**
   * The database server's date, `YYYY-MM-DD` — what the overdue/ageing split was
   * measured against. Not a request parameter: it is reported so the client
   * knows which "today" produced these numbers, which its own clock and timezone
   * cannot be assumed to agree with.
   */
  asOnDate: string;

  /**
   * Net outstanding: receivables (DR) less anything held on the party's behalf
   * (CR — advances, credit notes). Can be negative when the party is in credit.
   */
  pendingAmount: number;
  /** Open receivables only. Advances and credit notes are not bills owed. */
  pendingBillCount: number;

  overdueAmount: number;
  overdueBillCount: number;
  /** `YYYY-MM-DD`, or null when nothing is overdue. */
  oldestOverdueDueDate: string | null;
  /** `asOnDate - oldestOverdueDueDate`, 0 when nothing is overdue. */
  maxOverdueDays: number;

  creditAmtLimit: number;
  creditBillLimit: number;

  /** Null when credit checking is off for this party — there is no ceiling to be under. */
  availableCreditAmount: number | null;
  /** Null when credit checking is off for this party. */
  availableBillCount: number | null;

  isAmtLimitExceeded: boolean;
  isBillLimitExceeded: boolean;
  /** `customers.cus_credit_allowed`. False → the two `available*` fields are null and neither flag can trip. */
  isCreditCheckEnabled: boolean;
}
