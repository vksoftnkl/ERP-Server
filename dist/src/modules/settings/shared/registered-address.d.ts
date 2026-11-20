export declare const GST_REGISTERED_TYPES: readonly string[];
export declare const PIN_MIN = 100000;
export declare const PIN_MAX = 999999;
export declare function isGstRegistered(regType: string | null | undefined): boolean;
export declare function isValidPin(pin: number): boolean;
export declare function isBlank(value: unknown): boolean;
export declare function blankKeys(values: Record<string, unknown>, keys: readonly string[]): string[];
export declare const upperStateCode: ({ value }: {
    value: unknown;
}) => unknown;
