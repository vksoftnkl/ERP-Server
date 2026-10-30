/**
 * The temporary-credit refusals that have no SALES_ERROR_CODES member
 * (notes 119): the client words its box by `errors[0].code` alone.
 */
export enum TempCreditErrorCode {
  /** No live temporary credit with that id in that accounting year. */
  NOT_FOUND = 'TEMP_CREDIT_NOT_FOUND',
}
