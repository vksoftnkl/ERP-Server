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
