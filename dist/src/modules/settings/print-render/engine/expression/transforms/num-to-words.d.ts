export declare const integerToIndianWords: (value: number) => string;
export interface NumToWordsOptions {
    readonly currency?: string;
    readonly subCurrency?: string;
    readonly only?: boolean;
    readonly decimals?: number;
}
export declare const numberToIndianWords: (value: unknown, options?: NumToWordsOptions) => string;
