import type { ModuleApiSuccessResponse } from 'src/common/types/module-api.types';
export type MasterLookupSuccessResponse<TData> = ModuleApiSuccessResponse<TData, never, never>;

export interface NameIdOption {
  id: string;
  name: string;
  [key: string]: unknown;
}
export interface FiscalYearOption {
  id: string;
  name: string;
  beginDate: string | null;
  endDate: string | null;
  status: string;
  isCurrent: boolean;
}
/**
 * A freight-charge slab row (legacy `freight_charges`). `iflag = 8` returns all
 * active slabs; `iflag = 9` returns the slabs matching a given distance.
 */
export interface FreightChargeOption {
  id: string;
  fromKm: number | null;
  toKm: number | null;
  freightCharge: number | null;
  fromWeight: number | null;
  toWeight: number | null;
  loadCharge: number | null;
  unloadCharge: number | null;
}
/**
 * Flat customer-detail row — port of the legacy PL/pgSQL `iflag = 7` cursor onto
 * the current UUID schema. `salesman_id` is `cus_default_salesman` and
 * `salesman_name` is resolved by joining it to `employee_master` (emp_id).
 */
export interface CustomerDetail {
  cust_id: string;
  cust_name: string;
  cust_address: string | null;
  cust_place: string | null;
  cust_ename: string | null;
  cust_eadd1: string | null;
  cust_eadd2: string | null;
  cust_eadd3: string | null;
  cust_pin: string | null;
  ecommerce_gstin: string | null;
  gst_no: string | null;
  gst_type: string | null;
  state_code: string;
  state_name: string;
  area_id: string;
  area_name: string | null;
  distance_km: number | null;
  cust_phone1: string | null;
  debit_days: number;
  debit_limit: number;
  debit_allowed: boolean;
  freight_charge: boolean;
  cooly: boolean;
  unloading_charge: boolean;
  allow_promotion: boolean;
  allow_loyalty: boolean;
  allow_discount: boolean;
  overdue_billing: boolean;
  price_level: number;
  cust_disc_perc: number;
  salesman_id: string | null;
  salesman_name: string | null;
  tcs_company: boolean;
  tcs_customer: boolean;
  cust_pan: boolean;
  local_sales: boolean;
  cust_points: number | null;
  billed_date: string | null;
}
/**
 * Barcode-resolution row (legacy `iflag = 10`): a scanned EAN code resolved to
 * its item + selling unit, plus the sales-relevant flags the POS needs.
 * `itemStatus` is the legacy `item_status` (current `item_is_active`).
 */
