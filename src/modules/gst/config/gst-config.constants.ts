/**
 * The finite vocabularies of the gst_* tables, spelled exactly as their CHECK
 * constraints spell them (11_gst_provider.sql, migration 20260921120000). The
 * DTOs validate against these so a bad value is a 400 naming the field, not a
 * 23514 from the database.
 */

export const GST_SERVICES = ['EINVOICE', 'EWAYBILL', 'GSTIN_VERIFY', 'GSTR', 'ASP_ADMIN'] as const;
export type GstService = (typeof GST_SERVICES)[number];

export const GST_ENVIRONMENTS = ['SANDBOX', 'PRODUCTION'] as const;
export type GstEnvironment = (typeof GST_ENVIRONMENTS)[number];

/** ck_gps_auth_scheme */
export const GST_AUTH_SCHEMES = [
  'NIC_SEK',
  'OAUTH2',
  'API_KEY',
  'BASIC',
  'BEARER_STATIC',
  'CUSTOM',
] as const;

/** ck_gps_payload_encryption — NONE: the GSP encrypts for us; AES_SEK / RSA: we do. */
export const GST_PAYLOAD_ENCRYPTIONS = ['NONE', 'AES_SEK', 'RSA'] as const;

/** ck_gpe_action */
export const GST_ACTIONS = [
  'AUTH',
  'GENERATE_IRN',
  'CANCEL_IRN',
  'GET_IRN',
  'GET_IRN_BY_DOC',
  'GENERATE_EWB',
  'GENERATE_EWB_BY_IRN',
  'UPDATE_PART_B',
  'UPDATE_TRANSPORTER',
  'EXTEND_VALIDITY',
  'CANCEL_EWB',
  'REJECT_EWB',
  'CLOSE_EWB',
  'GET_EWB',
  'PRINT_EWB',
  'GET_EWB_BY_DATE',
  'GET_EWB_FOR_TRANSPORTER',
  'GET_EWB_OTHER_PARTY',
  'GET_EWB_REJECTED',
  'GENERATE_CONSOLIDATED_EWB',
  'REGENERATE_CONSOLIDATED_EWB',
  'GET_CONSOLIDATED_EWB',
  'PRINT_CONSOLIDATED_EWB',
  'INIT_MULTI_VEHICLE',
  'ADD_MULTI_VEHICLE',
  'CHANGE_MULTI_VEHICLE',
  'VERIFY_GSTIN',
  'SYNC_GSTIN',
  'GET_TRANSIN',
  'GET_HSN',
  'GSTR1_SAVE',
  'GSTR1_SUBMIT',
  'GSTR_STATUS',
  'GET_API_BALANCE',
  'GET_ERROR_LIST',
  'HEALTH',
] as const;

/** ck_gpe_http_method */
export const GST_HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

/** ck_gfm_direction */
export const GST_FIELD_DIRECTIONS = ['REQUEST', 'RESPONSE'] as const;
/** ck_gfm_data_type */
export const GST_FIELD_DATA_TYPES = [
  'TEXT',
  'INT',
  'DECIMAL',
  'BOOL',
  'DATE',
  'DATETIME',
  'JSON',
] as const;
/** ck_gfm_transform */
export const GST_FIELD_TRANSFORMS = [
  'NONE',
  'TRIM',
  'UPPER',
  'LOWER',
  'DATE_DDMMYYYY',
  'DATETIME_NIC',
  'EPOCH_MS',
  'DATETIME_MASK',
  'BASE64_DECODE',
  'JWT_PAYLOAD',
  'JSON_PARSE',
] as const;

