import type { ModuleErrorDetail, ModuleErrorResponse } from "../../../../common/utils/module-shared.utils";
import type { GstRegType } from '../../shared/gst-registration';
export type GstinLookupErrorDetail = ModuleErrorDetail;
export type GstinLookupErrorResponse = ModuleErrorResponse<GstinLookupErrorDetail>;
export interface GstinLookupAddress {
    building: string | null;
    street: string | null;
    locality: string | null;
    city: string | null;
    district: string | null;
    state: string | null;
    pin: string | null;
}
export interface GstinLookupPayload {
    gstin: string;
    legalName: string | null;
    tradeName: string | null;
    status: string | null;
    registrationType: string | null;
    gstRegType: GstRegType | null;
    stateCode: string;
    panNo: string;
    registeredOn: string | null;
    address: GstinLookupAddress | null;
    raw: Record<string, unknown>;
}
