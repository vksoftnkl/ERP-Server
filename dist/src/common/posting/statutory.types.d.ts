export type StatutoryValueType = 'AMOUNT' | 'PERCENT' | 'DAYS' | 'HOURS' | 'KM' | 'BOOL' | 'TEXT';
export type StatutoryEnforce = 'WARN' | 'REFUSE' | 'INFO';
export type StatutoryAppliesTo = 'ALL' | 'INTRA_STATE' | 'INTER_STATE' | 'B2B' | 'B2C' | (string & {});
export type AatoClass = 'LE_1_5CR' | 'LE_5CR' | 'LE_10CR' | 'GT_10CR';
export interface StatutoryLimit {
    id: string;
    code: string;
    section: string | null;
    label: string;
    valueType: StatutoryValueType;
    value: number | null;
    valueText: string | null;
    enforce: StatutoryEnforce;
    effectiveFrom: string;
    effectiveTo: string | null;
    sourceRef: string | null;
    isCompanyOverride: boolean;
}
export declare const STATUTORY_CODES: {
    readonly CASH_TXN_LIMIT_269ST: "CASH_TXN_LIMIT_269ST";
    readonly PAN_REQUIRED_CASH_SALE: "PAN_REQUIRED_CASH_SALE";
    readonly TCS_206C1H_THRESHOLD: "TCS_206C1H_THRESHOLD";
    readonly TCS_206C1H_RATE: "TCS_206C1H_RATE";
    readonly EWAY_VALUE_LIMIT: "EWAY_VALUE_LIMIT";
    readonly EWAY_VALIDITY_KM_PER_DAY: "EWAY_VALIDITY_KM_PER_DAY";
    readonly EWAY_ODC_KM_PER_DAY: "EWAY_ODC_KM_PER_DAY";
    readonly EWAY_CANCEL_HOURS: "EWAY_CANCEL_HOURS";
    readonly EINV_CANCEL_HOURS: "EINV_CANCEL_HOURS";
    readonly EINV_AATO_THRESHOLD: "EINV_AATO_THRESHOLD";
    readonly EINV_REPORT_DAYS: "EINV_REPORT_DAYS";
    readonly HSN_DIGITS: "HSN_DIGITS";
    readonly CREDIT_NOTE_CUTOFF: "CREDIT_NOTE_CUTOFF";
    readonly DC_RETURN_WINDOW_DAYS: "DC_RETURN_WINDOW_DAYS";
};
export type StatutoryCode = (typeof STATUTORY_CODES)[keyof typeof STATUTORY_CODES];
export type CancelWindowKind = 'IRN' | 'EWAYBILL';
export interface SalesStatutoryErrorDetail {
    field: string;
    message: string;
    code?: string;
    value?: number | string | null;
    effectiveFrom?: string;
    isCompanyOverride?: boolean;
}
export interface SalesStatutoryErrorResponse {
    statusCode: number;
    message: string;
    errors: SalesStatutoryErrorDetail[];
}
