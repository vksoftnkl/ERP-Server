import type { ModuleErrorDetail } from '../../../common/utils/module-shared.utils';

/**
 * Every refusal the audit log raises (notes 119): the client words its box by
 * `errors[0].code` alone. Most fire from an audit WRITE another service makes
 * inside its own save, so they reach the client as that save's 400.
 */
export enum AuditLogErrorCode {
  /** A screenId names no active audit_screen row. */
  SCREEN_NOT_FOUND = 'AUDIT_LOG_SCREEN_NOT_FOUND',
  /** A screenId that is not a positive integer. */
  SCREEN_ID_INVALID = 'AUDIT_LOG_SCREEN_ID_INVALID',
  /** An audit write named neither a screenId nor a screenName. */
  SCREEN_REQUIRED = 'AUDIT_LOG_SCREEN_REQUIRED',
  /** A screen type other than master / transaction / settings / other. */
  SCREEN_TYPE_UNSUPPORTED = 'AUDIT_LOG_SCREEN_TYPE_UNSUPPORTED',
  /** An audit write with an empty tableName. */
  TABLE_NAME_REQUIRED = 'AUDIT_LOG_TABLE_NAME_REQUIRED',
  /** An audit action other than insert / update / approve / cancel. */
  ACTION_UNSUPPORTED = 'AUDIT_LOG_ACTION_UNSUPPORTED',
  /** An audit write is missing the before/after record its action needs (no auto snapshot to fall back on). */
  RECORD_REQUIRED = 'AUDIT_LOG_RECORD_REQUIRED',
  /** A document revision with no tableName or no docId. */
  REVISION_KEY_REQUIRED = 'AUDIT_LOG_REVISION_KEY_REQUIRED',
  /** A document revision with no `after` snapshot. */
  REVISION_AFTER_REQUIRED = 'AUDIT_LOG_REVISION_AFTER_REQUIRED',
  /** List: date_from or date_to is not a date. */
  DATE_INVALID = 'AUDIT_LOG_DATE_INVALID',
  /** List: date_from is after date_to. */
  DATE_RANGE_INVALID = 'AUDIT_LOG_DATE_RANGE_INVALID',
}

export interface AuditLogErrorDetail extends ModuleErrorDetail {
  code: AuditLogErrorCode;
}
