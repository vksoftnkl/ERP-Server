import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  NullableInteger,
  NullableNumber,
  RequiredInteger,
  RequiredNumber,
  RequiredUuid,
} from 'src/common/dto/dtoDecorators';
import { MAX_COST_BULK_ROWS, PROFIT_TYPES } from '../types/cost-price-bulk.types';

export class CostBulkLevelInputDto {
  @ApiProperty({ minimum: 1, maximum: 4, description: 'Price level 1–4 → ipm_sales_price_a … d.' })
  @RequiredInteger(1, 4)
  level!: number;

  @ApiProperty({
    example: 167.5,
    description:
      'The new shelf price, tax inclusive, as the client computed it (rule, round-up, or typed). ' +
      'Written as sent; its w/o-tax figure and markup are recomputed from it and the new cost.',
  })
  @RequiredNumber(0)
  price!: number;
}

export class CostBulkRowInputDto {
  @ApiProperty({
    minimum: 1,
    description: 'The grid line (1-based). Every note names it as `line`; overrides[] match on it.',
  })
  @RequiredInteger(1)
  lineNo!: number;

  @ApiProperty({ format: 'uuid', description: "The price row loaded (the GET row's ipmId)." })
  @RequiredUuid()
  ipmId!: string;

  @ApiProperty({
    example: '6f1d0c2b9a7e4d0e8b1f2a3c4d5e6f70',
    description:
      "The GET row's rowToken, sent back unchanged — md5 of the row's business columns. Differs → " +
      'COST_BULK_ROW_CHANGED (someone changed the row since it was loaded).',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  rowToken!: string;

  @ApiProperty({
    example: 152,
    description:
      'The new cost of one of this unit, tax inclusive. Send the loaded cost when it is not changing.',
  })
  @RequiredNumber(0)
  costPrice!: number;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 199,
    description:
      'New MRP (ipm_max_price) for this unit only. Absent / null = unchanged. 0 = no MRP.',
  })
  @NullableNumber(0)
  mrp?: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'New Min (ipm_min_price). Absent / null = unchanged.',
  })
  @NullableNumber(0)
  minPrice?: number | null;

  @ApiPropertyOptional({
    enum: PROFIT_TYPES,
    nullable: true,
    description: "The unit's rule, saved to ipm_profit_type. Absent / null = unchanged.",
  })
  @IsOptional()
  @IsIn(PROFIT_TYPES)
  profitType?: (typeof PROFIT_TYPES)[number] | null;

  @ApiPropertyOptional({
    type: CostBulkLevelInputDto,
    isArray: true,
    description:
      'New prices. A level not sent keeps its stored price (its markup is still recomputed against the new cost).',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ArrayUnique((level: CostBulkLevelInputDto) => level.level)
  @ValidateNested({ each: true })
  @Type(() => CostBulkLevelInputDto)
  levels?: CostBulkLevelInputDto[];
}

export class CostBulkOverrideDto {
  @ApiProperty({
    example: 'COST_BULK_BELOW_COST',
    description: 'A warning code: COST_BULK_BELOW_COST or COST_BULK_BY_USER_PRICES_KEPT.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  code!: string;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 6,
    description:
      'The line the tick is for. Absent / null = every line with that code (NexWarningStrip.overrides() sends codes only).',
  })
  @NullableInteger(1)
  line?: number | null;
}

/** POST /stock/cost-bulk/validate and POST /stock/cost-bulk — plan §3's body. */
export class SaveCostPriceBulkDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid', description: 'The branch the rows were loaded at.' })
  @RequiredUuid()
  branchId!: string;

  @ApiPropertyOptional({
    type: CostBulkOverrideDto,
    isArray: true,
    description:
      'The warnings ticked in the NexWarningStrip popup. Ticking needs only the menu 298 Edit right.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CostBulkOverrideDto)
  overrides?: CostBulkOverrideDto[];

  @ApiProperty({
    type: CostBulkRowInputDto,
    isArray: true,
    description: `The CHANGED rows, at most ${MAX_COST_BULK_ROWS} (more → 422 COST_BULK_TOO_MANY_ROWS; the client saves in parts). One price row once.`,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique((row: CostBulkRowInputDto) => row.ipmId)
  @ValidateNested({ each: true })
  @Type(() => CostBulkRowInputDto)
  rows!: CostBulkRowInputDto[];
}
