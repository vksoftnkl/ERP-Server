/** `ck_cd_carry_basis` — how much of an order charge a bill takes. */
export type ChargeCarryBasis = 'PRORATA' | 'FULL' | 'MANUAL' | 'NONE';

/** One order charge, as offered to a bill. Nothing here is written. */
export interface ChargeCarryProposal {
  srcChargeId: string;
  srcAccYear: string;
  chargeId: string | null;
  chargeName: string | null;
  /** The order charge in full. */
  amount: number;
  /** What earlier bills have already taken. */
  alreadyCarried: number;
  remaining: number;
  basis: ChargeCarryBasis;
  proposed: number;
  /**
   * True when this bill takes the last of the order's open lines — the bill
   * that closes the rounding gap under PRORATA.
   */
  completesOrder: boolean;
}

/**
 * A charge row on the BILL that points back at one on the order.
 *
 * `amount` is what the bill actually carried, positive. `consume()` adds it to
 * the source and `release()` subtracts it; neither takes a pre-signed figure.
 */
export interface ChargeCarryRow {
  srcChargeId: string | null;
  srcAccYear: string | null;
  amount: number;
  basis?: ChargeCarryBasis;
}
