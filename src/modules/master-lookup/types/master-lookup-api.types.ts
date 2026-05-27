import type { ModuleApiSuccessResponse } from 'src/common/types/module-api.types';
export type MasterLookupSuccessResponse<TData> = ModuleApiSuccessResponse<TData, never, never>;

export interface NameIdOption {
  id: string;
  name: string;
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
