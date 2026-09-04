import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const toRequiredString = (value: unknown): string => {
  if (typeof value !== 'string') {
    return value as string;
  }
  return value.trim();
};

const toOptionalString = (value: unknown): string | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  return value as string;
};

const toOptionalBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }
  return value as boolean;
};

export class GetItemBatchStockQueryDto {
  @ApiProperty({ maxLength: 9, example: '2025-2026' })
  @Transform(({ value }) => toRequiredString(value))
  @IsString()
  @MaxLength(9)
  ibs_acc_year!: string;

  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredString(value))
  @IsUUID('all')
  ibs_company_id!: string;

  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredString(value))
  @IsUUID('all')
  ibs_branch_id!: string;

  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredString(value))
  @IsUUID('all')
  ibs_godown_id!: string;

  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredString(value))
  @IsUUID('all')
  ibs_item_id!: string;

  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredString(value))
  @IsUUID('all')
  ibs_unit_id!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @Transform(({ value }) => toOptionalString(value))
  @IsUUID('all')
  ibs_batch_id?: string;

  @ApiPropertyOptional({
    example: 'SALEABLE',
    description: 'Optional stock bucket filter. Omit to return all matching buckets.',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalString(value))
  @IsString()
  @MaxLength(20)
  ibs_stock_bucket?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Defaults to true.' })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  ibs_is_active?: boolean;

  @ApiPropertyOptional({ type: Boolean, description: 'Defaults to false.' })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  ibs_is_deleted?: boolean;

  @ApiPropertyOptional({
    example: 'BATCH-001',
    description: 'Searches batch no, serial no, manufacturing batch no, and barcode.',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalString(value))
  @IsString()
  @MaxLength(100)
  search?: string;
}
