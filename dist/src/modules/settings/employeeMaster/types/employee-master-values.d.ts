export declare const EMPLOYEE_STATUSES: readonly ["Working", "Resigned"];
export declare const EMPLOYEE_STATUS_WORKING = "Working";
export declare const EMPLOYEE_STATUS_RESIGNED = "Resigned";
export declare const EMPLOYMENT_TYPES: readonly ["Permanent", "Contract", "Daily Wage", "Apprentice"];
export declare const COMMISSION_TYPES: readonly ["Percent", "Amount"];
export declare function canonicalListValue(value: unknown, list: readonly string[], blank: string | null): unknown;
export declare const EMPLOYEE_IFSC_PATTERN: RegExp;
export declare const EMPLOYEE_COMMISSION_VALUE_PATTERN: RegExp;
