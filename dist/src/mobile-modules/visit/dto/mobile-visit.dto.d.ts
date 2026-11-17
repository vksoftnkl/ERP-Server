import { type MobileVisitReasonCode } from '../types/mobile-visit-api.types';
export declare class CreateMobileVisitDto {
    cvClientUuid: string;
    cvCompanyId: string;
    deviceUid: string;
    cvCustId: string;
    cvSalesmanId: string;
    cvReasonCode: MobileVisitReasonCode;
    cvRemarks?: string | null;
    cvLatitude?: number | null;
    cvLongitude?: number | null;
    cvGpsAccuracy?: number | null;
    cvVisitAt: string;
}
