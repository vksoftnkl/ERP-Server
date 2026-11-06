import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LEFT_OUT_REASONS, PROFIT_TYPES } from '../types/cost-price-bulk.types';

/** Swagger shapes of the three routes. The types in types/cost-price-bulk.types.ts are the contract. */

export class CostBulkLevelDto {
  @ApiProperty({ example: 1, minimum: 1, maximum: 4 })
  level!: number;

  @ApiProperty({ example: 154, description: 'ipm_sales_price_<a-d>, tax inclusive.' })
  price!: number;

  @ApiProperty({ example: 146.666667, description: 'ipm_price_<a-d>_wot, as stored.' })
  priceWot!: number;

  @ApiProperty({
    example: 10,
    description: 'ipm_price_<a-d>_markup_perc, as stored: (price − cost) ÷ cost × 100.',
  })
  markupPerc!: number;

  @ApiProperty({
    description:
      'fixed.price_levels.price_lvl_is_active (and not deleted). Show only active levels; an inactive one is ' +
      'never checked (MRP / Min / cost) and keeps its price on save.',
  })
  active!: boolean;
}

export class CostBulkRightsDto {
  @ApiProperty() view!: boolean;
  @ApiProperty() edit!: boolean;
  @ApiProperty({
    description: 'Ticking a warning: the same as edit (no separate Override right on menu 298).',
  })
  override!: boolean;
}

export class CostBulkRowDto {
  @ApiProperty({ example: 1, description: '1-based over the whole filter.' })
  lineNo!: number;
  @ApiProperty({
    format: 'uuid',
    description: 'inventory.item_price_master.ipm_id — the row in force today.',
  })
  ipmId!: string;
  @ApiProperty({ format: 'uuid' })
  itemId!: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  itemCode!: string | null;
  @ApiProperty()
  itemName!: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  barcode!: string | null;
  @ApiProperty({ format: 'uuid', description: 'item_unit_conversion.iuc_id' })
  uomId!: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  unitName!: string | null;
  @ApiProperty({ description: 'iuc_unit_slno — the rows of an item come in this order.' })
  unitSlno!: number;
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'The unit above (previous active slno); null on the top unit.',
  })
  parentUomId!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  parentUnitName!: string | null;
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 12,
    description:
      'How many of this unit make one parent: iuc_unit_factor when it agrees with parent to-base ÷ this to-base (2 dp), else the ratio. Child cost = parent cost ÷ this.',
  })
  unitsPerParent!: number | null;
  @ApiProperty({ description: 'iuc_to_base_factor' })
  toBaseFactor!: number;
  @ApiProperty({ description: 'iuc_unit_factor' })
  unitFactor!: number;
  @ApiProperty({ description: 'False when the to-base ratio and iuc_unit_factor disagree.' })
  factorsAgree!: boolean;
  @ApiProperty({
    enum: ['BRANCH', 'CHAIN'],
    description: 'CHAIN = the all-branches row (the ALL BR chip); saving it needs HQ.',
  })
  priceScope!: string;
  @ApiProperty({
    description:
      'The row in force is shared by every company (ipm_company_id NULL). Saving it leaves it as it ' +
      "is and writes this company's own row (the saved row then has companyCopy true and a new ipmId).",
  })
  companyShared!: boolean;
  @ApiProperty({ enum: PROFIT_TYPES, description: "ipm_profit_type — the unit's rule." })
  profitType!: string;
  @ApiProperty({
    description:
      'ipm_round_off — the round-up step (0 = up to 0.01). Never written by this screen.',
  })
  roundOff!: number;
  @ApiProperty({
    example: 5,
    description: 'Tax % as of today (item_tax_history, else the item default).',
  })
  taxPerc!: number;
  @ApiProperty({ example: 140, description: 'ipm_cost_price, tax inclusive.' })
  costPrice!: number;
  @ApiProperty({ description: 'ipm_cost_wot' })
  costWot!: number;
  @ApiProperty({ example: 185, description: 'ipm_max_price. 0 = no MRP.' })
  mrp!: number;
  @ApiProperty({ description: 'ipm_min_price. 0 = no Min.' })
  minPrice!: number;
  @ApiProperty({
    type: CostBulkLevelDto,
    isArray: true,
    description: 'Always the four levels, 1–4.',
  })
  levels!: CostBulkLevelDto[];
  @ApiPropertyOptional({
    type: String,
    format: 'date',
    nullable: true,
    description: 'A later row of the same key starts that day (the SCHEDULED chip).',
  })
  scheduledFrom!: string | null;
  @ApiProperty({
    description: 'A live qty-wise slab prices this item and unit here (left as it is by the save).',
  })
  hasQtySlabs!: boolean;
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'ipm_updated_on — display only.',
  })
  updatedOn!: string | null;
  @ApiProperty({ description: 'The concurrency token to send back on validate / save.' })
  rowToken!: string;
}

