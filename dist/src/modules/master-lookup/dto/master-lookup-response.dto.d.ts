export declare class NameIdOptionDto {
    id: string;
    name: string;
}
export declare class AccountsLookupPayloadDto {
    companies: NameIdOptionDto[];
    companyGroups: NameIdOptionDto[];
    branches: NameIdOptionDto[];
    accountGroups: NameIdOptionDto[];
    accountLedgers: NameIdOptionDto[];
    ledgerBankAccounts: NameIdOptionDto[];
    ledgerShippingAddresses: NameIdOptionDto[];
    employeeDepartments: NameIdOptionDto[];
    employeeDesignations: NameIdOptionDto[];
    employees: NameIdOptionDto[];
    tenderTypes: NameIdOptionDto[];
    tenders: NameIdOptionDto[];
    gspProviders: NameIdOptionDto[];
    gspCompanyServices: NameIdOptionDto[];
}
export declare class MastersLookupPayloadDto {
    itemGroups: NameIdOptionDto[];
    itemCategories: NameIdOptionDto[];
    itemSections: NameIdOptionDto[];
    itemBrands: NameIdOptionDto[];
    units: NameIdOptionDto[];
    itemTaxes: NameIdOptionDto[];
    priceLevels: NameIdOptionDto[];
    hsnCodes: NameIdOptionDto[];
    items: NameIdOptionDto[];
    godownLocations: NameIdOptionDto[];
    stateCodes: NameIdOptionDto[];
    states: NameIdOptionDto[];
    cities: NameIdOptionDto[];
    areas: NameIdOptionDto[];
    customerGroups: NameIdOptionDto[];
    customers: NameIdOptionDto[];
    supplierGroups: NameIdOptionDto[];
    suppliers: NameIdOptionDto[];
    userMasters: NameIdOptionDto[];
}
export declare class MasterLookupPayloadDto {
    accounts: AccountsLookupPayloadDto;
    masters: MastersLookupPayloadDto;
}
export declare class MasterLookupSuccessDto {
    success: true;
    message: string;
    data: MasterLookupPayloadDto;
}
export declare class NameIdOptionListSuccessDto {
    success: true;
    message: string;
    data: NameIdOptionDto[];
}
export declare class FiscalYearOptionDto {
    id: string;
    name: string;
    beginDate: string | null;
    endDate: string | null;
    status: string;
    isCurrent: boolean;
}
export declare class FiscalYearOptionListSuccessDto {
    success: true;
    message: string;
    data: FiscalYearOptionDto[];
}
export declare class FreightChargeDto {
    id: string;
    fromKm: number | null;
    toKm: number | null;
    freightCharge: number | null;
    fromWeight: number | null;
    toWeight: number | null;
}
export declare class FreightChargeListSuccessDto {
    success: true;
    message: string;
    data: FreightChargeDto[];
}
export declare class BarcodeItemLookupDto {
    itemId: string;
    unitId: string;
    itemName: string;
    batchConfig: number;
    allowSales: boolean;
    itemStatus: boolean;
    weighScale: boolean;
}
export declare class BarcodeItemLookupSuccessDto {
    success: true;
    message: string;
    data: BarcodeItemLookupDto;
}
export declare class ItemUnitOptionDto {
    itemUnitId: string;
    unitId: string;
    unitName: string;
}
export declare class ItemUnitOptionListSuccessDto {
    success: true;
    message: string;
    data: ItemUnitOptionDto[];
}
export declare class CustomerDetailDto {
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
export declare class CustomerDetailSuccessDto {
    success: true;
    message: string;
    data: CustomerDetailDto;
}
export declare class ItemPriceLookupPayloadDto {
    item_id: string;
    item_uc_id: string;
    godown_id: string;
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
export declare class ItemPriceLookupSuccessDto {
    success: true;
    message: string;
    data: ItemPriceLookupPayloadDto;
}
export declare class ItemUnitCycleDto {
    item_id: string;
    iuc_id: string;
}
export declare class ItemUnitCycleSuccessDto {
    success: true;
    message: string;
    data: ItemUnitCycleDto;
}
export declare class DocumentNumberDto {
    orderId: string;
    companyId: string;
    branchId: string;
    accYear: string;
}
export declare class DocumentNumberSuccessDto {
    success: true;
    message: string;
    data: DocumentNumberDto;
}
