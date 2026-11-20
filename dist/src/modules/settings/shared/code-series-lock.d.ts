import type { SettingsWriteClient } from "../../../common/utils/module-service.utils";
export interface CodeSeries {
    readonly table: string;
    readonly column: string;
}
export declare const COMPANY_CODE_SERIES: CodeSeries;
export declare const DEPARTMENT_CODE_SERIES: CodeSeries;
export declare const DESIGNATION_CODE_SERIES: CodeSeries;
export declare const EMPLOYEE_CODE_SERIES: CodeSeries;
export declare const ITEM_GROUP_SHORT_SERIES: CodeSeries;
export declare const ITEM_BRAND_SHORT_SERIES: CodeSeries;
export declare const ITEM_SECTION_SHORT_SERIES: CodeSeries;
export declare const ITEM_CATEGORY_SHORT_SERIES: CodeSeries;
export declare const GODOWN_SHORT_SERIES: CodeSeries;
export declare function lockCodeSeries(tx: SettingsWriteClient, series: CodeSeries): Promise<void>;
