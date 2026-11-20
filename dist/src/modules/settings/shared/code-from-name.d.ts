export interface InitialsCodeRule {
    readonly skipWords: ReadonlySet<string>;
    readonly minLength: number;
    readonly maxLength: number;
}
export declare const COMPANY_CODE_RULE: InitialsCodeRule;
export declare const DEPARTMENT_CODE_RULE: InitialsCodeRule;
export declare const MASTER_SHORT_NAME_RULE: InitialsCodeRule;
export declare const EMPLOYEE_CODE_RULE: InitialsCodeRule;
export declare const DESIGNATION_CODE_MAX_LENGTH = 20;
export declare function initialsCode(name: string, rule: InitialsCodeRule): string | null;
export declare function wholeNameCode(name: string, maxLength: number): string | null;
export declare function firstFreeCode(base: string, taken: Iterable<string | null>): string;
export declare function nextFreeCode(base: string | null, takenStartingWith: (base: string) => Promise<ReadonlyArray<string | null>>): Promise<string | null>;
