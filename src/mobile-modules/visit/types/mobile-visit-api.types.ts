/** The reasons the phone sends with a check-in (ck_cv_reason_code). */
export const MOBILE_VISIT_REASON_CODES = [
  'shopClosed',
  'noOrder',
  'shopBusy',
  'ownerAway',
  'paymentPending',
  'nextVisit',
] as const;
export type MobileVisitReasonCode = (typeof MOBILE_VISIT_REASON_CODES)[number];

/** The answer to POST /mobile/visits/create, for a new check-in and a resend alike. */
export interface MobileVisitCreateResult {
  cvId: string;
  cvClientUuid: string;
  /** ISO instant the server holds for the visit (the phone's clock). */
  cvVisitAt: string;
  /** true = this client uuid was saved before: nothing was written this time. */
  duplicate: boolean;
}
