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
// Value sets mirror the DB CHECK constraints on charge_master
// (see migration 20260724120000_create_charge_master).
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
// Roles that are constrained one-per-module by the DB-only partial unique index
// uq_charge_role (generic NULL/NONE roles are unconstrained).
export const CHARGE_UNIQUE_ROLES = [
  'FREIGHT',
  'LOADING',
  'UNLOADING',
  'CASH_DISC',
  'OTHERS',
] as const;
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