export interface BarcodeItemLookup {
  itemId: string;
  unitId: string;
  itemName: string;
  batchConfig: number;
  allowSales: boolean;
  itemStatus: boolean;
  weighScale: boolean;
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
  userMasters: NameIdOption[];
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
  'userMasters',
] as const;
export const LOOKUP_MODULE_KEYS = [
  ...ACCOUNT_LOOKUP_MODULE_KEYS,
  ...MASTER_LOOKUP_MODULE_KEYS,
] as const;
export type AccountsLookupModuleKey = (typeof ACCOUNT_LOOKUP_MODULE_KEYS)[number];
export type MastersLookupModuleKey = (typeof MASTER_LOOKUP_MODULE_KEYS)[number];
export type LookupModuleKey = (typeof LOOKUP_MODULE_KEYS)[number];
export const LOOKUP_MODULE_ALIASES: Record<LookupModuleKey, readonly string[]> = {
  companies: [
    'companies',
    'company',
    'company master',
    'companies master',
    'companys',
    'companys master',
    'company-master',
  ],
  companyGroups: [
    'company groups',
    'company group',
    'company group master',
    'company groups master',
    'company-group-master',
    'company_group_master',
  ],
  branches: [
    'branches',
    'branch',
    'branch master',
    'branches master',
    'branches-master',
    'branch_master',
  ],
  accountGroups: [
    'account groups',
    'account group',
    'account group master',
    'accounts group',
    'accounts groups',
    'account ledger groups',
    'account ledger group',
    'account ledger groups master',
    'ledger groups',
    'ledger group',
    'account-ledger-groups-master',
    'account_groups',
  ],
  accountLedgers: [
    'account ledgers',
    'account ledger',
    'account ledger master',
    'ledgers',
    'ledger',
    'ledger master',
    'account-ledger-master',
    'acc_ledger_master',
  ],
  ledgerBankAccounts: [
    'ledger bank accounts',
    'ledger bank account',
    'ledger bank account master',
    'bank accounts',
    'bank account',
    'ledger-bank-account-master',
    'acc_ledger_bank_accounts',
  ],
  ledgerShippingAddresses: [
    'ledger shipping addresses',
    'ledger shipping address',
    'ledger shipping address master',
    'shipping addresses',
    'shipping address',
    'ledger-shipping-address-master',
    'acc_ship_addrs',
  ],
  employeeDepartments: [
    'employee departments',
    'employee department',
    'employee department master',
    'departments',
    'department',
    'employee-department-master',
    'employee_departments',
  ],
  employeeDesignations: [
    'employee designations',
    'employee designation',
    'employee designation master',
    'designations',
    'designation',
    'designation master',
    'employee-designation-master',
    'employee_designations',
  ],
  employees: ['employees', 'employee', 'employee master', 'employee-master', 'emp_master'],
  tenderTypes: [
    'tender types',
    'tender type',
    'tender type master',
    'gsp service',
    'gsp services',
    'gsp service master',
    'gsp-service-master',
    'tender_type_master',
  ],
  tenders: ['tenders', 'tender', 'tender master', 'tender-master', 'tender_master'],
  gspProviders: [
    'gsp providers',
    'gsp provider',
    'gsp provider master',
    'providers',
    'provider',
    'gsp-provider-master',
    'gsp_provider_master',
  ],
  gspCompanyServices: [
    'gsp company services',
    'gsp company service',
    'gsp company service master',
    'company services',
    'company service',
    'gsp-company-service',
    'gsp_company_service',
  ],
  itemGroups: [
    'item groups',
    'item group',
    'item group master',
    'groups',
    'group',
    'item-group-master',
    'item_group_master',
  ],
  itemCategories: [
    'item categories',
    'item category',
    'item category master',
    'categories',
    'category',
    'category master',
    'item-category-master',
    'item_category_master',
    'category_master',
  ],
  itemSections: [
    'item sections',
    'item section',
    'item section master',
    'sections',
    'section',
    'section master',
    'item-section-master',
    'item_section_master',
  ],
  itemBrands: [
    'item brands',
    'item brand',
    'item brand master',
    'brands',
    'brand',
    'brand master',
    'item-brand-master',
    'item_brand_master',
  ],
  units: [
    'units',
    'unit',
    'unit master',
    'units master',
    'uom',
    'uom master',
    'unit-master',
    'item_unit_master',
  ],
  itemTaxes: [
    'item taxes',
    'item tax',
    'item tax master',
    'taxes',
    'tax',
    'tax master',
    'tax-master',
    'item_tax_master',
  ],
  priceLevels: [
    'price levels',
    'price level',
    'price level master',
    'price-level-master',
    'price_levels',
  ],
  hsnCodes: [
    'hsn codes',
    'hsn code',
    'hsn',
    'hsn code master',
    'hscn code',
    'hscn code master',
    'hsn-code-master',
    'hsn_master',
  ],
  items: ['items', 'item', 'item master', 'item-master', 'item_master'],
  godownLocations: [
    'godown locations',
    'godown location',
    'godown location master',
    'godowns',
    'godown',
    'godown master',
    'godown-master',
    'godown_locations',
  ],
  stateCodes: [
    'state codes',
    'state code',
    'state code master',
    'state-code-master',
    'state_codes',
  ],
  states: ['states', 'state', 'state master', 'state-master', 'state_master'],
  cities: ['cities', 'city', 'city master', 'city-master', 'city_master'],
  areas: ['areas', 'area', 'area master', 'area-master', 'area_master'],
  customerGroups: [
    'customer groups',
    'customer group',
    'customer group master',
    'cust groups',
    'cust group',
    'customer-groups',
    'cust_groups',
  ],
  customers: ['customers', 'customer', 'customer master', 'customer-master'],
  supplierGroups: [
    'supplier groups',
    'supplier group',
    'supplier group master',
    'supplier-groups',
    'supplier_groups',
  ],
  suppliers: ['suppliers', 'supplier', 'suppliers master', 'supplier master', 'supplier-master'],
  userMasters: ['user masters', 'user master', 'users', 'user', 'user-master', 'user_master'],
} as const;
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
