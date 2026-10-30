import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches } from 'class-validator';
import {
  NullableInteger,
  NullableStringStrict,
  OptionalBoolean,
  OptionalInteger,
  OptionalTrimmedString,
  OptionalUpperMaxString,
  OptionalUuid,
  RequiredUuid,
} from 'src/common/dto/dtoDecorators';

export const PRESET_VALUATION_METHODS = ['WAVG', 'FIFO', 'LOT_ACTUAL'] as const;
export const PRESET_ISSUE_STRATEGIES = ['FIFO', 'FEFO', 'LIFO', 'MANUAL'] as const;
export const PRESET_ALLOW_NEGATIVE = ['ALLOW', 'WARN', 'BLOCK'] as const;
export const PRESET_AGEING_BASES = ['INWARD_DATE', 'MFG_DATE', 'LAST_IN_DATE'] as const;

export type PresetValuationMethod = (typeof PRESET_VALUATION_METHODS)[number];
export type PresetIssueStrategy = (typeof PRESET_ISSUE_STRATEGIES)[number];
export type PresetAllowNegative = (typeof PRESET_ALLOW_NEGATIVE)[number];
export type PresetAgeingBasis = (typeof PRESET_AGEING_BASES)[number];

/** The six flags that decide how an item's stock splits into lots — locked once the preset is used. */
export const PRESET_TRACK_FIELDS = [
  'trackBatch',
  'trackMrp',
  'trackSalePrice',
  'trackExpiry',
  'trackSerial',
  'trackSupplier',
] as const;
export type PresetTrackField = (typeof PRESET_TRACK_FIELDS)[number];

/**
 * POST /stock-track-presets/save (notes 159 §4) — create (no sptId) or update
 * the company's OWN preset. A shared preset (company NULL) is never written
 * here: the company creates its own with the same code, which overrides it.
 *
 * On an update, a field left out keeps its stored value (null clears a
 * nullable one); on a create it takes the column default. valuationMethod may
 * be left out: it follows from the flags (LOT_ACTUAL when anything is
 * tracked, else WAVG), and a value that disagrees is a 422.
 */
export class SaveStockTrackPresetDto {
  @ApiPropertyOptional({ format: 'uuid', description: "Present = update the company's own preset; absent = create one." })
  @OptionalUuid()
  sptId?: string;

  @ApiProperty({ format: 'uuid', description: 'The company the preset belongs to.' })
  @RequiredUuid()
  companyId!: string;

  @ApiPropertyOptional({
    maxLength: 30,
    example: 'DAIRY',
    description:
      'Upper-cased; letters, digits, _ and -. Required on a create. The code of a shared preset OVERRIDES it for this company. Unique per company; locked once the preset is used.',
  })
  @OptionalUpperMaxString(30)
  @Matches(/^[A-Z0-9_-]+$/, { message: 'code may hold only letters, digits, _ and -' })
  code?: string;

  @ApiPropertyOptional({ maxLength: 150, description: 'Required on a create.' })
  @OptionalTrimmedString(150)
  name?: string;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  description?: string | null;

  @ApiPropertyOptional({ description: 'Locked once used.' })
  @OptionalBoolean()
  trackBatch?: boolean;

  @ApiPropertyOptional({ description: 'Locked once used.' })
  @OptionalBoolean()
  trackMrp?: boolean;

  @ApiPropertyOptional({ description: 'Locked once used.' })
  @OptionalBoolean()
  trackSalePrice?: boolean;

  @ApiPropertyOptional({ description: 'Needs trackBatch. Locked once used.' })
  @OptionalBoolean()
  trackExpiry?: boolean;

  @ApiPropertyOptional({ description: 'Locked once used.' })
  @OptionalBoolean()
  trackSerial?: boolean;

  @ApiPropertyOptional({ description: 'Locked once used.' })
  @OptionalBoolean()
  trackSupplier?: boolean;

  @ApiPropertyOptional({
    enum: PRESET_VALUATION_METHODS,
    description: 'LOT_ACTUAL when any flag is on, else WAVG; derived when left out. Locked once used.',
  })
  @IsOptional()
  @IsIn(PRESET_VALUATION_METHODS as readonly string[])
  valuationMethod?: PresetValuationMethod;

  @ApiPropertyOptional({
    enum: PRESET_ISSUE_STRATEGIES,
    description: 'FEFO needs trackExpiry when batches are tracked. Default on a create: FEFO, or FIFO when batches are tracked without expiry.',
  })
  @IsOptional()
  @IsIn(PRESET_ISSUE_STRATEGIES as readonly string[])
  issueStrategy?: PresetIssueStrategy;

  @ApiPropertyOptional({ enum: PRESET_ALLOW_NEGATIVE, description: 'Default ALLOW.' })
  @IsOptional()
  @IsIn(PRESET_ALLOW_NEGATIVE as readonly string[])
  allowNegative?: PresetAllowNegative;

  @ApiPropertyOptional({ minimum: 1, nullable: true, description: 'null = no shelf life.' })
  @NullableInteger(1)
  shelfLifeDays?: number | null;

  @ApiPropertyOptional({ minimum: 0, description: 'Default 30.' })
  @OptionalInteger(0)
  nearExpiryDays?: number;

  @ApiPropertyOptional({ description: 'Default false.' })
  @OptionalBoolean()
  blockExpiredSale?: boolean;

  @ApiPropertyOptional({ enum: PRESET_AGEING_BASES, description: 'Default INWARD_DATE.' })
  @IsOptional()
  @IsIn(PRESET_AGEING_BASES as readonly string[])
  ageingBasis?: PresetAgeingBasis;

  @ApiPropertyOptional({ description: 'Default 0.' })
  @OptionalInteger()
  sortOrder?: number;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  remarks?: string | null;
}

/** POST /stock-track-presets/deactivate (notes 159 §4). */
export class DeactivateStockTrackPresetDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sptId!: string;

  @ApiPropertyOptional({ default: false, description: 'true = reactivate instead.' })
  @OptionalBoolean()
  reactivate?: boolean;
}
