import type { ModuleApiSuccessResponse } from "../../../common/types/module-api.types";
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
export type LoadingType = 'manual' | 'item_basis' | 'auto';
export type FreightType = 'manual' | 'item_basis';
export interface FreightChargeOption {
    id: string;
    fromKm: number | null;
    toKm: number | null;
    freightCharge: number | null;
    fromWeight: number | null;
    toWeight: number | null;
}
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
export interface BarcodeItemLookup {
    itemId: string;
    unitId: string;
    itemName: string;
    batchConfig: number;
    allowSales: boolean;
    itemStatus: boolean;
    weighScale: boolean;
}
export interface ItemUnitCyclePayload {
    item_id: string;
    iuc_id: string;
}
export interface ItemPriceLookupPayload {
    item_id: string;
    item_uc_id: string;
    godown_id: string | null;
    godown_name: string;
    item_code: string | null;
    item_name: string;
    item_com_code: string | null;
    barcode: string | null;
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
    price_level: number;
    sales_price: number;
    cost_price: number;
    cost_wot: number;
    min_price: number;
    max_price: number;
    disc_perc: number;
    disc_qty: number;
    sch_discount: number | null;
    addl_cess: number;
    unit_name: string | null;
    base_unit_id: string;
    base_factor: number;
    iuc_uom_weight: number;
    decimal_count: number;
    loading_charge: number | null;
    resolved_weight: number | null;
    freight_charge: number | null;
    loyalty_pv: number;
    stock: number | null;
    reorder_qty: number | null;
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
export interface ItemUnitOption {
    itemUnitId: string;
    unitId: string;
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
    devices: NameIdOption[];
}
export declare const ACCOUNT_LOOKUP_MODULE_KEYS: readonly ["companies", "companyGroups", "branches", "accountGroups", "accountLedgers", "ledgerBankAccounts", "ledgerShippingAddresses", "employeeDepartments", "employeeDesignations", "employees", "tenderTypes", "tenders", "gspProviders", "gspCompanyServices"];
export declare const MASTER_LOOKUP_MODULE_KEYS: readonly ["itemGroups", "itemCategories", "itemSections", "itemBrands", "units", "itemTaxes", "priceLevels", "hsnCodes", "items", "godownLocations", "stateCodes", "states", "cities", "areas", "customerGroups", "customers", "supplierGroups", "suppliers", "userMasters", "devices"];
export declare const LOOKUP_MODULE_KEYS: readonly ["companies", "companyGroups", "branches", "accountGroups", "accountLedgers", "ledgerBankAccounts", "ledgerShippingAddresses", "employeeDepartments", "employeeDesignations", "employees", "tenderTypes", "tenders", "gspProviders", "gspCompanyServices", "itemGroups", "itemCategories", "itemSections", "itemBrands", "units", "itemTaxes", "priceLevels", "hsnCodes", "items", "godownLocations", "stateCodes", "states", "cities", "areas", "customerGroups", "customers", "supplierGroups", "suppliers", "userMasters", "devices"];
export type AccountsLookupModuleKey = (typeof ACCOUNT_LOOKUP_MODULE_KEYS)[number];
export type MastersLookupModuleKey = (typeof MASTER_LOOKUP_MODULE_KEYS)[number];
export type LookupModuleKey = (typeof LOOKUP_MODULE_KEYS)[number];
export declare const DOCUMENT_LOOKUP_MODULE_KEYS: readonly ["saleBill", "saleOrder", "saleQuotation"];
export type DocumentLookupModuleKey = (typeof DOCUMENT_LOOKUP_MODULE_KEYS)[number];
export declare const DOCUMENT_LOOKUP_MODULE_ALIASES: Record<DocumentLookupModuleKey, readonly string[]>;
export interface DocumentNumberPayload {
    orderId: string;
    companyId: string;
    branchId: string;
    accYear: string;
}
export declare const LOOKUP_MODULE_ALIASES: Record<LookupModuleKey, readonly string[]>;
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
