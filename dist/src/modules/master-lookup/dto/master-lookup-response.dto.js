"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentNumberSuccessDto = exports.DocumentNumberDto = exports.ItemUnitCycleSuccessDto = exports.ItemUnitCycleDto = exports.ItemPriceLookupSuccessDto = exports.ItemPriceLookupPayloadDto = exports.CustomerDetailSuccessDto = exports.CustomerDetailDto = exports.ItemUnitOptionListSuccessDto = exports.ItemUnitOptionDto = exports.BarcodeItemLookupSuccessDto = exports.BarcodeItemLookupDto = exports.FreightChargeListSuccessDto = exports.FreightChargeDto = exports.FiscalYearOptionListSuccessDto = exports.FiscalYearOptionDto = exports.NameIdOptionListSuccessDto = exports.MasterLookupSuccessDto = exports.MasterLookupPayloadDto = exports.MastersLookupPayloadDto = exports.AccountsLookupPayloadDto = exports.NameIdOptionDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class NameIdOptionDto {
    id;
    name;
}
exports.NameIdOptionDto = NameIdOptionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], NameIdOptionDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Cash' }),
    __metadata("design:type", String)
], NameIdOptionDto.prototype, "name", void 0);
class AccountsLookupPayloadDto {
    companies;
    companyGroups;
    branches;
    accountGroups;
    accountLedgers;
    ledgerBankAccounts;
    ledgerShippingAddresses;
    employeeDepartments;
    employeeDesignations;
    employees;
    tenderTypes;
    tenders;
    gspProviders;
    gspCompanyServices;
}
exports.AccountsLookupPayloadDto = AccountsLookupPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], AccountsLookupPayloadDto.prototype, "companies", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], AccountsLookupPayloadDto.prototype, "companyGroups", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], AccountsLookupPayloadDto.prototype, "branches", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], AccountsLookupPayloadDto.prototype, "accountGroups", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], AccountsLookupPayloadDto.prototype, "accountLedgers", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], AccountsLookupPayloadDto.prototype, "ledgerBankAccounts", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], AccountsLookupPayloadDto.prototype, "ledgerShippingAddresses", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], AccountsLookupPayloadDto.prototype, "employeeDepartments", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], AccountsLookupPayloadDto.prototype, "employeeDesignations", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], AccountsLookupPayloadDto.prototype, "employees", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], AccountsLookupPayloadDto.prototype, "tenderTypes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], AccountsLookupPayloadDto.prototype, "tenders", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], AccountsLookupPayloadDto.prototype, "gspProviders", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], AccountsLookupPayloadDto.prototype, "gspCompanyServices", void 0);
class MastersLookupPayloadDto {
    itemGroups;
    itemCategories;
    itemSections;
    itemBrands;
    units;
    itemTaxes;
    priceLevels;
    hsnCodes;
    items;
    godownLocations;
    stateCodes;
    states;
    cities;
    areas;
    customerGroups;
    customers;
    supplierGroups;
    suppliers;
    userMasters;
    devices;
}
exports.MastersLookupPayloadDto = MastersLookupPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], MastersLookupPayloadDto.prototype, "itemGroups", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], MastersLookupPayloadDto.prototype, "itemCategories", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], MastersLookupPayloadDto.prototype, "itemSections", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], MastersLookupPayloadDto.prototype, "itemBrands", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], MastersLookupPayloadDto.prototype, "units", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], MastersLookupPayloadDto.prototype, "itemTaxes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], MastersLookupPayloadDto.prototype, "priceLevels", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], MastersLookupPayloadDto.prototype, "hsnCodes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], MastersLookupPayloadDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], MastersLookupPayloadDto.prototype, "godownLocations", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], MastersLookupPayloadDto.prototype, "stateCodes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], MastersLookupPayloadDto.prototype, "states", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], MastersLookupPayloadDto.prototype, "cities", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], MastersLookupPayloadDto.prototype, "areas", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], MastersLookupPayloadDto.prototype, "customerGroups", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], MastersLookupPayloadDto.prototype, "customers", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], MastersLookupPayloadDto.prototype, "supplierGroups", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], MastersLookupPayloadDto.prototype, "suppliers", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], MastersLookupPayloadDto.prototype, "userMasters", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], MastersLookupPayloadDto.prototype, "devices", void 0);
class MasterLookupPayloadDto {
    accounts;
    masters;
}
exports.MasterLookupPayloadDto = MasterLookupPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: AccountsLookupPayloadDto }),
    __metadata("design:type", AccountsLookupPayloadDto)
], MasterLookupPayloadDto.prototype, "accounts", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MastersLookupPayloadDto }),
    __metadata("design:type", MastersLookupPayloadDto)
], MasterLookupPayloadDto.prototype, "masters", void 0);
class MasterLookupSuccessDto {
    success;
    message;
    data;
}
exports.MasterLookupSuccessDto = MasterLookupSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], MasterLookupSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Name-id data fetched successfully' }),
    __metadata("design:type", String)
], MasterLookupSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: MasterLookupPayloadDto }),
    __metadata("design:type", MasterLookupPayloadDto)
], MasterLookupSuccessDto.prototype, "data", void 0);
class NameIdOptionListSuccessDto {
    success;
    message;
    data;
}
exports.NameIdOptionListSuccessDto = NameIdOptionListSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], NameIdOptionListSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Data fetched successfully' }),
    __metadata("design:type", String)
], NameIdOptionListSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: NameIdOptionDto, isArray: true }),
    __metadata("design:type", Array)
], NameIdOptionListSuccessDto.prototype, "data", void 0);
class FiscalYearOptionDto {
    id;
    name;
    beginDate;
    endDate;
    status;
    isCurrent;
}
exports.FiscalYearOptionDto = FiscalYearOptionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], FiscalYearOptionDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2025-2026' }),
    __metadata("design:type", String)
], FiscalYearOptionDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2025-04-01', nullable: true }),
    __metadata("design:type", Object)
], FiscalYearOptionDto.prototype, "beginDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-03-31', nullable: true }),
    __metadata("design:type", Object)
], FiscalYearOptionDto.prototype, "endDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'OPEN' }),
    __metadata("design:type", String)
], FiscalYearOptionDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], FiscalYearOptionDto.prototype, "isCurrent", void 0);
class FiscalYearOptionListSuccessDto {
    success;
    message;
    data;
}
exports.FiscalYearOptionListSuccessDto = FiscalYearOptionListSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], FiscalYearOptionListSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Fiscal years fetched for company' }),
    __metadata("design:type", String)
], FiscalYearOptionListSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: FiscalYearOptionDto, isArray: true }),
    __metadata("design:type", Array)
], FiscalYearOptionListSuccessDto.prototype, "data", void 0);
class FreightChargeDto {
    id;
    fromKm;
    toKm;
    freightCharge;
    fromWeight;
    toWeight;
}
exports.FreightChargeDto = FreightChargeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], FreightChargeDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 0, description: 'Slab start distance (km)' }),
    __metadata("design:type", Object)
], FreightChargeDto.prototype, "fromKm", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 50, description: 'Slab end distance (km)' }),
    __metadata("design:type", Object)
], FreightChargeDto.prototype, "toKm", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 250, description: 'Freight charge for the slab' }),
    __metadata("design:type", Object)
], FreightChargeDto.prototype, "freightCharge", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 0, description: 'Slab start weight' }),
    __metadata("design:type", Object)
], FreightChargeDto.prototype, "fromWeight", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 100, description: 'Slab end weight' }),
    __metadata("design:type", Object)
], FreightChargeDto.prototype, "toWeight", void 0);
class FreightChargeListSuccessDto {
    success;
    message;
    data;
}
exports.FreightChargeListSuccessDto = FreightChargeListSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], FreightChargeListSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Freight charges fetched successfully' }),
    __metadata("design:type", String)
], FreightChargeListSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: FreightChargeDto, isArray: true }),
    __metadata("design:type", Array)
], FreightChargeListSuccessDto.prototype, "data", void 0);
class BarcodeItemLookupDto {
    itemId;
    unitId;
    itemName;
    batchConfig;
    allowSales;
    itemStatus;
    weighScale;
}
exports.BarcodeItemLookupDto = BarcodeItemLookupDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Resolved item id' }),
    __metadata("design:type", String)
], BarcodeItemLookupDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'Selling unit id from the EAN code' }),
    __metadata("design:type", String)
], BarcodeItemLookupDto.prototype, "unitId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Sugar 1kg' }),
    __metadata("design:type", String)
], BarcodeItemLookupDto.prototype, "itemName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0, description: 'Legacy item batch_config' }),
    __metadata("design:type", Number)
], BarcodeItemLookupDto.prototype, "batchConfig", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true, description: 'Legacy item allow_sales' }),
    __metadata("design:type", Boolean)
], BarcodeItemLookupDto.prototype, "allowSales", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true, description: 'Legacy item_status (item_is_active)' }),
    __metadata("design:type", Boolean)
], BarcodeItemLookupDto.prototype, "itemStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false, description: 'Legacy weigh_scale flag' }),
    __metadata("design:type", Boolean)
], BarcodeItemLookupDto.prototype, "weighScale", void 0);
class BarcodeItemLookupSuccessDto {
    success;
    message;
    data;
}
exports.BarcodeItemLookupSuccessDto = BarcodeItemLookupSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], BarcodeItemLookupSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item fetched successfully for barcode' }),
    __metadata("design:type", String)
], BarcodeItemLookupSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: BarcodeItemLookupDto }),
    __metadata("design:type", BarcodeItemLookupDto)
], BarcodeItemLookupSuccessDto.prototype, "data", void 0);
class ItemUnitOptionDto {
    itemUnitId;
    unitId;
    unitName;
}
exports.ItemUnitOptionDto = ItemUnitOptionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'item_unit_conversion PK (iuc_id)' }),
    __metadata("design:type", String)
], ItemUnitOptionDto.prototype, "itemUnitId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'item_unit_master PK (unit_id)' }),
    __metadata("design:type", String)
], ItemUnitOptionDto.prototype, "unitId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'PCS', description: 'Unit name (unit_name)' }),
    __metadata("design:type", String)
], ItemUnitOptionDto.prototype, "unitName", void 0);
class ItemUnitOptionListSuccessDto {
    success;
    message;
    data;
}
exports.ItemUnitOptionListSuccessDto = ItemUnitOptionListSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemUnitOptionListSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Units fetched successfully for item' }),
    __metadata("design:type", String)
], ItemUnitOptionListSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [ItemUnitOptionDto] }),
    __metadata("design:type", Array)
], ItemUnitOptionListSuccessDto.prototype, "data", void 0);
class CustomerDetailDto {
    cust_id;
    cust_name;
    cust_address;
    cust_place;
    cust_ename;
    cust_eadd1;
    cust_eadd2;
    cust_eadd3;
    cust_pin;
    ecommerce_gstin;
    gst_no;
    gst_type;
    state_code;
    state_name;
    area_id;
    area_name;
    distance_km;
    cust_phone1;
    debit_days;
    debit_limit;
    debit_allowed;
    freight_charge;
    cooly;
    unloading_charge;
    allow_promotion;
    allow_loyalty;
    allow_discount;
    overdue_billing;
    price_level;
    cust_disc_perc;
    salesman_id;
    salesman_name;
    tcs_company;
    tcs_customer;
    cust_pan;
    local_sales;
    cust_points;
    billed_date;
}
exports.CustomerDetailDto = CustomerDetailDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], CustomerDetailDto.prototype, "cust_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Ramesh Traders' }),
    __metadata("design:type", String)
], CustomerDetailDto.prototype, "cust_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], CustomerDetailDto.prototype, "cust_address", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], CustomerDetailDto.prototype, "cust_place", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], CustomerDetailDto.prototype, "cust_ename", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], CustomerDetailDto.prototype, "cust_eadd1", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], CustomerDetailDto.prototype, "cust_eadd2", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], CustomerDetailDto.prototype, "cust_eadd3", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], CustomerDetailDto.prototype, "cust_pin", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], CustomerDetailDto.prototype, "ecommerce_gstin", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], CustomerDetailDto.prototype, "gst_no", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], CustomerDetailDto.prototype, "gst_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '33' }),
    __metadata("design:type", String)
], CustomerDetailDto.prototype, "state_code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Tamil Nadu' }),
    __metadata("design:type", String)
], CustomerDetailDto.prototype, "state_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], CustomerDetailDto.prototype, "area_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'Gandhipuram' }),
    __metadata("design:type", Object)
], CustomerDetailDto.prototype, "area_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 12 }),
    __metadata("design:type", Object)
], CustomerDetailDto.prototype, "distance_km", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], CustomerDetailDto.prototype, "cust_phone1", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 30 }),
    __metadata("design:type", Number)
], CustomerDetailDto.prototype, "debit_days", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 50000 }),
    __metadata("design:type", Number)
], CustomerDetailDto.prototype, "debit_limit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], CustomerDetailDto.prototype, "debit_allowed", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], CustomerDetailDto.prototype, "freight_charge", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false, description: 'Loading (coolie) charge flag' }),
    __metadata("design:type", Boolean)
], CustomerDetailDto.prototype, "cooly", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], CustomerDetailDto.prototype, "unloading_charge", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], CustomerDetailDto.prototype, "allow_promotion", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], CustomerDetailDto.prototype, "allow_loyalty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], CustomerDetailDto.prototype, "allow_discount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], CustomerDetailDto.prototype, "overdue_billing", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], CustomerDetailDto.prototype, "price_level", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], CustomerDetailDto.prototype, "cust_disc_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], CustomerDetailDto.prototype, "salesman_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 'Suresh Kumar' }),
    __metadata("design:type", Object)
], CustomerDetailDto.prototype, "salesman_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], CustomerDetailDto.prototype, "tcs_company", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: false }),
    __metadata("design:type", Boolean)
], CustomerDetailDto.prototype, "tcs_customer", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], CustomerDetailDto.prototype, "cust_pan", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true, description: 'True when customer and company share a state code' }),
    __metadata("design:type", Boolean)
], CustomerDetailDto.prototype, "local_sales", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: null, description: 'Loyalty points (not modelled yet)' }),
    __metadata("design:type", Object)
], CustomerDetailDto.prototype, "cust_points", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: '10 days : 01/07/26' }),
    __metadata("design:type", Object)
], CustomerDetailDto.prototype, "billed_date", void 0);
class CustomerDetailSuccessDto {
    success;
    message;
    data;
}
exports.CustomerDetailSuccessDto = CustomerDetailSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], CustomerDetailSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Customer detail fetched successfully' }),
    __metadata("design:type", String)
], CustomerDetailSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: CustomerDetailDto }),
    __metadata("design:type", CustomerDetailDto)
], CustomerDetailSuccessDto.prototype, "data", void 0);
class ItemPriceLookupPayloadDto {
    item_id;
    item_uc_id;
    godown_id;
    godown_name;
    item_code;
    item_name;
    item_com_code;
    barcode;
    allow_promo;
    add_freight;
    item_group_id;
    item_category_id;
    item_brand_id;
    item_section_id;
    weigh_scale;
    batch_config;
    service_item;
    allow_negative_stock;
    price_level;
    sales_price;
    cost_price;
    cost_wot;
    min_price;
    max_price;
    disc_perc;
    disc_qty;
    sch_discount;
    addl_cess;
    unit_name;
    base_unit_id;
    base_factor;
    iuc_uom_weight;
    decimal_count;
    loading_charge;
    resolved_weight;
    freight_charge;
    loyalty_pv;
    stock;
    reorder_qty;
    item_incl_tax;
    gst_rate;
    cess_perc;
    cess_unit;
    sgst_perc;
    cgst_perc;
    igst_perc;
    sales_ledger_id;
    sgst_output_ledger_id;
    cgst_output_ledger_id;
    igst_output_ledger_id;
    cess_output_ledger_id;
}
exports.ItemPriceLookupPayloadDto = ItemPriceLookupPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemPriceLookupPayloadDto.prototype, "item_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'item_unit_conversion PK (iuc_id) the selected rate hangs off',
    }),
    __metadata("design:type", String)
], ItemPriceLookupPayloadDto.prototype, "item_uc_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemPriceLookupPayloadDto.prototype, "godown_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ItemPriceLookupPayloadDto.prototype, "godown_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ItemPriceLookupPayloadDto.prototype, "item_code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Regional name (item_name_ta) when regional=true, else the English name.' }),
    __metadata("design:type", String)
], ItemPriceLookupPayloadDto.prototype, "item_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ItemPriceLookupPayloadDto.prototype, "item_com_code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ItemPriceLookupPayloadDto.prototype, "barcode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPriceLookupPayloadDto.prototype, "allow_promo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPriceLookupPayloadDto.prototype, "add_freight", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemPriceLookupPayloadDto.prototype, "item_group_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemPriceLookupPayloadDto.prototype, "item_category_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemPriceLookupPayloadDto.prototype, "item_brand_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemPriceLookupPayloadDto.prototype, "item_section_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPriceLookupPayloadDto.prototype, "weigh_scale", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPriceLookupPayloadDto.prototype, "batch_config", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['Y', 'N'] }),
    __metadata("design:type", String)
], ItemPriceLookupPayloadDto.prototype, "service_item", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ItemPriceLookupPayloadDto.prototype, "allow_negative_stock", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: [1, 2, 3, 4, 5, 6, 7],
        description: '1=A, 2=B, 3=C, 4=D, 5=MRP/max, 6=min, 7=cost',
    }),
    __metadata("design:type", Number)
], ItemPriceLookupPayloadDto.prototype, "price_level", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 100.5 }),
    __metadata("design:type", Number)
], ItemPriceLookupPayloadDto.prototype, "sales_price", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 80 }),
    __metadata("design:type", Number)
], ItemPriceLookupPayloadDto.prototype, "cost_price", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 78 }),
    __metadata("design:type", Number)
], ItemPriceLookupPayloadDto.prototype, "cost_wot", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 90 }),
    __metadata("design:type", Number)
], ItemPriceLookupPayloadDto.prototype, "min_price", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 120 }),
    __metadata("design:type", Number)
], ItemPriceLookupPayloadDto.prototype, "max_price", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPriceLookupPayloadDto.prototype, "disc_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPriceLookupPayloadDto.prototype, "disc_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, description: 'Legacy group scheme discount — no column in current schema, always null' }),
    __metadata("design:type", Object)
], ItemPriceLookupPayloadDto.prototype, "sch_discount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPriceLookupPayloadDto.prototype, "addl_cess", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true }),
    __metadata("design:type", Object)
], ItemPriceLookupPayloadDto.prototype, "unit_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'Base unit of the item + selected unit conversion row.',
    }),
    __metadata("design:type", String)
], ItemPriceLookupPayloadDto.prototype, "base_unit_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 1,
        description: 'To-base factor: qty in the selected unit × base_factor = qty in the base unit.',
    }),
    __metadata("design:type", Number)
], ItemPriceLookupPayloadDto.prototype, "base_factor", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 0,
        description: 'UOM weight of the item + selected unit conversion row.',
    }),
    __metadata("design:type", Number)
], ItemPriceLookupPayloadDto.prototype, "iuc_uom_weight", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2 }),
    __metadata("design:type", Number)
], ItemPriceLookupPayloadDto.prototype, "decimal_count", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 250,
        nullable: true,
        description: 'Resolved loading charge. Null means nothing was resolved — manual entry, an unset item master value, or no slab covering the weight. Never 0-as-unknown.',
    }),
    __metadata("design:type", Object)
], ItemPriceLookupPayloadDto.prototype, "loading_charge", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 145.5,
        nullable: true,
        description: "Weight the slab was matched on — the selected unit's iuc_uom_weight. Null for manual and item_basis, which ignore weight.",
    }),
    __metadata("design:type", Object)
], ItemPriceLookupPayloadDto.prototype, "resolved_weight", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 120,
        nullable: true,
        description: 'Resolved freight charge (item_price_master.ipm_freight_charge). Null means nothing was resolved — manual entry or an unset item master value. Never 0-as-unknown.',
    }),
    __metadata("design:type", Object)
], ItemPriceLookupPayloadDto.prototype, "freight_charge", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPriceLookupPayloadDto.prototype, "loyalty_pv", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 0 }),
    __metadata("design:type", Object)
], ItemPriceLookupPayloadDto.prototype, "stock", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ nullable: true, example: 0 }),
    __metadata("design:type", Object)
], ItemPriceLookupPayloadDto.prototype, "reorder_qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: true,
        description: "Item's own item_incl_tax flag — whether the returned prices are tax-inclusive. Not affected by the company GST toggle.",
    }),
    __metadata("design:type", Boolean)
], ItemPriceLookupPayloadDto.prototype, "item_incl_tax", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPriceLookupPayloadDto.prototype, "gst_rate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPriceLookupPayloadDto.prototype, "cess_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPriceLookupPayloadDto.prototype, "cess_unit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPriceLookupPayloadDto.prototype, "sgst_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPriceLookupPayloadDto.prototype, "cgst_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    __metadata("design:type", Number)
], ItemPriceLookupPayloadDto.prototype, "igst_perc", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemPriceLookupPayloadDto.prototype, "sales_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemPriceLookupPayloadDto.prototype, "sgst_output_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemPriceLookupPayloadDto.prototype, "cgst_output_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemPriceLookupPayloadDto.prototype, "igst_output_ledger_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ItemPriceLookupPayloadDto.prototype, "cess_output_ledger_id", void 0);
class ItemPriceLookupSuccessDto {
    success;
    message;
    data;
}
exports.ItemPriceLookupSuccessDto = ItemPriceLookupSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemPriceLookupSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Item price lookup fetched successfully' }),
    __metadata("design:type", String)
], ItemPriceLookupSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemPriceLookupPayloadDto }),
    __metadata("design:type", ItemPriceLookupPayloadDto)
], ItemPriceLookupSuccessDto.prototype, "data", void 0);
class ItemUnitCycleDto {
    item_id;
    iuc_id;
}
exports.ItemUnitCycleDto = ItemUnitCycleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], ItemUnitCycleDto.prototype, "item_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: "item_unit_conversion PK (iuc_id) of the next unit in the item's cycle",
    }),
    __metadata("design:type", String)
], ItemUnitCycleDto.prototype, "iuc_id", void 0);
class ItemUnitCycleSuccessDto {
    success;
    message;
    data;
}
exports.ItemUnitCycleSuccessDto = ItemUnitCycleSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], ItemUnitCycleSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Next item unit fetched successfully' }),
    __metadata("design:type", String)
], ItemUnitCycleSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: ItemUnitCycleDto }),
    __metadata("design:type", ItemUnitCycleDto)
], ItemUnitCycleSuccessDto.prototype, "data", void 0);
class DocumentNumberDto {
    orderId;
    companyId;
    branchId;
    accYear;
}
exports.DocumentNumberDto = DocumentNumberDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'The document row id — sb_id / so_id / sq_id',
    }),
    __metadata("design:type", String)
], DocumentNumberDto.prototype, "orderId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], DocumentNumberDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], DocumentNumberDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2025-2026',
        description: 'The accounting year the document lives in. Together with orderId it is the primary key of the partitioned table.',
    }),
    __metadata("design:type", String)
], DocumentNumberDto.prototype, "accYear", void 0);
class DocumentNumberSuccessDto {
    success;
    message;
    data;
}
exports.DocumentNumberSuccessDto = DocumentNumberSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], DocumentNumberSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Document fetched successfully' }),
    __metadata("design:type", String)
], DocumentNumberSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: DocumentNumberDto }),
    __metadata("design:type", DocumentNumberDto)
], DocumentNumberSuccessDto.prototype, "data", void 0);
//# sourceMappingURL=master-lookup-response.dto.js.map