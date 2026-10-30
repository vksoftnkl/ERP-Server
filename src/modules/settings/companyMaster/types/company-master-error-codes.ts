/**
 * Notes 119 / 127 §5 — every Company Master refusal carries one of these in
 * `errors[].code`; the client words its box by the code alone. A code keeps
 * its meaning forever: a new refusal gets a new member.
 */
export enum CompanyMasterErrorCode {
  /** No company with that id (or it is deleted) — get, update, delete, restore. */
  NOT_FOUND = 'COMPANY_NOT_FOUND',
  /** Restore asked for a company that is not deleted. */
  NOT_DELETED = 'COMPANY_NOT_DELETED',
  /** compName is blank. */
  NAME_REQUIRED = 'COMPANY_NAME_REQUIRED',
  /** compStateCode is not exactly 2 characters. */
  STATE_CODE_INVALID = 'COMPANY_STATE_CODE_INVALID',
  /** Another company already has this name. */
  NAME_DUPLICATE = 'COMPANY_NAME_DUPLICATE',
  /** Another company already has this code. */
  CODE_DUPLICATE = 'COMPANY_CODE_DUPLICATE',
  /** Another company already has this GSTIN. */
  GSTIN_DUPLICATE = 'COMPANY_GSTIN_DUPLICATE',
  /** The database refused the save on a unique index the checks above did not cover. */
  DUPLICATE = 'COMPANY_DUPLICATE',
  /** The default company cannot be deleted; make another the default first. */
  DEFAULT_UNDELETABLE = 'COMPANY_DEFAULT_UNDELETABLE',
  /** Delete refused: live branches, ledgers or vouchers still use the company. */
  IN_USE = 'COMPANY_IN_USE',
  /** compFinYearFrom is not a 1 April. */
  FIN_YEAR_FROM_INVALID = 'COMPANY_FIN_YEAR_FROM_INVALID',
  /** compFinYearTo is not a 31 March. */
  FIN_YEAR_TO_INVALID = 'COMPANY_FIN_YEAR_TO_INVALID',
  /** compFinYearTo is not the 31 March one year after compFinYearFrom. */
  FIN_YEAR_SPAN_INVALID = 'COMPANY_FIN_YEAR_SPAN_INVALID',
  /** compBooksBeginFrom falls outside the company's first financial year. */
  BOOKS_BEGIN_OUTSIDE_YEAR = 'COMPANY_BOOKS_BEGIN_OUTSIDE_YEAR',
  /** compGstinNo is not 15 letters/digits in the GSTIN shape. */
  GSTIN_INVALID = 'COMPANY_GSTIN_INVALID',
  /** compGstinNo is registered in another state than compStateCode. */
  GSTIN_STATE_MISMATCH = 'COMPANY_GSTIN_STATE_MISMATCH',
  /** compPanNo does not match the PAN inside compGstinNo. */
  PAN_GSTIN_MISMATCH = 'COMPANY_PAN_GSTIN_MISMATCH',
  /** compAuthorizeSignature is not (valid) base64. */
  SIGNATURE_NOT_BASE64 = 'COMPANY_SIGNATURE_NOT_BASE64',
  /** compAuthorizeSignature is over the size limit. */
  SIGNATURE_TOO_LARGE = 'COMPANY_SIGNATURE_TOO_LARGE',
  /** compAuthorizeSignature is not a PNG, JPEG, GIF or WebP image. */
  SIGNATURE_NOT_IMAGE = 'COMPANY_SIGNATURE_NOT_IMAGE',
  /** compStylesheetId names a theme that is inactive or deleted. */
  THEME_INACTIVE = 'COMPANY_THEME_INACTIVE',
}
