/**
 * Notes 119 / 127 §5 — every GSTIN search refusal raised here carries one of
 * these in `errors[].code`; the client words its box by the code alone. A
 * switched-off route is refused by the GST module's own guard
 * (assertGstRouteActive, GST_CODES.SWITCHED_OFF). A code keeps its meaning
 * forever: a new refusal gets a new member.
 */
export enum GstinLookupErrorCode {
  /** The GST service answered, but holds no taxpayer for that GSTIN (404). */
  NOT_FOUND = 'GSTIN_LOOKUP_NOT_FOUND',
  /** The GST service could not be reached — network error or timeout (502). */
  UPSTREAM_UNREACHABLE = 'GSTIN_LOOKUP_UPSTREAM_UNREACHABLE',
  /** The GST service answered with an error or a non-success body (502). */
  UPSTREAM_ERROR = 'GSTIN_LOOKUP_UPSTREAM_ERROR',
  /** No GSTIN search service is set up under GST Providers (503). */
  NOT_SET_UP = 'GSTIN_LOOKUP_NOT_SET_UP',
  /** No active GSTIN search provider is left to use (503). */
  NO_ACTIVE_PROVIDER = 'GSTIN_LOOKUP_NO_ACTIVE_PROVIDER',
  /** The request company has no GSTIN of its own to search as (503). */
  COMPANY_GSTIN_MISSING = 'GSTIN_LOOKUP_COMPANY_GSTIN_MISSING',
  /** The provider account lacks a value the endpoint template needs (aspId, apiKey, …) (503). */
  ACCOUNT_INCOMPLETE = 'GSTIN_LOOKUP_ACCOUNT_INCOMPLETE',
  /** The configured endpoint does not build a valid URL (503). */
  URL_INVALID = 'GSTIN_LOOKUP_URL_INVALID',
}
