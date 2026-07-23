import { ApiProperty } from '@nestjs/swagger';
export class NameIdOptionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ example: 'Cash' })
  name!: string;
}
export class AccountsLookupPayloadDto {
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  companies!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  companyGroups!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  branches!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  accountGroups!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  accountLedgers!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  ledgerBankAccounts!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  ledgerShippingAddresses!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  employeeDepartments!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  employeeDesignations!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  employees!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  tenderTypes!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  tenders!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  gspProviders!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  gspCompanyServices!: NameIdOptionDto[];
}
export class MastersLookupPayloadDto {
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  itemGroups!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  itemCategories!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  itemSections!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  itemBrands!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  units!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  itemTaxes!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  priceLevels!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  hsnCodes!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  items!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  godownLocations!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  stateCodes!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  states!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  cities!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  areas!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  customerGroups!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  customers!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  supplierGroups!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  suppliers!: NameIdOptionDto[];
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  userMasters!: NameIdOptionDto[];
}
export class MasterLookupPayloadDto {
  @ApiProperty({ type: AccountsLookupPayloadDto })
  accounts!: AccountsLookupPayloadDto;
  @ApiProperty({ type: MastersLookupPayloadDto })
  masters!: MastersLookupPayloadDto;
}
export class MasterLookupSuccessDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Name-id data fetched successfully' })
  message!: string;
  @ApiProperty({ type: MasterLookupPayloadDto })
  data!: MasterLookupPayloadDto;
}
export class NameIdOptionListSuccessDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Data fetched successfully' })
  message!: string;
  @ApiProperty({ type: NameIdOptionDto, isArray: true })
  data!: NameIdOptionDto[];
}
export class FiscalYearOptionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ example: '2025-2026' })
  name!: string;
  @ApiProperty({ example: '2025-04-01', nullable: true })
  beginDate!: string | null;
  @ApiProperty({ example: '2026-03-31', nullable: true })
  endDate!: string | null;
  @ApiProperty({ example: 'OPEN' })
  status!: string;
  @ApiProperty({ example: true })
  isCurrent!: boolean;
}
export class FiscalYearOptionListSuccessDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Fiscal years fetched for company' })
  message!: string;
  @ApiProperty({ type: FiscalYearOptionDto, isArray: true })
  data!: FiscalYearOptionDto[];
}
export class FreightChargeDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ nullable: true, example: 0, description: 'Slab start distance (km)' })
  fromKm!: number | null;
  @ApiProperty({ nullable: true, example: 50, description: 'Slab end distance (km)' })
  toKm!: number | null;
  @ApiProperty({ nullable: true, example: 250, description: 'Freight charge for the slab' })
  freightCharge!: number | null;
  @ApiProperty({ nullable: true, example: 0, description: 'Slab start weight' })
  fromWeight!: number | null;
  @ApiProperty({ nullable: true, example: 100, description: 'Slab end weight' })
  toWeight!: number | null;
}
export class FreightChargeListSuccessDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Freight charges fetched successfully' })
  message!: string;
  @ApiProperty({ type: FreightChargeDto, isArray: true })
  data!: FreightChargeDto[];
}
export class BarcodeItemLookupDto {
  @ApiProperty({ format: 'uuid', description: 'Resolved item id' })
  itemId!: string;
  @ApiProperty({ format: 'uuid', description: 'Selling unit id from the EAN code' })
  unitId!: string;
  @ApiProperty({ example: 'Sugar 1kg' })
  itemName!: string;
  @ApiProperty({ example: 0, description: 'Legacy item batch_config' })
  batchConfig!: number;
  @ApiProperty({ example: true, description: 'Legacy item allow_sales' })
  allowSales!: boolean;
  @ApiProperty({ example: true, description: 'Legacy item_status (item_is_active)' })
  itemStatus!: boolean;
  @ApiProperty({ example: false, description: 'Legacy weigh_scale flag' })
  weighScale!: boolean;
}
export class BarcodeItemLookupSuccessDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item fetched successfully for barcode' })
  message!: string;
  @ApiProperty({ type: BarcodeItemLookupDto })
  data!: BarcodeItemLookupDto;
}
export class ItemUnitOptionDto {
  @ApiProperty({ format: 'uuid', description: 'item_unit_conversion PK (iuc_id)' })
  itemUnitId!: string;
  @ApiProperty({ format: 'uuid', description: 'item_unit_master PK (unit_id)' })
  unitId!: string;
  @ApiProperty({ example: 'PCS', description: 'Unit name (unit_name)' })
  unitName!: string;
}
export class ItemUnitOptionListSuccessDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Units fetched successfully for item' })
  message!: string;
  @ApiProperty({ type: [ItemUnitOptionDto] })
  data!: ItemUnitOptionDto[];
}
export class CustomerDetailDto {
  @ApiProperty({ format: 'uuid' })
  cust_id!: string;
  @ApiProperty({ example: 'Ramesh Traders' })
  cust_name!: string;
  @ApiProperty({ nullable: true })
  cust_address!: string | null;
  @ApiProperty({ nullable: true })
  cust_place!: string | null;
  @ApiProperty({ nullable: true })
  cust_ename!: string | null;
  @ApiProperty({ nullable: true })
  cust_eadd1!: string | null;
  @ApiProperty({ nullable: true })
  cust_eadd2!: string | null;
  @ApiProperty({ nullable: true })
  cust_eadd3!: string | null;
  @ApiProperty({ nullable: true })
  cust_pin!: string | null;
  @ApiProperty({ nullable: true })
  ecommerce_gstin!: string | null;
  @ApiProperty({ nullable: true })
  gst_no!: string | null;
  @ApiProperty({ nullable: true })
  gst_type!: string | null;
  @ApiProperty({ example: '33' })
  state_code!: string;
  @ApiProperty({ example: 'Tamil Nadu' })
  state_name!: string;
  @ApiProperty({ format: 'uuid' })
  area_id!: string;
  @ApiProperty({ nullable: true, example: 'Gandhipuram' })
  area_name!: string | null;
  @ApiProperty({ nullable: true, example: 12 })
  distance_km!: number | null;
  @ApiProperty({ nullable: true })
  cust_phone1!: string | null;
  @ApiProperty({ example: 30 })
  debit_days!: number;
  @ApiProperty({ example: 50000 })
  debit_limit!: number;
  @ApiProperty({ example: true })
  debit_allowed!: boolean;
  @ApiProperty({ example: false })
  freight_charge!: boolean;
  @ApiProperty({ example: false, description: 'Loading (coolie) charge flag' })
  cooly!: boolean;
  @ApiProperty({ example: false })
  unloading_charge!: boolean;
  @ApiProperty({ example: true })
  allow_promotion!: boolean;
  @ApiProperty({ example: true })
  allow_loyalty!: boolean;
  @ApiProperty({ example: true })
  allow_discount!: boolean;
  @ApiProperty({ example: false })
  overdue_billing!: boolean;
  @ApiProperty({ example: 1 })
  price_level!: number;
  @ApiProperty({ example: 0 })
  cust_disc_perc!: number;
  @ApiProperty({ format: 'uuid', nullable: true })
  salesman_id!: string | null;
  @ApiProperty({ nullable: true, example: 'Suresh Kumar' })
  salesman_name!: string | null;
  @ApiProperty({ example: false })
  tcs_company!: boolean;
  @ApiProperty({ example: false })
  tcs_customer!: boolean;
  @ApiProperty({ example: true })
  cust_pan!: boolean;
  @ApiProperty({ example: true, description: 'True when customer and company share a state code' })
  local_sales!: boolean;
  @ApiProperty({ nullable: true, example: null, description: 'Loyalty points (not modelled yet)' })
  cust_points!: number | null;
  @ApiProperty({ nullable: true, example: '10 days : 01/07/26' })
  billed_date!: string | null;
}
export class CustomerDetailSuccessDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Customer detail fetched successfully' })
  message!: string;
  @ApiProperty({ type: CustomerDetailDto })
  data!: CustomerDetailDto;
}
export class ItemPriceLookupPayloadDto {
  @ApiProperty({ format: 'uuid' })
  item_id!: string;
  @ApiProperty({ format: 'uuid' })
  unit_id!: string;
  @ApiProperty({ format: 'uuid', description: 'item_price_master PK (ipm_id) the rate was taken from' })
  unit_rate_id!: string;
  @ApiProperty({ format: 'uuid' })
  godown_id!: string;
  @ApiProperty()
  godown_name!: string;
  @ApiProperty({ nullable: true })
  item_code!: string | null;
  @ApiProperty({ description: 'Regional name (item_name_ta) when regional=true, else the English name.' })
  item_name!: string;
  @ApiProperty({ nullable: true })
  item_com_code!: string | null;
  @ApiProperty({ nullable: true })
  barcode!: string | null;
  @ApiProperty()
  allow_promo!: boolean;
  @ApiProperty()
  add_freight!: boolean;
  @ApiProperty({ enum: ['Y', 'N'] })
  loading_type!: 'Y' | 'N';
  @ApiProperty({ enum: ['Y', 'N'] })
  freight_type!: 'Y' | 'N';
  @ApiProperty({ format: 'uuid' })
  item_group_id!: string;
  @ApiProperty({ format: 'uuid', nullable: true })
  item_category_id!: string | null;
  @ApiProperty()
  weigh_scale!: boolean;
  @ApiProperty({ example: 0 })
  batch_config!: number;
  @ApiProperty({ enum: ['Y', 'N'] })
  service_item!: 'Y' | 'N';
  @ApiProperty()
  allow_negative_stock!: boolean;
  @ApiProperty({
    enum: [1, 2, 3, 4, 5, 6, 7],
    description: '1=A, 2=B, 3=C, 4=D, 5=MRP/max, 6=min, 7=cost',
  })
  price_level!: number;
  @ApiProperty({ example: 100.5 })
  sales_price!: number;
  @ApiProperty({ example: 80 })
  cost_price!: number;
  @ApiProperty({ example: 78 })
  cost_wot!: number;
  @ApiProperty({ example: 90 })
  min_price!: number;
  @ApiProperty({ example: 120 })
  max_price!: number;
  @ApiProperty({ example: 0 })
  disc_perc!: number;
  @ApiProperty({ example: 0 })
  disc_qty!: number;
  @ApiProperty({ nullable: true, description: 'Legacy group scheme discount — no column in current schema, always null' })
  sch_discount!: number | null;
  @ApiProperty({ example: 0 })
  addl_cess!: number;
  @ApiProperty({ nullable: true })
  unit_desc!: string | null;
  @ApiProperty({ example: 0 })
  unit_weight!: number;
  @ApiProperty({ example: 0 })
  unit_loading!: number;
  @ApiProperty({ example: 2 })
  decimal_count!: number;
  @ApiProperty({ example: 0 })
  loyalty_pv!: number;
  @ApiProperty({ nullable: true, example: 0 })
  stock!: number | null;
  @ApiProperty({ nullable: true, example: 0 })
  reorder_qty!: number | null;
  @ApiProperty({ example: 0 })
  gst_rate!: number;
  @ApiProperty({ example: 0 })
  cess_perc!: number;
  @ApiProperty({ example: 0 })
  cess_unit!: number;
  @ApiProperty({ example: 0 })
  sgst_perc!: number;
  @ApiProperty({ example: 0 })
  cgst_perc!: number;
  @ApiProperty({ example: 0 })
  igst_perc!: number;
  @ApiProperty({ format: 'uuid', nullable: true })
  sales_ledger_id!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true })
  sgst_output_ledger_id!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true })
  cgst_output_ledger_id!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true })
  igst_output_ledger_id!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true })
  cess_output_ledger_id!: string | null;
}
export class ItemPriceLookupSuccessDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Item price lookup fetched successfully' })
  message!: string;
  @ApiProperty({ type: ItemPriceLookupPayloadDto })
  data!: ItemPriceLookupPayloadDto;
}