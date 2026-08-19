import type { Prisma } from '@prisma/client';
import type { ModuleApiErrorDetail, ModuleApiErrorResponse, ModuleApiSuccessResponse } from "../../../../common/types/module-api.types";
import type { ModuleListMeta } from "../../../../common/types/module-list.types";
import { ChargeApplyOn, ChargeCostAlloc, ChargeDocType, ChargeMethod, ChargeRole, ChargeType } from './charge-enum';
export { ChargeApplyOn, ChargeCostAlloc, ChargeDocType, ChargeMethod, ChargeRole, ChargeType, } from './charge-enum';
export type ChargeMasterErrorDetail = ModuleApiErrorDetail;
export type ChargeMasterErrorResponse = ModuleApiErrorResponse<ChargeMasterErrorDetail>;
export type ChargeMasterSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> = ModuleApiSuccessResponse<T, TMeta, TStyles>;
export type ChargeMasterListMeta = ModuleListMeta;
export declare const CHARGE_MODULES: readonly ["P", "S", "B"];
export declare const CHARGE_ROLES: ChargeRole[];
export declare const CHARGE_METHODS: ChargeMethod[];
export declare const CHARGE_TYPES: ChargeType[];
export declare const CHARGE_APPLY_ONS: ChargeApplyOn[];
export declare const CHARGE_COST_ALLOCS: ChargeCostAlloc[];
export declare const CHARGE_MODULE_LOOKUP: {
    readonly P: readonly ["P", "B"];
    readonly S: readonly ["S", "B"];
    readonly B: readonly ["B"];
};
export declare function resolveChargeModules(module: string): readonly string[];
export declare const CHARGE_UNIQUE_ROLES: readonly ["FREIGHT", "LOADING", "UNLOADING", "CASH_DISC", "OTHERS"];
export declare const CHARGE_VALUE_GUARDS: readonly [{
    readonly field: "chgModule";
    readonly allowed: readonly ["P", "S", "B"];
    readonly nullable: false;
}, {
    readonly field: "chgRole";
    readonly allowed: ChargeRole[];
    readonly nullable: true;
}, {
    readonly field: "chgMethod";
    readonly allowed: ChargeMethod[];
    readonly nullable: false;
}, {
    readonly field: "chgType";
    readonly allowed: ChargeType[];
    readonly nullable: false;
}, {
    readonly field: "chgApplyOn";
    readonly allowed: ChargeApplyOn[];
    readonly nullable: false;
}, {
    readonly field: "chgCostAlloc";
    readonly allowed: ChargeCostAlloc[];
    readonly nullable: true;
}];
export type ChargeGuardedField = (typeof CHARGE_VALUE_GUARDS)[number]['field'];
export type ChargeGuardedValues = Partial<Record<ChargeGuardedField, string | null | undefined>>;
export declare const CHARGE_DOC_TYPES: ChargeDocType[];
export declare const CHARGE_DETAIL_VALUE_GUARDS: readonly [{
    readonly field: "cdDocType";
    readonly allowed: ChargeDocType[];
    readonly nullable: false;
}, {
    readonly field: "cdRole";
    readonly allowed: ChargeRole[];
    readonly nullable: true;
}, {
    readonly field: "cdMethod";
    readonly allowed: ChargeMethod[];
    readonly nullable: true;
}, {
    readonly field: "cdType";
    readonly allowed: ChargeType[];
    readonly nullable: false;
}, {
    readonly field: "cdApplyOn";
    readonly allowed: ChargeApplyOn[];
    readonly nullable: true;
}, {
    readonly field: "cdCostAlloc";
    readonly allowed: ChargeCostAlloc[];
    readonly nullable: true;
}];
export type ChargeDetailGuardedField = (typeof CHARGE_DETAIL_VALUE_GUARDS)[number]['field'];
export type ChargeDetailGuardedValues = Partial<Record<ChargeDetailGuardedField, string | null | undefined>>;
export interface ChargeLedgerDetail {
    ledName: string;
    ledHsnSac: string | null;
    ledGstRate: Prisma.Decimal | null;
    ledTaxability: string | null;
}
export interface ChargeMasterPayload {
    chgId: string;
    chgName: string;
    chgCode: string | null;
    chgModule: string;
    chgRole: string | null;
    chgMethod: string;
    chgType: string;
    chgApplyOn: string;
    chgDefaultRate: number | null;
    chgLandingCost: boolean;
    chgCostAlloc: string | null;
    chgLedgerCode: string;
    chgLedgerName: string | null;
    ledHsnSac: string | null;
    ledGstRate: number | null;
    ledTaxability: string | null;
    chgTaxApl: boolean;
    chgBeforeTax: boolean;
    chgSepPost: boolean;
    chgManParty: boolean;
    chgDispOrder: number | null;
    chgAutoApply: boolean;
    chgIsActive: boolean;
    chgIsDeleted: boolean;
    chgSyncDate: string | null;
    chgCreatedOn: string;
    chgCreatedBy: string | null;
    chgModifiedOn: string | null;
    chgModifiedBy: string | null;
}
export type ChargeMasterListItem = ChargeMasterPayload | Record<string, unknown>;
export interface ChargeMasterDeleteResult {
    chgId: string;
    deleted: true;
}
