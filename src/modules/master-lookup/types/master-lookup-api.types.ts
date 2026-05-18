import type { ModuleApiSuccessResponse } from 'src/common/types/module-api.types';
export type MasterLookupSuccessResponse<TData> = ModuleApiSuccessResponse<TData, never, never>;

export interface NameIdOption {
  id: string;
  name: string;
  [key: string]: string | number | boolean | null | undefined;
}
export interface AccountsLookupPayload {
  companies: NameIdOption[];
  companyGroups: NameIdOption[];
  branches: NameIdOption[];
  accountGroups: NameIdOption[];
  accountLedgers: NameIdOption[];
  ledgerBankAccounts: NameIdOption[];
  ledgerShippingAddresses: NameIdOption[];
  employeeDepartments: NameIdOption[];
  employeeDesignations: NameIdOption[];
  employees: NameIdOption[];
  tenderTypes: NameIdOption[];
  tenders: NameIdOption[];
  gspProviders: NameIdOption[];
  gspCompanyServices: NameIdOption[];
}
export interface MastersLookupPayload {
  itemGroups: NameIdOption[];
  itemCategories: NameIdOption[];
  itemSections: NameIdOption[];
  itemBrands: NameIdOption[];
  units: NameIdOption[];
  itemTaxes: NameIdOption[];
  priceLevels: NameIdOption[];
  hsnCodes: NameIdOption[];
  items: NameIdOption[];
  godownLocations: NameIdOption[];
  stateCodes: NameIdOption[];
  states: NameIdOption[];
  cities: NameIdOption[];
  areas: NameIdOption[];
  customerGroups: NameIdOption[];
  customers: NameIdOption[];
  supplierGroups: NameIdOption[];
  suppliers: NameIdOption[];
}
export const ACCOUNT_LOOKUP_MODULE_KEYS = [
  'companies',
  'companyGroups',
  'branches',
  'accountGroups',
  'accountLedgers',
  'ledgerBankAccounts',
  'ledgerShippingAddresses',
  'employeeDepartments',
  'employeeDesignations',
  'employees',
  'tenderTypes',
  'tenders',
  'gspProviders',
  'gspCompanyServices',
] as const;
export const MASTER_LOOKUP_MODULE_KEYS = [
  'itemGroups',
  'itemCategories',
  'itemSections',
  'itemBrands',
  'units',
  'itemTaxes',
  'priceLevels',
  'hsnCodes',
  'items',
  'godownLocations',
  'stateCodes',
  'states',
  'cities',
  'areas',
  'customerGroups',
  'customers',
  'supplierGroups',
  'suppliers',
] as const;
export const LOOKUP_MODULE_KEYS = [
  ...ACCOUNT_LOOKUP_MODULE_KEYS,
  ...MASTER_LOOKUP_MODULE_KEYS,
] as const;
export type AccountsLookupModuleKey = (typeof ACCOUNT_LOOKUP_MODULE_KEYS)[number];
export type MastersLookupModuleKey = (typeof MASTER_LOOKUP_MODULE_KEYS)[number];
export type LookupModuleKey = (typeof LOOKUP_MODULE_KEYS)[number];
export interface MasterLookupPayload {
  accounts: AccountsLookupPayload;
  masters: MastersLookupPayload;
}
export interface SingleModuleLookupPayload {
  scope: 'accounts' | 'masters';
  module: LookupModuleKey;
  items: NameIdOption[];
}
export type MasterLookupDataPayload = MasterLookupPayload | SingleModuleLookupPayload;