export class CostBulkLeftOutDto {
  @ApiProperty({ format: 'uuid' })
  itemId!: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  itemCode!: string | null;
  @ApiProperty()
  itemName!: string;
  @ApiPropertyOptional({ type: String, nullable: true, description: 'Null = the whole item.' })
  unitName!: string | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  uomId!: string | null;
  @ApiProperty({
    example: 'Batch + expiry + MRP (supermarket)',
    description: 'The effective preset, or "Plain stock".',
  })
  trackedAs!: string;
  @ApiProperty({ enum: LEFT_OUT_REASONS })
  reasonCode!: string;
  @ApiProperty()
  reason!: string;
}

export class CostBulkLeftOutCountsDto {
  @ApiProperty() NOT_PLAIN_STOCK!: number;
  @ApiProperty() OLD_BATCH_TICK!: number;
  @ApiProperty() NO_PRICE_ROW!: number;
  @ApiProperty() INACTIVE!: number;
}

export class CostBulkListDataDto {
  @ApiProperty({ type: CostBulkRowDto, isArray: true })
  items!: CostBulkRowDto[];
  @ApiProperty({ description: 'Grid rows for the whole filter (all pages).' })
  total!: number;
  @ApiProperty({ description: 'Distinct items among them.' })
  totalItems!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty({
    type: CostBulkLeftOutDto,
    isArray: true,
    description: 'Page 1 only (else []), at most 1,000.',
  })
  leftOut!: CostBulkLeftOutDto[];
  @ApiProperty() leftOutTotal!: number;
  @ApiProperty({ type: CostBulkLeftOutCountsDto })
  leftOutCounts!: CostBulkLeftOutCountsDto;
  @ApiProperty({ format: 'date' }) today!: string;
  @ApiProperty({
    enum: ['restrict', 'warning', 'allow'],
    description: 'inventory.below_cost_price for this caller.',
  })
  belowCostPolicy!: string;
  @ApiProperty({ type: CostBulkRightsDto }) rights!: CostBulkRightsDto;
}

export class CostBulkListSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty() message!: string;
  @ApiProperty({ type: CostBulkListDataDto }) data!: CostBulkListDataDto;
}

export class CostBulkNoteDto {
  @ApiProperty({ example: 'COST_BULK_BELOW_COST' }) code!: string;
  @ApiProperty({ enum: ['REFUSE', 'WARN'] }) level!: string;
  @ApiProperty() message!: string;
  @ApiProperty({ example: 'rows.0.levels' }) field!: string;
  @ApiProperty({ example: 6, description: "The row's lineNo as sent." }) line!: number;
  @ApiProperty({ format: 'uuid' }) ipmId!: string;
  @ApiProperty() overridable!: boolean;
}

export class CostBulkCountsDto {
  @ApiProperty() rows!: number;
  @ApiProperty() changed!: number;
  @ApiProperty() unchanged!: number;
  @ApiProperty() refused!: number;
  @ApiProperty() warned!: number;
}

