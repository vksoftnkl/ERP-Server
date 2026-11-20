import { ApiProperty } from '@nestjs/swagger';

class MobileCompanyOptionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, type: String, description: 'comp_city' }) place!: string | null;
}

class MobileBranchOptionDto {
  @ApiProperty({ format: 'uuid', description: "br_id: what an order's soBranchId takes" })
  id!: string;
  @ApiProperty({ example: 'Head Office' }) name!: string;
  @ApiProperty({ format: 'uuid', description: 'br_comp_id: one of the ids in companies' })
  companyId!: string;
  @ApiProperty({ description: "br_is_default: the company's default branch" })
  isDefault!: boolean;
}

class MobileSortedOptionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'The master sort order; null = unsorted',
  })
  position!: number | null;
}

class MobileItemPriceLevelOptionDto {
  @ApiProperty({ example: 1 }) id!: number;
  @ApiProperty({ example: 'WS Price' }) name!: string;
}

export class MobileItemOptionsDto {
  @ApiProperty({ type: [MobileCompanyOptionDto] }) companies!: MobileCompanyOptionDto[];
  @ApiProperty({
    type: [MobileBranchOptionDto],
    description:
      'The active, not deleted branches of the companies listed in companies (since ' +
      '2026-11-18), for the phone to pick a branch over plain HTTP. Per company in the order ' +
      'of companies, then by name and id, the rows and order of ' +
      'GET /master-lookups/branches/by-company/{companyId}. A company with no branch has no row.',
  })
  branches!: MobileBranchOptionDto[];
  @ApiProperty({ type: [MobileSortedOptionDto] }) itemGroups!: MobileSortedOptionDto[];
  @ApiProperty({ type: [MobileSortedOptionDto] }) brands!: MobileSortedOptionDto[];
  @ApiProperty({
    type: [MobileItemPriceLevelOptionDto],
    description:
      'Active levels without Cost (7). 1-4 price from priceA-priceD, 5 (MRP) from mrp, 6 (minimum) from minPrice.',
  })
  priceLevels!: MobileItemPriceLevelOptionDto[];
}

export class MobileItemOptionsSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty() message!: string;
  @ApiProperty({ type: MobileItemOptionsDto }) data!: MobileItemOptionsDto;
}

const MONEY = { nullable: true, type: String, example: '125.00' } as const;

export class MobileItemUnitDto {
  @ApiProperty({ format: 'uuid', description: 'item_unit_conversion id: send it as soiItemUnitId' })
  iucId!: string;
  @ApiProperty({ format: 'uuid' }) unitId!: string;
  @ApiProperty({ nullable: true, type: String, example: 'BOX' }) unitName!: string | null;
  @ApiProperty({ example: 12, description: 'qty in this unit × factor = qty in the base unit' })
  factor!: number;
  @ApiProperty() isDefaultUnit!: boolean;
  @ApiProperty() isBaseUnit!: boolean;
  @ApiProperty({ example: 0, description: 'UOM weight per unit (0 = not set)' }) weight!: number;
  @ApiProperty({
    description: 'false = no live price row prices this unit today; every price is null',
  })
  priced!: boolean;
  @ApiProperty({ ...MONEY, description: 'Price level 1 (A)' }) priceA!: string | null;
  @ApiProperty({ ...MONEY, description: 'Price level 2 (B)' }) priceB!: string | null;
  @ApiProperty({ ...MONEY, description: 'Price level 3 (C)' }) priceC!: string | null;
  @ApiProperty({ ...MONEY, description: 'Price level 4 (D)' }) priceD!: string | null;
  @ApiProperty({ ...MONEY, description: 'MRP (ipm_max_price, level 5)' }) mrp!: string | null;
  @ApiProperty({ ...MONEY, description: 'Minimum price (level 6)' }) minPrice!: string | null;
  @ApiProperty({ ...MONEY, description: 'Loading charge per unit' }) loadingCharge!: string | null;
  @ApiProperty({ ...MONEY, description: 'Freight charge per unit' }) freightCharge!: string | null;
  @ApiProperty({ enum: ['MASTER', 'BUCKET'], nullable: true }) priceSource!: string | null;
  @ApiProperty({ enum: ['BRANCH', 'CHAIN'], nullable: true }) priceScope!: string | null;
  @ApiProperty({
    example: 2.083,
    description: 'Saleable stock free to sell in the company, in this unit (3 decimals)',
  })
  availableQty!: number;
}

export class MobileItemDto {
  @ApiProperty({ format: 'uuid' }) itemId!: string;
  @ApiProperty({ nullable: true, type: String }) itemCode!: string | null;
  @ApiProperty() itemNameEn!: string;
  @ApiProperty({ nullable: true, type: String }) itemNameTa!: string | null;
  @ApiProperty({ format: 'uuid' }) itemGroupId!: string;
  @ApiProperty({ nullable: true, type: String }) itemGroupName!: string | null;
  @ApiProperty({ nullable: true, type: String, format: 'uuid' }) itemBrandId!: string | null;
  @ApiProperty({ nullable: true, type: String }) itemBrandName!: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    format: 'uuid',
    description:
      "item_category_id (since 2026-11-19): the phone's offer engine matches ITEM_CATEGORY " +
      'scheme rows by it',
  })
  categoryId!: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    format: 'uuid',
    description:
      "item_section_id (since 2026-11-19): the phone's offer engine matches ITEM_SECTION " +
      'scheme rows by it',
  })
  sectionId!: string | null;
  @ApiProperty() allowLoading!: boolean;
  @ApiProperty() allowFreight!: boolean;
  @ApiProperty() allowPromo!: boolean;
  @ApiProperty({ description: 'The stored prices include tax' }) inclTax!: boolean;
  @ApiProperty({ nullable: true, type: String }) hsnCode!: string | null;
  @ApiProperty({ nullable: true, type: String, format: 'uuid' }) taxId!: string | null;
  @ApiProperty({
    example: '18.000',
    description: 'GST rate; 0 when the company is not GST applicable',
  })
  taxPerc!: string;
  @ApiProperty({ example: 25, description: 'Free saleable stock in the base unit' })
  availableBaseQty!: number;
  @ApiProperty({ type: [MobileItemUnitDto] }) units!: MobileItemUnitDto[];
}

export class MobileItemListDto {
  @ApiProperty({ type: [MobileItemDto] }) items!: MobileItemDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() hasMore!: boolean;
  @ApiProperty({ format: 'uuid' }) companyId!: string;
  @ApiProperty({
    nullable: true,
    type: String,
    format: 'uuid',
    description: "The branch the prices are for (the phone's, else the company default)",
  })
  branchId!: string | null;
  @ApiProperty({ example: '2026-11-16', description: 'The day prices were read for' })
  priceDate!: string;
}

export class MobileItemListSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty() message!: string;
  @ApiProperty({ type: MobileItemListDto }) data!: MobileItemListDto;
}
