import { Prisma } from '@prisma/client';
import { NameIdOption } from './master-lookup-api.types';

/**
 * item_price_master.ipm_uc_unit_id is a FK to item_unit_conversion(iuc_id), not a
 * raw unit_id, so every price row is loaded with its conversion: iucUnitId is
 * the unit that stock, reorder and the response payload are keyed by.
 */
export type PriceRowWithUnit = Prisma.ItemPriceMasterGetPayload<{
  include: { itemUnitConversion: { include: { unit: true } } };
}>;

/**
 * One item_unit_conversion row reduced to the two ids a unit cycle steps over:
 * the conversion PK and the unit it maps. Both are matched against a requested
 * unit, since a caller may hold either.
 */
export type UnitCycleRow = {
  iucId: string;
  iucUnitId: string;
};

/**
 * One `sale_loading_charges` slab reduced to what the `auto` resolution ranks
 * and reads: its scope (for the branch/company specificity rule), its PK (for
 * traceability) and the flat charge. The weight range is not carried — the
 * query has already matched it.
 */
export type LoadingSlabRow = {
  ilcId: string;
  ilcCompId: string | null;
  ilcBranchId: string | null;
  ilcLoadChrg: Prisma.Decimal | null;
};

/** Fetches one module's options straight from its Prisma table. */
export type ModuleFetcher = () => Promise<NameIdOption[]>;

/** A single row of a configured dropdown's result set. */
export type LookupRow = Record<string, unknown>;

/** A visible column of a configured dropdown, as the lookup needs it. */
export type DropdownLookupColumnConfig = {
  name: string;
  alias: string | null;
  filter: boolean;
  visible: boolean;
};

/** A configured dropdown reduced to what the lookup runs and sorts by. */
export type DropdownLookupConfig = {
  dropdownId: number;
  dropdownName: string;
  dropdownSql: string;
  dropdownSqlRegional: string | null;
  dropdownSortColumn: string | null;
  dropdownSortOrder: string | null;
  dropdownColumns: DropdownLookupColumnConfig[];
};

/** The stored dropdown_details row (with its columns) this module reads. */
export type DropdownRecord = {
  dropdownId: number;
  dropdownName: string;
  dropdownSql: string;
  dropdownSqlRegional: string | null;
  dropdownSortColumn: string | null;
  dropdownSortOrder: string | null;
  dropdownColumns: Array<{
    dropdownColumnsNo: number;
    dropdownColumnsName: string;
    dropdownColumnsAlias: string | null;
    dropdownColumnsFilter: boolean;
    dropdownColumnsVisiblity: boolean;
  }>;
};
