/**
 * Transporters master (menu 149; plan-vehicle-master-2026-11-11 §4.9 / §5.2) — every
 * refusal of /transporters/* carries one of these as `errors[].code`. The right codes
 * (TRN_RIGHT_VIEW / _CREATE / _EDIT / _DELETE) are built by assertMenuRight from the
 * prefix TRN. NAME_REQUIRED / GSTIN_INVALID / NAME_TAKEN were worded on 11-04.
 */
export enum TransporterErrorCode {
  /** The name is empty after squeezing spaces. */
  NAME_REQUIRED = 'TRN_NAME_REQUIRED',
  /** GSTIN / TRANSIN is not 15 letters and digits (a GSTIN starts with 2 digits). */
  GSTIN_INVALID = 'TRN_GSTIN_INVALID',
  /** Another live transporter of this company (or a shared one) has the name (online, D24). */
  NAME_TAKEN = 'TRN_NAME_TAKEN',
  /** No live transporter of the login company with this id. */
  NOT_FOUND = 'TRN_NOT_FOUND',
  /** stateCode is not an active fixed.state_codes row. */
  STATE_INVALID = 'TRN_STATE_INVALID',
  /** companyId in the body is not the login company (D25). */
  COMPANY_MISMATCH = 'TRN_COMPANY_MISMATCH',
  /** The ledger service's LEDGER_NAME_TAKEN, worded for this screen (D33). */
  LEDGER_NAME_TAKEN = 'TRN_LEDGER_NAME_TAKEN',
  /** Delete refused: the ledger's balance is not zero in some company (D34). */
  HAS_BALANCE = 'TRN_HAS_BALANCE',
  /** Delete refused: a cheque of the transporter is still in hand (D34). */
  HAS_CHEQUE_IN_HAND = 'TRN_HAS_CHEQUE_IN_HAND',
}

/** assertMenuRight's code prefix: TRN_RIGHT_<RIGHT>. */
export const TRANSPORTER_RIGHT_PREFIX = 'TRN';
