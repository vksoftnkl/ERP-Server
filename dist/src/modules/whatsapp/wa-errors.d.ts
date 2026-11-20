export declare const WA_HOUSE_CODES: {
    readonly COMPANY_NOT_FOUND: "LOOKUP_COMPANY_NOT_FOUND";
    readonly KIND_NOT_SENT: "VALIDATION_IS_IN";
};
export interface WaErrorDetail {
    field: string;
    code: string;
    message: string;
    [extra: string]: unknown;
}
export declare function waHttpStatus(code: string): number;
export declare function waRefuse(code: string, message: string, field?: string, extra?: Record<string, unknown>): never;
export declare function waRefuseMany(message: string, details: WaErrorDetail[]): never;
export declare class WaRelayError extends Error {
    readonly waCode: string;
    readonly relay: {
        httpStatus: number | null;
        relayCode: string | null;
        field?: string | null;
        metaCode?: number | null;
        metaTitle?: string | null;
        relayMsgId?: string | null;
    };
    constructor(waCode: string, message: string, relay: {
        httpStatus: number | null;
        relayCode: string | null;
        field?: string | null;
        metaCode?: number | null;
        metaTitle?: string | null;
        relayMsgId?: string | null;
    });
    get unconfirmed(): boolean;
}
