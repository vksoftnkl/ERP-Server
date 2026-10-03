import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const toRequiredString = (value: unknown): string => {
  if (typeof value !== 'string') return value as string;
  return value.trim();
};
const toOptionalString = (value: unknown): string | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  return value as string;
};

export class GetBulkItemStockListQueryDto {
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

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @Transform(({ value }) => toOptionalString(value))
  @IsUUID('all')
  isb_godown_id?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by item group' })
  @IsOptional()
  @Transform(({ value }) => toOptionalString(value))
  @IsUUID('all')
  item_group_id?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by item brand' })
  @IsOptional()
  @Transform(({ value }) => toOptionalString(value))
  @IsUUID('all')
  item_brand_id?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by item section' })
  @IsOptional()
  @Transform(({ value }) => toOptionalString(value))
  @IsUUID('all')
  item_section_id?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by item category' })
  @IsOptional()
  @Transform(({ value }) => toOptionalString(value))
  @IsUUID('all')
  item_category_id?: string;

  @ApiPropertyOptional({
    enum: ['ALL', 'NEGATIVE', 'ZERO'],
    description: 'ALL = all stocks, NEGATIVE = closing qty < 0, ZERO = closing qty = 0',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalString(value))
  @IsString()
  @IsIn(['ALL', 'NEGATIVE', 'ZERO'])
  stock_type?: 'ALL' | 'NEGATIVE' | 'ZERO';

  @ApiPropertyOptional({ example: 'SALEABLE' })
  @IsOptional()
  @Transform(({ value }) => toOptionalString(value))
  @IsString()
  @MaxLength(20)
  isb_stock_bucket?: string;

  @ApiPropertyOptional({ example: '500', description: 'Max rows to return (capped at 2000)' })
  @IsOptional()
  @Transform(({ value }) => toOptionalString(value))
  @IsString()
  limit?: string;
}
