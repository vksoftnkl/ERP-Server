export declare const PARTY_GSTIN_PATTERNS: {
    readonly NORMAL: RegExp;
    readonly TDS_DEDUCTOR: RegExp;
    readonly UIN: RegExp;
    readonly OIDAR: RegExp;
    readonly NRTP: RegExp;
};
export type PartyGstinKind = keyof typeof PARTY_GSTIN_PATTERNS;
export declare function gstinKindOf(gstin: string): PartyGstinKind | null;
export declare const PARTY_GSTIN_PATTERN: RegExp;
export declare const PARTY_PAN_PATTERN: RegExp;
export declare const NullableUpperPattern: (maxLength: number, constraint: string, pattern: RegExp, what: string) => <TFunction extends Function, Y>(target: TFunction | object, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<Y>) => void;
