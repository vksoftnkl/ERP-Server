import {
  throwAccountsBadRequest,
  type AccountsErrorDetail,
} from 'src/common/utils/module-service.utils';
import { SaaAddrType } from './types/ledger-shipping-address-enum';

// Central home for the four acc_ship_addrs data-quality checks that the source
// DDL declared as DB CHECK constraints (acc_ship_addrs_addr_type_chk,
// acc_ship_addrs_pin_chk, acc_ship_addrs_state_code_chk, acc_ship_addrs_gstin_chk).
// CHECK constraints cannot be expressed in the Prisma schema, so they are enforced
// here in the app layer and invoked from LedgerShippingAddressService.

export const DEFAULT_COUNTRY_CODE = 'IN';

// acc_ship_addrs_pin_chk : 6-digit PIN, only enforced for India.
export const SAA_PIN_REGEX = /^[0-9]{6}$/;

// acc_ship_addrs_state_code_chk : 2-digit GST numeric state code.
export const SAA_STATE_CODE_REGEX = /^[0-9]{2}$/;

// acc_ship_addrs_gstin_chk : standard 15-character GSTIN format.
export const SAA_GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const SAA_ADDR_TYPES = Object.values(SaaAddrType);

/**
 * acc_ship_addrs_addr_type_chk — value must be one of SHIP_TO / BILL_TO / BOTH.
 * Returns the normalized (trimmed, upper-cased) address type.
 */
export function assertSaaAddrType(value: string): SaaAddrType {
  const normalized = value.trim().toUpperCase();
  if (!SAA_ADDR_TYPES.includes(normalized as SaaAddrType)) {
    throwAccountsBadRequest<AccountsErrorDetail>('Validation failed', [
      {
        field: 'saaAddrType',
        message: `saaAddrType must be one of ${SAA_ADDR_TYPES.join(', ')}`,
      },
    ]);
  }
  return normalized as SaaAddrType;
}

/**
 * acc_ship_addrs_state_code_chk — tolerates null/undefined (mirrors the DB
 * `saa_state_code IS NULL OR ...`); a present value must be exactly 2 digits.
 */
export function assertSaaStateCode(value: string | null | undefined): void {
  if (value === null || value === undefined) {
    return;
  }
  if (!SAA_STATE_CODE_REGEX.test(value)) {
    throwAccountsBadRequest<AccountsErrorDetail>('Validation failed', [
      {
        field: 'saaStateCode',
        message: 'saaStateCode must be a 2-digit GST state code',
      },
    ]);
  }
}

/**
 * acc_ship_addrs_pin_chk — tolerates null/undefined, and is only enforced when
 * the country is India (mirrors the DB `pin IS NULL OR country <> 'IN' OR ...`).
 */
export function assertSaaPin(
  value: string | null | undefined,
  countryCode: string | null | undefined,
): void {
  if (value === null || value === undefined) {
    return;
  }
  const country = (countryCode ?? DEFAULT_COUNTRY_CODE).trim().toUpperCase();
  if (country !== DEFAULT_COUNTRY_CODE) {
    return;
  }
  if (!SAA_PIN_REGEX.test(value)) {
    throwAccountsBadRequest<AccountsErrorDetail>('Validation failed', [
      {
        field: 'saaPin',
        message: 'saaPin must be a 6-digit PIN code for India',
      },
    ]);
  }
}

/**
 * acc_ship_addrs_gstin_chk — GSTIN is mandatory (the column is NOT NULL) and must
 * match the standard 15-character format. Returns the normalized (trimmed,
 * upper-cased) GSTIN.
 */
export function assertSaaGstin(value: string | null | undefined): string {
  const normalized = (value ?? '').trim().toUpperCase();
  if (!normalized) {
    throwAccountsBadRequest<AccountsErrorDetail>('Validation failed', [
      {
        field: 'saaGstin',
        message: 'saaGstin is required',
      },
    ]);
  }
  if (!SAA_GSTIN_REGEX.test(normalized)) {
    throwAccountsBadRequest<AccountsErrorDetail>('Validation failed', [
      {
        field: 'saaGstin',
        message: 'saaGstin must be a valid 15-character GSTIN',
      },
    ]);
  }
  return normalized;
}
