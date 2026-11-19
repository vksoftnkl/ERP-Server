/**
 * Company + Branch master plan I1 / C8 (18/11/2026): what a GSTIN holder must
 * fill in. The e-invoice (IRN) and e-way bill seller block needs address line
 * 1, the place (city), the state and a 6-digit pin; the district is not asked.
 * Company and branch apply the same rule, each with its own keys and codes.
 */

/** The GST registration types that hold a GSTIN (UNREGISTERED does not). */
export const GST_REGISTERED_TYPES: readonly string[] = ['REGULAR', 'COMPOSITION', 'SEZ'];

/** A pin code is six digits that do not start with 0. */
export const PIN_MIN = 100000;
export const PIN_MAX = 999999;

export function isGstRegistered(regType: string | null | undefined): boolean {
  return typeof regType === 'string' && GST_REGISTERED_TYPES.includes(regType.trim().toUpperCase());
}

export function isValidPin(pin: number): boolean {
  return Number.isInteger(pin) && pin >= PIN_MIN && pin <= PIN_MAX;
}

/** null, undefined, a blank string and NaN count as not filled in. */
export function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  return typeof value === 'number' && Number.isNaN(value);
}

/** The keys of `keys` that `values` leaves blank, in the order given. */
export function blankKeys(values: Record<string, unknown>, keys: readonly string[]): string[] {
  return keys.filter((key) => isBlank(values[key]));
}

/**
 * DTO transform for compStateCode / brStateCode: trimmed and upper-cased, and
 * null becomes '' so the service, not the ValidationPipe, words a blank state
 * (COMPANY_ / BRANCH_ADDRESS_REQUIRED for a GSTIN holder, else _STATE_CODE_INVALID).
 */
export const upperStateCode = ({ value }: { value: unknown }): unknown =>
  value === null ? '' : typeof value === 'string' ? value.trim().toUpperCase() : value;
