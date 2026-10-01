export declare const toOptionalUuid: (value: unknown) => string | undefined;
export declare const toTrimmedString: (value: unknown) => string | undefined;
export declare const toNullableUuid: (value: unknown) => string | null | undefined;
export declare const toNullableString: (value: unknown) => string | null | undefined;
export declare const toOptionalInteger: (value: unknown) => number | undefined;
export declare const toOptionalNumber: (value: unknown) => number | undefined;
export declare const toOptionalBoolean: (value: unknown) => boolean | undefined;
export declare const resolveAliasValue: (value: unknown, obj: unknown, aliases: string[]) => unknown;
