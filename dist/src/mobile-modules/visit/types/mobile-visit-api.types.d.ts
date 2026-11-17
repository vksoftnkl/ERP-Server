export declare const MOBILE_VISIT_REASON_CODES: readonly ["shopClosed", "noOrder", "shopBusy", "ownerAway", "paymentPending", "nextVisit"];
export type MobileVisitReasonCode = (typeof MOBILE_VISIT_REASON_CODES)[number];
export interface MobileVisitCreateResult {
    cvId: string;
    cvClientUuid: string;
    cvVisitAt: string;
    duplicate: boolean;
}
