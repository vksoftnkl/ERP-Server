import type { ModuleApiErrorDetail } from "../../../common/types/module-api.types";
import { SettlementErrorCode } from './types/tender-settlement-enum';
export type SettlementErrorDetail = ModuleApiErrorDetail & {
    code?: string;
    [key: string]: unknown;
};
export declare function throwSettlement(code: SettlementErrorCode, message: string, field: string, extra?: Record<string, unknown>): never;
export declare function throwSettlementDetails(code: SettlementErrorCode, message: string, details: SettlementErrorDetail[]): never;
