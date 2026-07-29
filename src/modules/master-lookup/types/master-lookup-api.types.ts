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
 * Voucher-level loading mode. It decides where the item-price lookup resolves
 * `loading_charge` from:
 *  - `manual`     — nothing is resolved; the user types the charge in.
 *  - `item_basis` — the charge stored on the item's price row.
 *  - `auto`       — the weight slab in `sale_loading_charges`.
 */
export type LoadingType = 'manual' | 'item_basis' | 'auto';

/**
 * Voucher-level freight mode. It decides where the item-price lookup resolves
 * `freight_charge` from:
 *  - `manual`     — nothing is resolved; the user types the charge in.
 *  - `item_basis` — the charge stored on the item's price row.
 *
 * There is no `auto` counterpart to `LoadingType`'s: freight slabs
 * (`sale_freight_charges`) are matched on distance, which this lookup is never
 * given — `GET /freight-charges/charge?distance=` resolves those.
 */
export type FreightType = 'manual' | 'item_basis';

/**
 * A freight-charge slab row (`sale_freight_charges`). `iflag = 9` returns the
 * slabs matching a given distance. Loading/unloading charges are weight-slab
 * based and live separately in `sale_loading_charges`.
 */
export interface FreightChargeOption {
  id: string;
  fromKm: number | null;
  toKm: number | null;
  freightCharge: number | null;
  fromWeight: number | null;
  toWeight: number | null;
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
/**
 * Result of the unit-cycling refresh: the item asked about and the conversion
 * row (iuc_id) one step along its unit list. Nothing is priced here — the
 * screen re-reads /item-price itself with the returned iuc_id if it needs to.
 */
export interface ItemUnitCyclePayload {
  item_id: string;
  /** item_unit_conversion PK (iuc_id) of the next unit in the cycle. */
  iuc_id: string;
}
/**
 * Flat, fully-resolved sale-lookup row — the port of the legacy PL/pgSQL
 * `getItemForSale` cursor onto the current UUID schema. It resolves ONE item +
 * ONE unit rate (the pricing hub `item_price_master` row) into a single row
 * carrying the effective price, tax block, and stock.
 */
export interface ItemPriceLookupPayload {
  item_id: string;
  /**
   * item_unit_conversion PK (iuc_id) of the conversion the selected rate hangs
   * off — the item-scoped unit reference the entry screens carry.
   */
  item_uc_id: string;
  // NULL when the selected price row is not scoped to a godown.
  godown_id: string | null;
  godown_name: string;
  // Identity / naming
  item_code: string | null;
  /** Regional name (item_name_ta) when the `regional` flag is set, else the English name. */
  item_name: string;
  item_com_code: string | null;
  barcode: string | null;
  // Item flags
  allow_promo: boolean;
  add_freight: boolean;
  item_group_id: string;
  item_category_id: string | null;
  item_brand_id: string | null;
  item_section_id: string | null;
  weigh_scale: boolean;
  batch_config: number;
  service_item: 'Y' | 'N';
  allow_negative_stock: boolean;
  // Pricing (effective = selected price level − customer disc qty)
  /** Selected price column: 1=A, 2=B, 3=C, 4=D, 5=MRP/max, 6=min, 7=cost. */
  price_level: number;
  sales_price: number;
  cost_price: number;
  cost_wot: number;
  min_price: number;
  max_price: number;
  disc_perc: number;
  disc_qty: number;
  /** Legacy item-group price-level scheme discount — no equivalent column in the current schema, always null. */
  sch_discount: number | null;
  addl_cess: number;
  // Unit
  unit_name: string | null;
  /** item_unit_conversion.iuc_base_unit_id for the item + selected unit. */
  base_unit_id: string;
  /** item_unit_conversion.iuc_to_base_factor — qty in this unit × factor = qty in the base unit. */
  base_factor: number;
  /** item_unit_conversion.iuc_uom_weight for the item + selected unit. */
  iuc_uom_weight: number;
  decimal_count: number;
  // Loading charge — resolved server-side from `loading_type`. Both keys below
  // are present in all three modes; only the values differ.
  /** Resolved charge. NULL means "nothing to apply" — manual entry, an unset master value, or no matching slab. */
  loading_charge: number | null;
  /** Weight the slab was matched on — `auto` only, else null (manual / item_basis ignore weight). */
  resolved_weight: number | null;
  // Freight charge — resolved server-side from `freight_type`. Present in both
  // modes; only the value differs.
  /** Resolved charge (item_price_master.ipm_freight_charge). NULL means "nothing to apply" — manual entry or an unset master value. */
  freight_charge: number | null;
  // Loyalty
  loyalty_pv: number;
  // Stock (null when no accounting year supplied)
  stock: number | null;
  reorder_qty: number | null;
  // Tax — perc fields are zeroed when the company has GST disabled
  /**
   * item_master.item_incl_tax — whether the returned prices already carry tax.
   * The item's own flag, so unlike the perc fields it is NOT zeroed or flipped
   * when the company has GST disabled.
   */
  item_incl_tax: boolean;
  gst_rate: number;
  cess_perc: number;
  cess_unit: number;
  sgst_perc: number;
  cgst_perc: number;
  igst_perc: number;
  sales_ledger_id: string | null;
  sgst_output_ledger_id: string | null;
  cgst_output_ledger_id: string | null;
  igst_output_ledger_id: string | null;
  cess_output_ledger_id: string | null;
}
/**
 * A single unit option for an item, resolved from `item_unit_conversion` joined
 * to `item_unit_master`. `itemUnitId` is the conversion row PK (iuc_id) used by
 * downstream sale/quotation lines that reference the conversion, not the raw unit.
 */
export interface ItemUnitOption {
  /** item_unit_conversion PK (iuc_id) — the item-scoped unit reference. */
  itemUnitId: string;
  /** item_unit_master PK (unit_id) — the underlying unit. */
  unitId: string;
  /** Unit name from item_unit_master (unit_name). */
  unitName: string;
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