export class CostBulkValidateDataDto {
  @ApiProperty({ description: 'A save with these overrides would go through.' }) ok!: boolean;
  @ApiProperty({ type: CostBulkNoteDto, isArray: true }) refusals!: CostBulkNoteDto[];
  @ApiProperty({ type: CostBulkNoteDto, isArray: true }) warnings!: CostBulkNoteDto[];
  @ApiProperty({ type: CostBulkRightsDto }) rights!: CostBulkRightsDto;
  @ApiProperty({ type: CostBulkCountsDto }) counts!: CostBulkCountsDto;
  @ApiProperty() belowCostPolicy!: string;
}

export class CostBulkValidateSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty() message!: string;
  @ApiProperty({ type: CostBulkValidateDataDto }) data!: CostBulkValidateDataDto;
}

export class CostBulkSavedRowDto extends CostBulkRowDto {
  @ApiProperty({ description: 'This save wrote the row (false: it was unchanged).' })
  written!: boolean;
  @ApiProperty({
    format: 'uuid',
    description: 'The ipmId the request sent (ipmId differs only on a company copy).',
  })
  sourceIpmId!: string;
  @ApiProperty({ description: "The sent row was company-shared: ipmId is this company's new row." })
  companyCopy!: boolean;
}

export class CostBulkSaveDataDto {
  @ApiProperty() saved!: number;
  @ApiProperty() unchanged!: number;
  @ApiProperty({
    type: CostBulkSavedRowDto,
    isArray: true,
    description: 'Every row sent, read back, lineNo as sent.',
  })
  rows!: CostBulkSavedRowDto[];
  @ApiProperty({
    type: CostBulkNoteDto,
    isArray: true,
    description: 'The ticked warnings the save went through with.',
  })
  warnings!: CostBulkNoteDto[];
  @ApiProperty({ type: CostBulkNoteDto, isArray: true, description: 'Always empty on a 200.' })
  refusals!: CostBulkNoteDto[];
  @ApiProperty({ type: CostBulkRightsDto }) rights!: CostBulkRightsDto;
  @ApiProperty({ type: CostBulkCountsDto }) counts!: CostBulkCountsDto;
  @ApiProperty() belowCostPolicy!: string;
}

export class CostBulkSaveSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty() message!: string;
  @ApiProperty({ type: CostBulkSaveDataDto }) data!: CostBulkSaveDataDto;
}

export class CostBulkErrorDetailDto {
  @ApiProperty({ example: 'rows.0.levels' }) field!: string;
  @ApiProperty({ example: 'COST_BULK_ABOVE_MRP' }) code!: string;
  @ApiProperty() message!: string;
  @ApiPropertyOptional({ description: "The row's lineNo (notes only)." }) line?: number;
  @ApiPropertyOptional({ enum: ['REFUSE', 'WARN'] }) level?: string;
  @ApiPropertyOptional({ enum: LEFT_OUT_REASONS, description: 'One-item 422 only.' })
  reasonCode?: string;
  @ApiPropertyOptional({ description: 'One-item 422 only.' }) trackedAs?: string;
}

export class CostBulkErrorResponseDto {
  @ApiProperty({ example: false }) success!: false;
  @ApiProperty() message!: string;
  @ApiProperty({
    type: CostBulkErrorDetailDto,
    isArray: true,
    description: 'Every refusal and every un-ticked warning (save 422).',
  })
  errors!: CostBulkErrorDetailDto[];
  @ApiPropertyOptional({
    type: CostBulkNoteDto,
    isArray: true,
    description: 'Save 422: the refusals, for NexWarningStrip.',
  })
  refusals?: CostBulkNoteDto[];
  @ApiPropertyOptional({
    type: CostBulkNoteDto,
    isArray: true,
    description: 'Save 422: every warning (ticked or not), for NexWarningStrip.',
  })
  warnings?: CostBulkNoteDto[];
}
