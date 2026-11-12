/**
 * Vehicle Master (menu 125, plan-vehicle-master-2026-11-11 §4.9 / §5.1) — every
 * refusal of /vehicles/* carries one of these as `errors[].code`; the client words
 * its box from fixed.error_message by the code alone. The right codes
 * (VEH_RIGHT_VIEW / _CREATE / _EDIT / _DELETE) are built by assertMenuRight from
 * the prefix VEH.
 */
export enum VehicleErrorCode {
  /** The vehicle number is empty after cleaning. */
  NO_REQUIRED = 'VEH_NO_REQUIRED',
  /** The cleaned number is not 4-20 letters and digits. */
  NO_INVALID = 'VEH_NO_INVALID',
  /** A live vehicle of this company already has the number (online check, D11 / D24). */
  NO_TAKEN = 'VEH_NO_TAKEN',
  /** No live vehicle of the login company with this id. */
  NOT_FOUND = 'VEH_NOT_FOUND',
  /** The transporter is not a live, active transporter of this company (or a shared one). */
  TRANSPORTER_INVALID = 'VEH_TRANSPORTER_INVALID',
  /** The driver is not a live, active employee of this company. */
  DRIVER_INVALID = 'VEH_DRIVER_INVALID',
  /** The home branch is not a live branch of this company. */
  BRANCH_INVALID = 'VEH_BRANCH_INVALID',
  /** companyId in the body is not the login company (D25). */
  COMPANY_MISMATCH = 'VEH_COMPANY_MISMATCH',
}

/** assertMenuRight's code prefix: VEH_RIGHT_<RIGHT>. */
export const VEHICLE_RIGHT_PREFIX = 'VEH';
