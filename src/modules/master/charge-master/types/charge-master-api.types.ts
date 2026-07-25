import type { Prisma } from '@prisma/client';
import type {
  ModuleApiErrorDetail,
  ModuleApiErrorResponse,
  ModuleApiSuccessResponse,
} from 'src/common/types/module-api.types';
import type { ModuleListMeta } from 'src/common/types/module-list.types';
export type ChargeMasterErrorDetail = ModuleApiErrorDetail;
export type ChargeMasterErrorResponse = ModuleApiErrorResponse<ChargeMasterErrorDetail>;
export type ChargeMasterSuccessResponse<
  T,
  TMeta = Record<string, unknown>,
  TStyles = unknown,
> = ModuleApiSuccessResponse<T, TMeta, TStyles>;
export type ChargeMasterListMeta = ModuleListMeta;
// Allowed value sets for the enum-style charge_master columns. These used to be
// DB CHECK constraints (ck_chg_module / ck_chg_role / ck_chg_method /
// ck_chg_type / ck_chg_apply_on / ck_chg_cost_alloc), dropped in migration
// 20260724130000_drop_charge_master_check_constraints — the module is now the
// only place they are enforced.
export const CHARGE_MODULES = ['P', 'S', 'B'] as const;
export const CHARGE_ROLES = [
  'FREIGHT',
  'LOADING',
  'UNLOADING',
  'CASH_DISC',
  'OTHERS',
  'NONE',
] as const;
export const CHARGE_METHODS = ['FIXED', 'PERCENT'] as const;
export const CHARGE_TYPES = ['ADD', 'DEDUCT'] as const;
export const CHARGE_APPLY_ONS = ['FLAT', 'QTY', 'VALUE', 'WEIGHT'] as const;
export const CHARGE_COST_ALLOCS = ['VALUE', 'QTY', 'WEIGHT'] as const;
// A charge tagged B ("both") is shared by purchase and sales, so a lookup for
// either module has to pick it up as well; a lookup for B stays exact.
export const CHARGE_MODULE_LOOKUP = {
  P: ['P', 'B'],
  S: ['S', 'B'],
  B: ['B'],
} as const satisfies Record<(typeof CHARGE_MODULES)[number], readonly string[]>;
export function resolveChargeModules(module: string): readonly string[] {
  return CHARGE_MODULE_LOOKUP[module as keyof typeof CHARGE_MODULE_LOOKUP] ?? [module];
}
// Roles that are constrained one-per-module by the DB-only partial unique index
// uq_charge_role (generic NULL/NONE roles are unconstrained).
export const CHARGE_UNIQUE_ROLES = [
  'FREIGHT',
  'LOADING',
  'UNLOADING',
  'CASH_DISC',
  'OTHERS',
] as const;
// One entry per dropped CHECK constraint, in the order the columns are declared.
// `nullable` mirrors the `IS NULL OR ...` shape of ck_chg_role / ck_chg_cost_alloc.
export const CHARGE_VALUE_GUARDS = [
  { field: 'chgModule', allowed: CHARGE_MODULES, nullable: false },
  { field: 'chgRole', allowed: CHARGE_ROLES, nullable: true },
  { field: 'chgMethod', allowed: CHARGE_METHODS, nullable: false },
  { field: 'chgType', allowed: CHARGE_TYPES, nullable: false },
  { field: 'chgApplyOn', allowed: CHARGE_APPLY_ONS, nullable: false },
  { field: 'chgCostAlloc', allowed: CHARGE_COST_ALLOCS, nullable: true },
] as const satisfies ReadonlyArray<{
  field: string;
  allowed: readonly string[];
  nullable: boolean;
}>;
export type ChargeGuardedField = (typeof CHARGE_VALUE_GUARDS)[number]['field'];
// undefined = field absent from the request, so the stored value / column
// default stands and there is nothing to check.
export type ChargeGuardedValues = Partial<Record<ChargeGuardedField, string | null | undefined>>;
// Subset of acc_ledger_master selected alongside a charge so the payload can
// echo the mapped ledger's name and GST attributes.
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
  // Tax attributes echoed from the mapped acc_ledger_master row; derived
  // display values, never stored on charge_master itself.
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