/** ck_gem_our_code — the words the application branches on, never a provider's number. */
export const GST_OUR_ERROR_CODES = [
  'DUPLICATE_IRN',
  'IRN_NOT_FOUND',
  'CANCEL_WINDOW_EXPIRED',
  'AUTH_FAILED',
  'TOKEN_EXPIRED',
  'IP_NOT_WHITELISTED',
  'INVALID_GSTIN',
  'GSTIN_INACTIVE',
  'VALIDATION',
  'DUPLICATE_EWB',
  'EWB_NOT_FOUND',
  'RATE_LIMITED',
  'UPSTREAM_DOWN',
  'TIMEOUT',
  'CREDIT_EXHAUSTED',
  'ENV_MISMATCH',
  'UNKNOWN',
] as const;
/** ck_gem_treat_as */
export const GST_TREAT_AS = ['ERROR', 'SUCCESS', 'WARNING'] as const;
/** ck_gem_recovery_action */
export const GST_RECOVERY_ACTIONS = [
  'NONE',
  'REAUTH',
  'BACKOFF',
  'FETCH_BY_DOC',
  'FAILOVER',
  'MANUAL',
] as const;
/** ck_gem_severity */
export const GST_SEVERITIES = ['INFO', 'WARN', 'ERROR'] as const;

/** ck_gpv_code_shape */
export const GST_PROVIDER_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;
/** ck_gps_base_url — scheme + host, no trailing slash. */
export const GST_BASE_URL_PATTERN = /^https?:\/\/\S+[^/]$/;
/** ck_gfm_path / ck_gem_extract_path — a JSONPath from the root. */
export const GST_JSON_PATH_PATTERN = /^\$/;

/**
 * The two menus whose `user_menus` rows gate these routes (notes 79 §2, menu
 * file 46_gst_menus.sql / migration 20261002150000_gst_menus). Found by name
 * under Configuration (60), not pinned: their ids come from the sequence (267 /
 * 268 on the dry run, not the 255 / 256 the old plan reserved).
 *
 *   GST Providers   — providers, services, endpoints, field / error maps, accounts
 *   GST Credentials — company credentials; POST is Verify (it signs in to an
 *                     outside system, so it is a right of its own)
 */
export const GST_PROVIDERS_MENU = { parent: 60, name: 'GST Providers' } as const;
export const GST_CREDENTIALS_MENU = { parent: 60, name: 'GST Credentials' } as const;
export type GstMenu = typeof GST_PROVIDERS_MENU | typeof GST_CREDENTIALS_MENU;

/** The `code` on each refusal these routes raise, for the client to branch on. */
export const GST_CODES = {
  PROVIDER_CODE_DUPLICATE: 'GST_PROVIDER_CODE_DUPLICATE',
  PROVIDER_CODE_FIXED: 'GST_PROVIDER_CODE_FIXED',
  PROVIDER_IN_USE: 'GST_PROVIDER_IN_USE',
  PROVIDER_DELETED: 'GST_PROVIDER_DELETED',
  SERVICE_DUPLICATE: 'GST_SERVICE_DUPLICATE',
  ENDPOINT_DUPLICATE: 'GST_ENDPOINT_DUPLICATE',
  FIELD_MAP_DUPLICATE: 'GST_FIELD_MAP_DUPLICATE',
  ERROR_MAP_DUPLICATE: 'GST_ERROR_MAP_DUPLICATE',
  ACCOUNT_DUPLICATE: 'GST_ACCOUNT_DUPLICATE',
  CREDENTIAL_PRIMARY_EXISTS: 'GST_CREDENTIAL_PRIMARY_EXISTS',
  CREDENTIAL_PRIORITY_TAKEN: 'GST_CREDENTIAL_PRIORITY_TAKEN',
  PARENT_FIXED: 'GST_PARENT_FIXED',
  ALREADY_DELETED: 'GST_ALREADY_DELETED',
  NOT_DELETED: 'GST_NOT_DELETED',
  NO_GSTIN: 'GST_NO_GSTIN',
  CRED_KEY_MISSING: 'GST_CRED_KEY_MISSING',
  AUTH_BUSY: 'GST_AUTH_BUSY',
  AUTH_RATE_LIMIT: 'GST_AUTH_RATE_LIMIT',
  NO_AUTH_ENDPOINT: 'GST_NO_AUTH_ENDPOINT',
  CREDENTIAL_INCOMPLETE: 'GST_CREDENTIAL_INCOMPLETE',
  PUBLIC_KEY_MISSING: 'GST_PUBLIC_KEY_MISSING',
  SWITCHED_OFF: 'GST_SWITCHED_OFF',
} as const;
