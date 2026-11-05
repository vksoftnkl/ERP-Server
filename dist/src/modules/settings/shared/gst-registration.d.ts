export declare const GST_REG_TYPES: readonly ["REGULAR", "COMPOSITION", "UNREGISTERED", "SEZ"];
export type GstRegType = (typeof GST_REG_TYPES)[number];
export interface GstinFieldNames {
    gstin: string;
    stateCode: string;
    pan: string;
}
export interface GstinCheck {
    errors: Array<{
        field: string;
        message: string;
    }>;
    panFromGstin: string | null;
}
export declare function checkGstin(gstin: string | null | undefined, stateCode: string, pan: string | null | undefined, fields: GstinFieldNames): GstinCheck;
