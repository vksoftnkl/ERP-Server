import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
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
export class GetItemStockBalanceQueryDto {
  @ApiProperty({ maxLength: 9, example: '2025-2026' })
  @Transform(({ value }) => toRequiredString(value))
  @IsString()
  @MaxLength(9)
  isb_acc_year!: string;
  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredString(value))
  @IsUUID('all')
  isb_company_id!: string;
  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredString(value))
  @IsUUID('all')
  isb_branch_id!: string;
  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredString(value))
  @IsUUID('all')
  isb_godown_id!: string;
  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredString(value))
  @IsUUID('all')
  isb_item_id!: string;
  @ApiProperty({ format: 'uuid' })
  @Transform(({ value }) => toRequiredString(value))
  @IsUUID('all')
  isb_unit_id!: string;
  @ApiPropertyOptional({
    example: 'SALEABLE',
    description: 'Optional stock bucket filter. Omit to return all matching buckets.',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalString(value))
  @IsString()
  @MaxLength(20)
  isb_stock_bucket?: string;
}