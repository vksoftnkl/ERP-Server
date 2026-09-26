import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import {
  NullableNumber,
  NullableUuid,
  OptionalBoolean,
  OptionalInteger,
  OptionalNumber,
  OptionalUuid,
  RequiredInteger,
  RequiredNumber,
  RequiredUuid,
} from 'src/common/dto/dtoDecorators';
import { PRICE_LEVELS, PRICE_SCOPES } from '../types/selling-price-bulk.types';

/** One save is one screen-full of dirty rows, not a catalogue reprice. */
export const MAX_SAVE_ROWS = 1000;

export class SaveSellingPriceLevelDto {
  @ApiProperty({
    enum: PRICE_LEVELS,
    description:
      'Price level ordinal 1-4, mapping onto item_price_master ipm_sales_price_a..d. ' +
      'The NAMES come from inventory.item_price_levels; no user-facing text says "A".',
  })
  @RequiredInteger(1, 4)
  level!: number;

  @ApiProperty({
    example: 118,
    description:
      'The shelf price, inclusive of tax. AUTHORITATIVE — the server recomputes priceWot ' +
      'and markupPerc from it and ignores whatever those two arrive as.',
  })
  @RequiredNumber(0)
  price!: number;

  @ApiPropertyOptional({
    example: 100,
    description: 'Accepted and DISCARDED. Recomputed from price and the resolved tax %. See §5.1.',
  })
  @OptionalNumber()
  priceWot?: number;

  @ApiPropertyOptional({
    example: 18,
    description: 'Accepted and DISCARDED. Recomputed from price and the row cost. See §5.1.',
  })
  @OptionalNumber()
  markupPerc?: number;
}

export class SaveSellingPriceRowDto {
  @ApiPropertyOptional({
    default: 0,
    description:
      'The grid line this row came from. Echoed back on every problem so the client can highlight it.',
  })
  @OptionalInteger(0)
  lineNo?: number;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  itemId!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'inventory.item_unit_conversion.iuc_id — NOT item_unit_master.unit_id. Same convention ' +
      'as the stock voucher lines, and the same trap: the foreign key catches a unit_id only ' +
      'after forty rows have been typed.',
  })
  @RequiredUuid()
  uomId!: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'The bucket loaded into this row, when it had one. Absent means the row is either a new ' +
      'bucket (S3) or a headline row (§6) — which of the two is decided by mrp/salePrice, ' +
      'never by this field.',
  })
  @NullableUuid()
  bucketId?: string | null;

  @ApiPropertyOptional({
    enum: PRICE_SCOPES,
    nullable: true,
    description:
      'The priceScope this row was LOADED with, echoed back unchanged. Together with the ' +
      'header scope it is the whole of §5.5 — a CHAIN-sourced row saved at This branch ' +
      'creates an override, the same row saved at All branches moves the chain. Absent means ' +
      'the row carries no price yet, and the header scope decides alone.',
  })
  @IsOptional()
  @IsIn(PRICE_SCOPES)
  priceScope?: (typeof PRICE_SCOPES)[number] | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Identity dimension, echoed back from the load. Never edited here — see §12.',
  })
  @NullableNumber(0)
  mrp?: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Identity dimension, echoed back from the load.',
  })
  @NullableNumber(0)
  salePrice?: number | null;

  @ApiProperty({ type: SaveSellingPriceLevelDto, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SaveSellingPriceLevelDto)
  levels!: SaveSellingPriceLevelDto[];

  @ApiPropertyOptional({ type: Number, nullable: true })
  @NullableNumber(0)
  minPrice?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @NullableNumber()
  roundOff?: number | null;
}

export class SaveSellingPriceBulkDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({
    enum: PRICE_SCOPES,
    description:
      'The header radio. BRANCH = This branch, CHAIN = All branches. It is not a filter on ' +
      'what was displayed: it decides which row S1 looks for, and therefore whether the save ' +
      'updates a row or creates one. CHAIN from a non-HQ caller is a 403, never a silent ' +
      'downgrade to BRANCH.',
  })
  @IsIn(PRICE_SCOPES)
  scope!: (typeof PRICE_SCOPES)[number];

  @ApiPropertyOptional({
    default: false,
    description:
      'The below-cost round trip (§5.3). Suppresses the BELOW_COST verdict ONLY, and only when ' +
      'inventory.below_cost_price resolves to "warning". Above-MRP and below-min still abort, ' +
      'and Q26 is re-run on the confirmed post because cost moves when a purchase posts.',
  })
  @OptionalBoolean()
  confirmed?: boolean;

  @ApiProperty({
    type: SaveSellingPriceRowDto,
    isArray: true,
    description:
      'CHANGED rows only. The client knows which are dirty; the API must not have to diff four hundred rows to find twelve.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_SAVE_ROWS)
  @ValidateNested({ each: true })
  @Type(() => SaveSellingPriceRowDto)
  rows!: SaveSellingPriceRowDto[];

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @OptionalUuid()
  userId?: string;
}
