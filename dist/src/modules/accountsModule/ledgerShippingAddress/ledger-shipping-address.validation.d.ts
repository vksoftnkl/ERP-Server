import { SaaAddrType } from './types/ledger-shipping-address-enum';
export declare const DEFAULT_COUNTRY_CODE = "IN";
export declare const SAA_PIN_REGEX: RegExp;
export declare const SAA_STATE_CODE_REGEX: RegExp;
export declare const SAA_GSTIN_REGEX: RegExp;
export declare function assertSaaAddrType(value: string): SaaAddrType;
export declare function assertSaaStateCode(value: string | null | undefined): void;
export declare function assertSaaPin(value: string | null | undefined, countryCode: string | null | undefined): void;
export declare function assertSaaGstin(value: string | null | undefined): string;
