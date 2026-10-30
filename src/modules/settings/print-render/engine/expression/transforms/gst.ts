import { scalarToString } from './scalar';
/**
 * GST helpers for template expressions.
 *
 * The split rule is a place-of-supply rule, not an arithmetic one: an
 * intra-state supply splits the rate into equal CGST and SGST halves, an
 * inter-state supply carries the whole rate as IGST, and an export or SEZ
 * supply carries none. Templates must not re-derive this per design — a
 * template that gets it wrong prints a legally defective invoice.
 */

export interface GstSplit {
  readonly cgstRate: number;
  readonly sgstRate: number;
  readonly igstRate: number;
  readonly cgstAmount: number;
  readonly sgstAmount: number;
  readonly igstAmount: number;
  readonly totalTax: number;
  readonly interState: boolean;
}

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const toNumber = (value: unknown): number => {
  const numeric = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

/**
 * Split a taxable value at a combined GST rate.
 *
 * `interState` decides the split. When the caller has state codes rather than a
 * flag, use `isInterState` below — comparing GSTIN prefixes is the only
 * reliable test, since two branches in the same state may hold different GSTINs.
 */
export const gstSplit = (
  taxableValue: unknown,
  combinedRate: unknown,
  interState: unknown = false,
): GstSplit => {
  const taxable = toNumber(taxableValue);
  const rate = toNumber(combinedRate);
  const isInterStateSupply = Boolean(interState);

  if (isInterStateSupply) {
    const igstAmount = round2((taxable * rate) / 100);
    return {
      cgstRate: 0,
      sgstRate: 0,
      igstRate: rate,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount,
      totalTax: igstAmount,
      interState: true,
    };
  }

  const halfRate = rate / 2;
  const cgstAmount = round2((taxable * halfRate) / 100);
  // Derive SGST by subtraction rather than a second rounding, so CGST + SGST
  // always equals the total tax to the paisa. Two independent roundings of an
  // odd half-rate (2.5% of 100.01) can differ by one paisa and fail the
  // invoice's own footing check.
  const totalTax = round2((taxable * rate) / 100);
  const sgstAmount = round2(totalTax - cgstAmount);

  return {
    cgstRate: halfRate,
    sgstRate: halfRate,
    igstRate: 0,
    cgstAmount,
    sgstAmount,
    igstAmount: 0,
    totalTax,
    interState: false,
  };
};

/**
 * Place-of-supply test from two GSTINs (or two 2-digit state codes).
 * The first two characters of a GSTIN are the state code.
 */
export const isInterState = (supplierGstin: unknown, recipientGstin: unknown): boolean => {
  const supplierCode = scalarToString(supplierGstin).trim().slice(0, 2);
  const recipientCode = scalarToString(recipientGstin).trim().slice(0, 2);

  // An unregistered recipient has no GSTIN; the place of supply then comes from
  // the address, which the provider must resolve. Defaulting to intra-state
  // here matches the common counter-sale case.
  if (!supplierCode || !recipientCode) {
    return false;
  }

  return supplierCode !== recipientCode;
};

/**
 * Reverse-charge a GST-inclusive amount back to its taxable value.
 * MRP-based retail lines are priced inclusive, so the invoice has to show the
 * taxable value the tax was computed on.
 */
export const gstExclusive = (inclusiveAmount: unknown, combinedRate: unknown): number => {
  const inclusive = toNumber(inclusiveAmount);
  const rate = toNumber(combinedRate);
  return round2(inclusive / (1 + rate / 100));
};
