import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import {
  BELOW_COST_POLICIES,
  BELOW_COST_RULES,
  COST_BASES,
  PRICE_LINE_KINDS,
  PRICE_LEVELS,
  PRICE_SCOPES,
  PRICE_SOURCES,
  PRICE_VERDICTS,
  type CostBasis,
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

/** P1 C5 — the other branches reading an All branches line: their stock cost, lowest – highest. */
export class OtherBranchesStockCostDto {
  @ApiProperty({ example: 448.5 })
  low!: number;

  @ApiProperty({ example: 470.4 })
  high!: number;

  @ApiProperty({ example: 'Counter2' })
  lowBranch!: string;

  @ApiProperty({ example: 'Head Office' })
  highBranch!: string;

  @ApiProperty({
    example: 2,
    description: 'How many other branches have a stock cost for the line.',
  })
  branches!: number;
}

/** P1 — a line's level: the old four numbers plus the line's stored markup %. */
export class SellingPriceLineLevelDto extends SellingPriceLevelDto {
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 25,
    description:
      "The line's own ipm_price_x_markup_perc (the item card's typed %, kept by decision 20); " +
      'null on NO_PRICE / an unpriced headline.',
  })
  storedMarkupPerc!: number | null;
}

/** Change Selling Price P1 (plan 2026-11-23 §7.1) — one LINE: every old row key, plus these. */
export class SellingPriceLineRowDto extends OmitType(SellingPriceRowDto, ['levels'] as const) {
  @ApiProperty({ type: SellingPriceLineLevelDto, isArray: true })
  levels!: SellingPriceLineLevelDto[];

  @ApiProperty({
    enum: PRICE_LINE_KINDS,
    description:
      'HEADLINE = the unit\'s headline (the "other MRPs" line of an MRP item), always listed, ' +
      'bucketId null when unpriced · MRP / SOLD_AT = a line of that key in force at the branch ' +
      '· NO_PRICE = stock whose key has no line of its own (priced by the headline).',
  })
  lineKind!: string;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 416,
    description:
      "The line's own ipm_cost_price (the last purchase cost); null on NO_PRICE / unpriced.",
  })
  lineCost!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 352.542373 })
  lineCostWot!: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 452,
    description:
      "This MRP's landing cost (MRP / NO_PRICE at an MRP), else the branch average, × unitFactor. " +
      'Null when the branch has neither. Grey, never sent back.',
  })
  stockCost!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  stockCostWot!: number | null;

  @ApiPropertyOptional({ enum: ['MRP', 'ITEM'], nullable: true })
  stockCostBasis!: 'MRP' | 'ITEM' | null;

  @ApiPropertyOptional({
    type: OtherBranchesStockCostDto,
    nullable: true,
    description:
      'Only on an All branches (CHAIN) line, when another branch reading it (stock on hand, no ' +
      'own line) has a stock cost; else null.',
  })
  otherBranchesStockCost!: OtherBranchesStockCostDto | null;

  @ApiProperty({ example: 'By %', description: 'ipm_profit_type; blank → "By User".' })
  profitType!: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      "The line's company; null = shared. A company-less line of the company's own item reads " +
      'as the company (the save updates it in place). NO_PRICE: the company asked for.',
  })
  companyId!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Acme Foods' })
  companyName!: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: "The line's branch (a store's own line); null = All branches (and NO_PRICE).",
  })
  branchId!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Acme CBE' })
  branchName!: string | null;

  @ApiProperty({ example: 12, description: 'iuc_to_base_factor' })
  unitFactor!: number;

  @ApiProperty({ example: 1, description: 'iuc_unit_slno' })
  unitSlNo!: number;

  @ApiProperty({ example: true, description: 'iuc_is_default_unit' })
  isDefaultUnit!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Edible Oil' })
  itemGroupName!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'GST 5%' })
  taxName!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "The effective stock track preset's name (own, else the group's).",
  })
  trackPresetName!: string | null;

  @ApiProperty({ example: false })
  trackMrp!: boolean;

  @ApiProperty({ example: false })
  trackSalePrice!: boolean;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  itemCompanyId!: string | null;

  @ApiProperty({
    example: 14,
    description:
      "The item's saleable stock at the branch, in itemStockUnit (default unit, else base).",
  })
  itemStockQty!: number;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'BOX' })
  itemStockUnit!: string | null;
}

export class SellingPriceLinesMetaDto {
  @ApiProperty({ example: 200, description: 'ITEMS per page.' })
  limit!: number;

  @ApiProperty({ example: 0, description: 'In ITEMS.' })
  offset!: number;

  @ApiProperty({ example: 4, description: 'Items on this page.' })
  count!: number;

  @ApiProperty({ example: 12, description: 'Lines on this page.' })
  lines!: number;
}

export class SellingPriceLinesDataDto {
  @ApiProperty({ type: SellingPriceLineRowDto, isArray: true })
  items!: SellingPriceLineRowDto[];

  @ApiProperty({ type: SellingPriceLinesMetaDto })
  meta!: SellingPriceLinesMetaDto;
}

export class SellingPriceLinesSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: '4 items, 12 lines loaded' })
  message!: string;

  @ApiProperty({ type: SellingPriceLinesDataDto })
  data!: SellingPriceLinesDataDto;
}

export class SellingPriceNowPricedByDto {
  @ApiProperty({ enum: PRICE_LINE_KINDS })
  lineKind!: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'null = All branches.',
  })
  branchId!: string | null;

  @ApiProperty({ format: 'uuid' })
  ipmId!: string;

  @ApiProperty({ type: Number, isArray: true, example: [505, 530, 0, 0] })
  prices!: number[];
}

export class SellingPriceBackDataDto {
  @ApiProperty({ example: 2 })
  removed!: number;

  @ApiProperty({ type: String, isArray: true, format: 'uuid' })
  removedIds!: string[];

  @ApiProperty({ type: SellingPriceNowPricedByDto })
  nowPricedBy!: SellingPriceNowPricedByDto;
}

export class SellingPriceBackSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({
    example: '2 own price lines removed — the branch reads the All branches price again',
  })
  message!: string;

  @ApiProperty({ type: SellingPriceBackDataDto })
  data!: SellingPriceBackDataDto;
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

  @ApiPropertyOptional({ example: 'STOCK_PRICE_BELOW_COST' })
  code?: string;

  @ApiPropertyOptional({
    enum: BELOW_COST_RULES,
    description:
      'P1 (A3 option C) BELOW_COST: LINE_COST / STOCK_COST name the higher cost when both are ' +
      "known; BRANCHES = another branch's stock cost (branchId / branchName). Absent = one cost.",
  })
  rule?: string;

  @ApiPropertyOptional({ example: 500, description: 'The cost judged against.' })
  cost?: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  lineCost?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  stockCost?: number | null;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  branchId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  branchName?: string | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'level, price, cost, lineCost, stockCost, branch, unit, mrp, item, n.',
  })
  params?: Record<string, string | number>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Notes 120 — {title, line, todo}, the plain words of code + rule.',
  })
  user?: { title: string; line: string; todo: string };
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

  @ApiProperty({
    example: 1385,
    description:
      "Notes 147 B — the cost to show now, by the grid rule: this MRP's stock, else the " +
      "item's average, else the price row's own (a keyed costPrice shows here only while the " +
      'item has no stock). One of this unit, tax inclusive.',
  })
  costRate!: number;

  @ApiProperty({ example: 1173.728814 })
  costWot!: number;

  @ApiProperty({ enum: COST_BASES, nullable: true, example: 'PRICE_ROW' })
  costBasis!: CostBasis | null;
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
