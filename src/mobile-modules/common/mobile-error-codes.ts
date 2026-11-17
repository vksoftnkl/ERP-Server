/**
 * Refusal codes of the mobile routes (`errors[].code`, notes 119 / 127 §5).
 * The phone words its message by the code alone. One meaning per code: a new
 * meaning gets a new member, never an old one.
 */
export enum MobileErrorCode {
  /** companyId names no active, live company. */
  COMPANY_NOT_FOUND = 'MOBILE_COMPANY_NOT_FOUND',
  /** deviceUid names no registered (live) device in fixed.device_master. */
  DEVICE_NOT_REGISTERED = 'MOBILE_DEVICE_NOT_REGISTERED',
  /** The registered device is blocked (dev_is_blocked). */
  DEVICE_BLOCKED = 'MOBILE_DEVICE_BLOCKED',
  /** The registered device is switched off (dev_is_active = false). */
  DEVICE_INACTIVE = 'MOBILE_DEVICE_INACTIVE',
  /**
   * No branch of the company to save in: the phone's own branch belongs to
   * another company (or it has none), and the company has no default branch
   * and more than one (or no) active branch.
   */
  BRANCH_NOT_RESOLVED = 'MOBILE_BRANCH_NOT_RESOLVED',
  /** No financial year of the company holds the document's date. */
  NO_FISCAL_YEAR = 'MOBILE_NO_FISCAL_YEAR',
  /** An upload with no token names no soUserId either: so_user_id is NOT NULL. */
  ORDER_USER_REQUIRED = 'MOBILE_ORDER_USER_REQUIRED',
  /**
   * The client uuid was already used for a different document (another
   * customer): a resend must carry the same order / visit, so this is a phone
   * bug, not a lost answer.
   */
  CLIENT_UUID_REUSED = 'MOBILE_CLIENT_UUID_REUSED',
  /** cvCustId names no live customer. */
  VISIT_CUSTOMER_NOT_FOUND = 'MOBILE_VISIT_CUSTOMER_NOT_FOUND',
  /** cvSalesmanId names no live employee. */
  VISIT_SALESMAN_NOT_FOUND = 'MOBILE_VISIT_SALESMAN_NOT_FOUND',
  /** Only one of cvLatitude / cvLongitude was sent: send both, or neither. */
  VISIT_POSITION_INCOMPLETE = 'MOBILE_VISIT_POSITION_INCOMPLETE',
  /**
   * A bill line's sbiGodownId is not a live, active godown of the branch the
   * phone's bills land in (GET /mobile/bills/options lists the ones it may use).
   */
  GODOWN_INVALID = 'MOBILE_GODOWN_INVALID',
}
