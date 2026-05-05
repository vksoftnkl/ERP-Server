import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : (value as number);
};
const toOptionalTrimmedString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    return value as string;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
};
export class ListItemTaxHistoryQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all')
  ith_item_id?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all')
  ith_tax_id?: string;
  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @IsDateString()
  ith_effective_from?: string;
  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @IsDateString()
  ith_effective_to?: string;
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @IsString()
  @MaxLength(120)
  search?: string;
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt()
  @Min(1)
  page?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
