export interface GstSplit {
    readonly cgstRate: number;
    readonly sgstRate: number;
    readonly igstRate: number;
    readonly cgstAmount: number;
    readonly sgstAmount: number;
    readonly igstAmount: number;
    readonly totalTax: number;
    readonly interState: boolean;
}
export declare const gstSplit: (taxableValue: unknown, combinedRate: unknown, interState?: unknown) => GstSplit;
export declare const isInterState: (supplierGstin: unknown, recipientGstin: unknown) => boolean;
export declare const gstExclusive: (inclusiveAmount: unknown, combinedRate: unknown) => number;
