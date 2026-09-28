import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  NullableStringStrict,
  NullableUuid,
  OptionalBoolean,
  OptionalInteger,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';
import { STOCK_ADJUSTMENT_KINDS, type StockAdjustmentKind } from '../stock-adjustment.rules';

export const REASON_DIRECTIONS = ['IN', 'OUT', 'BOTH'] as const;
export type ReasonDirection = (typeof REASON_DIRECTIONS)[number];

/** GET /stock/reasons — the picker (16q Q17). */
export class StockReasonPickerQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ enum: STOCK_ADJUSTMENT_KINDS, description: 'Filters by the reasons allowed on this kind.' })
  @IsIn(STOCK_ADJUSTMENT_KINDS as readonly string[])
  voucherType!: StockAdjustmentKind;

  @ApiPropertyOptional({ enum: ['IN', 'OUT'], description: 'Only reasons that move this way (BOTH always qualifies).' })
  @IsOptional()
  @IsIn(['IN', 'OUT'])
  direction?: 'IN' | 'OUT';
}

export class StockReasonListQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiPropertyOptional({ default: false, description: 'Include inactive rows.' })
  @OptionalBoolean()
  includeInactive?: boolean;
}

export class StockReasonRefQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  srmId!: string;
}

/** POST /stock/reasons — create (no srmId) or update. */
export class SaveStockReasonDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Present = update the company\'s own row; absent = create one.' })
  @OptionalUuid()
  srmId?: string;

  @ApiProperty({ format: 'uuid', description: 'The company the row belongs to. A SHARED row (company NULL) cannot be written through this route.' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ maxLength: 30, description: 'Upper-case code. Immutable once any ledger row cites the reason. The same code as a shared row HIDES the shared row for this company.' })
  @UpperMaxString(30)
  code!: string;

  @ApiProperty({ maxLength: 150 })
  @TrimmedString(150)
  name!: string;

  @ApiProperty({ enum: REASON_DIRECTIONS })
  @IsIn(REASON_DIRECTIONS as readonly string[])
  direction!: ReasonDirection;

  @ApiPropertyOptional({
    type: [String],
    description: 'Ledger txn types the reason may be cited on; empty = any. A reason that names exactly ONE issue type makes an ISSUE post that type.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  allowedTxnTypes?: string[];

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  requireRemarks?: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'The expense / income ledger the reason posts to under PERPETUAL; unset, the STOCK_SHORTAGE / STOCK_EXCESS role does.' })
  @NullableUuid()
  glLedgerId?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @OptionalInteger(0, 32000)
  sortOrder?: number;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  remarks?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  userId?: string;
}

export class DeactivateStockReasonDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  srmId!: string;

  @ApiPropertyOptional({ default: false, description: 'true re-activates.' })
  @IsOptional()
  @IsBoolean()
  reactivate?: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  userId?: string;
}
