import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BELOW_COST_POLICIES,
  PRICE_LEVELS,
  PRICE_SCOPES,
  PRICE_SOURCES,
  PRICE_VERDICTS,
} from '../types/selling-price-bulk.types';

export class SellingPriceErrorFieldDto {
  @ApiProperty({ example: 'scope' })
  field!: string;

  @ApiProperty({ example: 'Only an HQ user may save prices for all branches.' })
  message!: string;
}

export class SellingPriceErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'These prices cannot be saved' })
  message!: string;

  @ApiProperty({ type: SellingPriceErrorFieldDto, isArray: true })
  errors!: SellingPriceErrorFieldDto[];
}

export class SellingPriceLevelDto {
  @ApiProperty({ enum: PRICE_LEVELS, example: 1 })
  level!: number;

  @ApiProperty({ example: 18.5 })
  markupPerc!: number;

  @ApiProperty({ example: 100 })
  priceWot!: number;

  @ApiProperty({ example: 118 })
  price!: number;

  @ApiProperty({ example: 15.25 })
  marginPerc!: number;
}

export class SellingPriceRowDto {
  @ApiProperty({ example: 1 })
  lineNo!: number;

  @ApiProperty({ format: 'uuid' })
  itemId!: string;

  @ApiPropertyOptional({ nullable: true, example: 'SALT-1KG' })
  itemCode!: string | null;

  @ApiProperty({ example: 'Salt 1 Kg' })
  itemName!: string;

  @ApiProperty({ format: 'uuid', description: 'item_unit_conversion.iuc_id' })
  uomId!: string;

  @ApiPropertyOptional({ nullable: true, example: 'BOX' })
  unitName!: string | null;

  @ApiProperty({ example: 42 })
  stockQty!: number;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 120 })
  mrp!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 118 })
  salePrice!: number | null;

  @ApiProperty({
    enum: PRICE_SOURCES,
    description: 'The Src chip renders from this and priceScope, never from a string the API drew.',
  })
  priceSource!: string;

  @ApiProperty({ enum: PRICE_SCOPES })
  priceScope!: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'NULL when priceSource = MASTER.',
  })
  bucketId!: string | null;

  @ApiProperty({ example: 95 })
  costRate!: number;

  @ApiProperty({ example: 100 })
  minPrice!: number;

  @ApiProperty({ example: 0 })
  roundOff!: number;

  @ApiProperty({
    example: 18,
    description: 'Resolved server-side as of today through item_tax_history, not by the client.',
  })
  taxPerc!: number;

  @ApiProperty({ example: true })
  inclTax!: boolean;

  @ApiProperty({
    example: false,
    description:
      'The item carries a cess. The four-number panel is approximate for it — tax_cess_unit is ' +
      'a per-unit amount, not a percentage of price.',
  })
  hasCess!: boolean;

  @ApiProperty({ type: SellingPriceLevelDto, isArray: true })
  levels!: SellingPriceLevelDto[];
}

export class SellingPriceListMetaDto {
  @ApiProperty({ example: 200 })
  limit!: number;

  @ApiProperty({ example: 0 })
  offset!: number;

  @ApiProperty({ example: 200 })
  count!: number;
}

export class SellingPriceListDataDto {
  @ApiProperty({ type: SellingPriceRowDto, isArray: true })
  items!: SellingPriceRowDto[];

  @ApiProperty({ type: SellingPriceListMetaDto })
  meta!: SellingPriceListMetaDto;
}

export class SellingPriceListSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: '200 rows loaded' })
  message!: string;

  @ApiProperty({ type: SellingPriceListDataDto })
  data!: SellingPriceListDataDto;
}

export class SellingPriceBucketsSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: '2 buckets found' })
  message!: string;

  @ApiProperty({ type: SellingPriceRowDto, isArray: true })
  data!: SellingPriceRowDto[];
}

export class SellingPriceProblemDto {
  @ApiProperty({ example: 3 })
  lineNo!: number;

  @ApiProperty({ format: 'uuid' })
  itemId!: string;

  @ApiPropertyOptional({ nullable: true })
  itemCode!: string | null;

  @ApiProperty()
  itemName!: string;

  @ApiProperty({ format: 'uuid' })
  uomId!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  bucketId!: string | null;

  @ApiPropertyOptional({ type: Number, enum: PRICE_LEVELS, nullable: true })
  level!: number | null;

  @ApiProperty({ enum: PRICE_VERDICTS })
  verdict!: string;

  @ApiProperty({ example: 'Retail Price 92.00 is below the cost of 95.00.' })
  message!: string;
}

export class SellingPriceNoStockRowDto {
  @ApiProperty({ format: 'uuid' })
  bucketId!: string;

  @ApiProperty({ format: 'uuid' })
  itemId!: string;

  @ApiPropertyOptional({ nullable: true })
  itemCode!: string | null;

  @ApiProperty()
  itemName!: string;

  @ApiProperty({ format: 'uuid' })
  uomId!: string;

  @ApiPropertyOptional({ nullable: true })
  unitName!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  mrp!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  salePrice!: number | null;
}

export class SellingPriceSaveDataDto {
  @ApiProperty({ example: 12, description: 'stock_mrp_price rows written — S2 and S3 together.' })
  saved!: number;

  @ApiProperty({ example: 2, description: 'item_price_master rows written by the §6 fan-out.' })
  masterRowsSaved!: number;

  @ApiProperty({ type: SellingPriceNoStockRowDto, isArray: true })
  noStock!: SellingPriceNoStockRowDto[];

  @ApiProperty({
    example: false,
    description: 'True means NOTHING was written and the client must re-post with confirmed: true.',
  })
  needsConfirm!: boolean;

  @ApiProperty({ type: SellingPriceProblemDto, isArray: true })
  problems!: SellingPriceProblemDto[];

  @ApiProperty({ enum: BELOW_COST_POLICIES, example: 'warning' })
  belowCostPolicy!: string;
}

export class SellingPriceSaveSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({
    example: '12 buckets saved · 2 have no stock on hand — the price applies when stock arrives.',
    description:
      'NEVER a plain "Saved" when noStock is non-empty. That was legacy fault #2, and the ' +
      'message is built from the same numbers the client can see in data.',
  })
  message!: string;

  @ApiProperty({ type: SellingPriceSaveDataDto })
  data!: SellingPriceSaveDataDto;
}
