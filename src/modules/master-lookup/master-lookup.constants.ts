import { LoadingType, LookupModuleKey } from './types/master-lookup-api.types';

/**
 * Accepted `loading_type` values, in the order the 400 message lists them.
 * Omitting the param is `manual` — the mode that resolves nothing — so an
 * existing caller that never sent it keeps its old behaviour.
 */
export const LOADING_TYPES: readonly LoadingType[] = ['manual', 'item_basis', 'auto'];

/** `loading_type` a request without one is resolved as. */
export const DEFAULT_LOADING_TYPE: LoadingType = 'manual';

/** Quantity `auto` derives a weight with when the caller sends none. */
export const DEFAULT_LOADING_QTY = 1;

/** Dropped when normalizing a dropdown/module name, so "Item Master" ≡ "items". */
export const LOOKUP_NAME_NOISE_TOKENS = new Set(['master', 'lookup', 'dropdown']);

/**
 * Stored dropdown SQL still references tables under their pre-migration schema /
 * name. Each pattern rewrites one of those to the table that exists today.
 */
export const CONFIGURED_SQL_TABLE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\binventory\s*\.\s*units\b/gi, 'inventory.item_unit_master'],
  [/"inventory"\s*\.\s*"units"/gi, '"inventory"."item_unit_master"'],
  [/\baccounts\s*\.\s*companys\b/gi, 'public.companys'],
  [/"accounts"\s*\.\s*"companys"/gi, '"public"."companys"'],
  [/\baccounts\s*\.\s*branch_master\b/gi, 'public.branch_master'],
  [/"accounts"\s*\.\s*"branch_master"/gi, '"public"."branch_master"'],
];

/**
 * Names a configured dropdown record may carry for each module, on top of the
 * shared `LOOKUP_MODULE_ALIASES`. Matching is exact first, then normalized.
 */
export const MODULE_DROPDOWN_NAME_ALIASES: Record<LookupModuleKey, string[]> = {
  companies: ['companies', 'company'],
  companyGroups: ['company groups', 'company group'],
  branches: ['branches', 'branch'],
  accountGroups: ['account groups', 'account group', 'account ledger groups', 'ledger groups'],
  accountLedgers: ['account ledgers', 'account ledger', 'ledgers', 'ledger'],
  ledgerBankAccounts: [
    'ledger bank accounts',
    'ledger bank account',
    'bank accounts',
    'bank account',
  ],
  ledgerShippingAddresses: [
    'ledger shipping addresses',
    'ledger shipping address',
    'shipping addresses',
    'shipping address',
  ],
  employeeDepartments: ['employee departments', 'employee department', 'departments', 'department'],
  employeeDesignations: [
    'employee designations',
    'employee designation',
    'designations',
    'designation',
  ],
  employees: ['employees', 'employee'],
  tenderTypes: ['tender types', 'tender type'],
  tenders: ['tenders', 'tender'],
  gspProviders: ['gsp providers', 'gsp provider', 'providers', 'provider'],
  gspCompanyServices: [
    'gsp company services',
    'gsp company service',
    'company services',
    'company service',
  ],
  itemGroups: ['item groups', 'item group'],
  itemCategories: ['item categories', 'item category', 'categories', 'category'],
  itemSections: ['item sections', 'item section', 'sections', 'section'],
  itemBrands: ['item brands', 'item brand', 'brands', 'brand'],
  units: ['units', 'unit'],
  itemTaxes: ['item taxes', 'item tax', 'taxes', 'tax'],
  priceLevels: ['price levels', 'price level'],
  hsnCodes: ['hsn codes', 'hsn code', 'hsn'],
  items: ['items', 'item'],
  godownLocations: ['godown locations', 'godown location', 'godowns', 'godown'],
  stateCodes: ['state codes', 'state code'],
  states: ['states', 'state'],
  cities: ['cities', 'city'],
  areas: ['areas', 'area'],
  customerGroups: ['customer groups', 'customer group', 'cust groups', 'cust group'],
  customers: ['customers', 'customer'],
  supplierGroups: ['supplier groups', 'supplier group'],
  suppliers: ['suppliers', 'supplier'],
  userMasters: ['user masters', 'user master', 'users', 'user'],
};
