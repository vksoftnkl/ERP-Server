import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, ValidateBy } from 'class-validator';
import { SkipOnNullish } from 'src/common/dto/dtoDecorators';

// Moved here from sales/customer/dto/save-customer.dto.ts (2026-10-29) so the supplier DTO
// checks a GSTIN the same way: supplier edits sync to the customer of the same party
// (party-sync.service.ts), so both masters must refuse the same shapes. The CUSTOMER_*
// names stay exported from the customer DTO for its readers.

/**
 * Every GSTN registration shape a customer or supplier can hold (U1). All are 15 characters, upper
 * case. Written from GSTN's published structure of each number (GSTIN / UIN layouts in
 * the GST registration rules and GSTN FAQs), from knowledge, not copied from a fetched
 * file; there is no checksum test here (Qt adds one for NORMAL):
 *  - NORMAL: 2-digit state + PAN (AAAAA9999A) + entity no. + 'Z' + check
 *    (regular, composition, SEZ, casual, ISD, e-commerce TCS collector). Same as the
 *    Qt TaxValidator today.
 *  - TDS_DEDUCTOR: 2-digit state + TAN (AAAA99999A) + entity no. + 'D' + check
 *    (government departments deducting GST TDS, section 51).
 *  - UIN: 2-digit state + 2-digit country code + 3-letter body code + 5 digits + 'UN'
 *    or 'ON' + check (embassies, UN bodies, notified persons).
 *  - OIDAR: '99' + 2-digit country code + 3 letters + 5 digits + 'OS' + check
 *    (online services from abroad; state 99 is "Centre Jurisdiction").
 *  - NRTP: 2-digit state + 2-digit country code + 3 letters + 5 digits + 'NR' + check
 *    (non-resident taxable person).
 * Only NORMAL has its state checked against the party's state code (party-gst-type.ts,
 * CUSTOMER_ / PURCHASE_SUPPLIER_GSTIN_STATE_MISMATCH).
 */
export const PARTY_GSTIN_PATTERNS = {
  NORMAL: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
  TDS_DEDUCTOR: /^[0-9]{2}[A-Z]{4}[0-9]{5}[A-Z][1-9A-Z]D[0-9A-Z]$/,
  UIN: /^[0-9]{4}[A-Z]{3}[0-9]{5}[UO]N[0-9A-Z]$/,
  OIDAR: /^99[0-9]{2}[A-Z]{3}[0-9]{5}OS[0-9A-Z]$/,
  NRTP: /^[0-9]{4}[A-Z]{3}[0-9]{5}NR[0-9A-Z]$/,
} as const;
export type PartyGstinKind = keyof typeof PARTY_GSTIN_PATTERNS;
/** Which shape a GSTIN has, or null when it has none of them. */
export function gstinKindOf(gstin: string): PartyGstinKind | null {
  for (const kind of Object.keys(PARTY_GSTIN_PATTERNS) as PartyGstinKind[]) {
    if (PARTY_GSTIN_PATTERNS[kind].test(gstin)) {
      return kind;
    }
  }
  return null;
}
/** Any accepted shape, as one pattern (Swagger, and for the Qt validator to match). */
export const PARTY_GSTIN_PATTERN = new RegExp(
  `^(?:${Object.values(PARTY_GSTIN_PATTERNS)
    .map((pattern) => pattern.source.slice(1, -1))
    .join('|')})$`,
);
/** Income-tax PAN: 5 letters, 4 digits, 1 letter. */
export const PARTY_PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const toNullableUpperStrict = (value: unknown): unknown => {
  if (value === undefined || value === null || typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim().toUpperCase();
  return trimmed ? trimmed : null;
};

/**
 * Trimmed and upper-cased; blank is null (= cleared) and is not checked. A sent value
 * must match `pattern`; the house pipe codes the refusal VALIDATION_ + the constraint
 * name in upper snake case (isGstin -> VALIDATION_IS_GSTIN).
 */
export const NullableUpperPattern = (
  maxLength: number,
  constraint: string,
  pattern: RegExp,
  what: string,
) =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toNullableUpperStrict(value)),
    SkipOnNullish(),
    IsString(),
    MaxLength(maxLength),
    ValidateBy({
      name: constraint,
      validator: {
        validate: (value: unknown) => typeof value === 'string' && pattern.test(value),
        defaultMessage: (args) => `${args?.property ?? 'value'} must be ${what}`,
      },
    }),
  );
