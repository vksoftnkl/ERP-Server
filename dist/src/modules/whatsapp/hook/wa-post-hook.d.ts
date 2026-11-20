export interface WaPostEvent {
    docType: 'SALES_ORDER';
    docId: string;
    accYear: string;
    companyId: string;
    branchId: string;
    vchrTypeId: number | null;
    waOnPost?: boolean | null;
}
export interface WaPostBlock {
    wmlId: string | null;
    accYear: string | null;
    status: 'SENDING' | 'SKIPPED' | 'FAILED' | 'NOT_CONNECTED';
    errorCode?: string | null;
    fallbackClickToChat?: boolean;
}
export type WaPostHandler = (event: WaPostEvent) => Promise<WaPostBlock | null>;
export declare class WaPostHook {
    private readonly logger;
    private handler;
    register(handler: WaPostHandler): void;
    fire(event: WaPostEvent): Promise<WaPostBlock | null>;
}
export declare class WaPostHookModule {
}
