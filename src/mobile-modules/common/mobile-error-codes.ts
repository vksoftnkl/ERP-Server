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
  /**
   * The branch the phone sent (an order's soBranchId, picked in VKSMAN's Switch
   * company) is not an active, live branch of the document's company: another
   * company's, switched off, deleted or unknown.
   */
  BRANCH_NOT_OF_COMPANY = 'MOBILE_BRANCH_NOT_OF_COMPANY',
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
  /**
   * accounts.receipt_salesman_mandatory is on and the signed-in login names no
   * live employee (user_master.usr_employee_id), so the phone's receipt has no
   * collector. Fixed on the User screen, not on the phone.
   */
  RECEIPT_NO_EMPLOYEE = 'MOBILE_RECEIPT_NO_EMPLOYEE',
  /**
   * A phone receipt line's discount is more than the prompt-payment discount
   * accounts.ppd_slabs suggests for that bill on the receipt's date (D4).
   */
  RECEIPT_DISCOUNT_ABOVE_PPD = 'MOBILE_RECEIPT_DISCOUNT_ABOVE_PPD',
  /** A phone receipt line's round-off is more than 0.99 (paise only, D5). */
  RECEIPT_ROUNDOFF_TOO_BIG = 'MOBILE_RECEIPT_ROUNDOFF_TOO_BIG',
  /** A phone return's srCustId names no live customer. */
  RETURN_CUSTOMER_NOT_FOUND = 'MOBILE_RETURN_CUSTOMER_NOT_FOUND',
  /**
   * A phone return's srReasonId is not an active SALE_RETURN reason the
   * company sees (GET /mobile/returns/options lists them).
   */
  RETURN_REASON_INVALID = 'MOBILE_RETURN_REASON_INVALID',
  /**
   * A phone return names a bill of another customer: the desktop would raise
   * the credit note on the bill's customer, not the one the salesman picked.
   */
  RETURN_BILL_OTHER_CUSTOMER = 'MOBILE_RETURN_BILL_OTHER_CUSTOMER',
  /**
   * The client uuid names a return that was deleted in VK Nex (a DRAFT the
   * office deleted): a resend cannot bring it back; the phone makes a new one.
   */
  RETURN_DELETED = 'MOBILE_RETURN_DELETED',
}
