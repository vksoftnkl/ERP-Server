/** The answer to POST /mobile/orders/create, for a new order and a resend alike. */
export interface MobileOrderCreateResult {
  soId: string;
  soOrderRefno: string;
  /** The order's status NOW: DRAFT when just saved; a resend reads the stored one. */
  soStatus: string;
  soAccYear: string;
  /** true = this client uuid was saved before: nothing was written this time. */
  duplicate: boolean;
  /** A resend of an order the office has since deleted. */
  soIsDeleted: boolean;
}
