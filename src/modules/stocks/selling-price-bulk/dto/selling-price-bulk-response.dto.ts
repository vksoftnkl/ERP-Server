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

  @ApiPropertyOptional({
    nullable: true,
    example: '8901234567890',
    description: 'item_default_barcode — display only, never sent back on save (notes 76).',
  })
  barcode!: string | null;

  @ApiProperty({ example: 'Salt 1 Kg' })
  itemName!: string;

  @ApiProperty({ format: 'uuid', description: 'item_unit_conversion.iuc_id' })
  uomId!: string;

  @ApiPropertyOptional({ nullable: true, example: 'BOX' })
  unitName!: string | null;

  @ApiProperty({
    example: 42,
    description: "On hand at the branch for this bucket, in this row's own unit.",
  })
  stockQty!: number;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 120 })
  mrp!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 118 })
  salePrice!: number | null;

  @ApiProperty({
    example: 40,
    description:
      "What the MRP column shows: the answering row's ipm_max_price — the bucket's MRP on a " +
      "BUCKET row, the headline's own MRP on a MASTER row. Display only; mrp is the identity " +
      'the save echoes.',
  })
  maxPrice!: number;

  @ApiProperty({
    enum: PRICE_SOURCES,
    description:
      'The Src chip renders from this and priceScope, never from a string the API drew. ' +
      'MASTER with mrp / salePrice set = this stock bucket has no row of its own yet; the ' +
      'headline prices it and Save creates the bucket row.',
  })
  priceSource!: string;

  @ApiPropertyOptional({
    enum: PRICE_SCOPES,
    nullable: true,
    description: 'Null when no price row answers for this bucket yet.',
  })
  priceScope!: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'The item_price_master row (ipm_id) that answered — a bucket row on BUCKET, the headline ' +
      'on MASTER. NULL when no row prices this bucket yet.',
  })
  bucketId!: string | null;

  @ApiProperty({
    example: 95,
    description:
      "Cost of one of this row's unit: for an MRP-tracked item's MRP bucket, the inward cost of " +
      "that MRP's stock at the branch, weighted by what is on hand (notes 75); otherwise the " +
      'branch moving average, else the price row’s stored cost.',
  })
  costRate!: number;

  @ApiProperty({
    example: 85,
    description:
      'costRate without tax, from the same source (the MRP stock, the branch average or the ' +
      'price row) — exact for an item with cess, unlike cost ÷ (1 + tax%) (notes 76).',
  })
  costWot!: number;

  @ApiProperty({
    enum: ['MRP', 'ITEM', 'PRICE_ROW'],
    nullable: true,
    description:
      'Which figure costRate is: MRP = that MRP’s stock only ("Cost @ MRP 40"), ITEM = the item ' +
      'average at the branch, PRICE_ROW = the cost stored on the answering price row. Null = no cost.',
  })
  costBasis!: 'MRP' | 'ITEM' | 'PRICE_ROW' | null;

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
      "The item's tax rate carries a cess or an additional cess. The four-number panel is " +
      'approximate for it — tax_cess_per_unit is a per-unit amount, not a percentage of price, ' +
      'and neither cess is in taxPerc.',
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

  @ApiProperty({ example: '4 price rows found' })
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

/** Notes 140 A — one row a save wrote. */
export class SellingPriceSavedRowDto {
  @ApiProperty({ example: 3 })
  lineNo!: number;

  @ApiProperty({
    format: 'uuid',
    description: 'The item_price_master row written — for a split, the NEW row.',
  })
  bucketId!: string;

  @ApiProperty({
    example: true,
    description: 'True when the row starts after today: scheduled, not yet on the shelf.',
  })
  scheduled!: boolean;

  @ApiProperty({ format: 'date', example: '2026-10-23' })
  effectiveFrom!: string;

  @ApiProperty({ format: 'date', example: '9999-12-31' })
  effectiveTo!: string;
}

export class SellingPriceSaveDataDto {
  @ApiProperty({
    example: 12,
    description:
      'item_price_master rows written — S2 and S3 together, buckets and headlines alike.',
  })
  saved!: number;

  @ApiProperty({
    format: 'date',
    example: '2026-10-23',
    description: "Notes 140 A — the day the prices start: the body's effectiveFrom, else today.",
  })
  effectiveFrom!: string;

  @ApiProperty({
    type: SellingPriceSavedRowDto,
    isArray: true,
    description: 'Notes 140 A — per row written, in the order sent. Empty on needsConfirm.',
  })
  rows!: SellingPriceSavedRowDto[];

  @ApiProperty({
    example: 0,
    deprecated: true,
    description:
      'ALWAYS 0. The headline fan-out is gone (one price table); kept for one release so a ' +
      'client built against the frozen DTO does not break.',
  })
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

/** Notes 140 B — the prices a scheduled row replaces. */
export class SellingPriceSchedulePreviousDto {
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'The row of the same key ending the day before, else the row that priced the bucket ' +
      'at this branch that day.',
  })
  bucketId!: string | null;

  @ApiPropertyOptional({ enum: PRICE_SCOPES, nullable: true })
  priceScope!: string | null;

  @ApiProperty({ type: SellingPriceLevelDto, isArray: true })
  levels!: SellingPriceLevelDto[];
}

/** Notes 140 B — one scheduled price: a grid row plus its period and what it replaces. */
export class SellingPriceScheduleRowDto extends SellingPriceRowDto {
  @ApiProperty({ format: 'date', example: '2026-10-23' })
  effectiveFrom!: string;

  @ApiProperty({ format: 'date', example: '9999-12-31' })
  effectiveTo!: string;

  @ApiPropertyOptional({
    type: SellingPriceSchedulePreviousDto,
    nullable: true,
    description: 'Null when nothing priced the bucket the day before.',
  })
  previous!: SellingPriceSchedulePreviousDto | null;
}

export class SellingPriceScheduleSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: '2 scheduled prices found' })
  message!: string;

  @ApiProperty({ type: SellingPriceScheduleRowDto, isArray: true })
  data!: SellingPriceScheduleRowDto[];
}

export class SellingPriceScheduleCancelDataDto {
  @ApiProperty({ format: 'uuid', description: 'The scheduled row, now deleted.' })
  bucketId!: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: "The row before it, now running to the cancelled row's end.",
  })
  restoredId!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true, example: '9999-12-31' })
  restoredTo!: string | null;
}

export class SellingPriceScheduleCancelSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Scheduled price cancelled' })
  message!: string;

  @ApiProperty({ type: SellingPriceScheduleCancelDataDto })
  data!: SellingPriceScheduleCancelDataDto;
}
