/**
 * HR masters review step 5 (20/11/2026) — the values the Employee Master's
 * fixed lists may hold. The DB has no CHECK on any of them: the server stores
 * the spelling below whatever case (or spacing) the client sent, and refuses
 * anything else (house ValidationPipe, VALIDATION_IS_IN).
 */

/** emp_status. Blank means Working (user H5, 19/11); the DB default is Working too. */
export const EMPLOYEE_STATUSES = ['Working', 'Resigned'] as const;
export const EMPLOYEE_STATUS_WORKING = 'Working';
export const EMPLOYEE_STATUS_RESIGNED = 'Resigned';

/** emp_employment_type (user 20/11). Blank = not stated (null). */
export const EMPLOYMENT_TYPES = ['Permanent', 'Contract', 'Daily Wage', 'Apprentice'] as const;

/** emp_commission_type (user 20/11). Blank = not stated (null). */
export const COMMISSION_TYPES = ['Percent', 'Amount'] as const;

/** Letters and digits only, upper case: "daily wage", "Daily-Wage" and "DAILY  WAGE" are one. */
const matchKey = (text: string): string => text.toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * The list's own spelling of `value`, compared on letters and digits in any
 * case. undefined stays undefined (not sent); null and blank become `blank`;
 * a value the list does not hold comes back trimmed, for the validator to refuse.
 */
export function canonicalListValue(
  value: unknown,
  list: readonly string[],
  blank: string | null,
): unknown {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return blank;
  }
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return blank;
  }
  const key = matchKey(trimmed);
  return list.find((entry) => matchKey(entry) === key) ?? trimmed;
}

/** emp_bank_ifsc: 4 letters, a 0, then 6 letters or digits (SBIN0001234), as the cheque IFSC. */
export const EMPLOYEE_IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** emp_commission_value numeric(12,3): a plain figure, 0 or more, up to 3 decimals. */
export const EMPLOYEE_COMMISSION_VALUE_PATTERN = /^\d{1,9}(\.\d{1,3})?$/;
