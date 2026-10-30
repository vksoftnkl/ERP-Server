import { Transform } from 'class-transformer';
import { IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const toRequiredTrimmedString = (value: unknown): string => {
  if (typeof value !== 'string') {
    return value as string;
  }

  return value.trim();
};

const toNullableTrimmedString = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return value as string;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export class SaveBatchPrefixDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing batch prefix',
  })
  @IsOptional()
  @IsUUID('all')
  id?: string;

  @ApiProperty({ description: 'Prefix value to track for batch generation' })
  @Transform(({ value }) => toRequiredTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  prefixUsed!: string;

  @ApiPropertyOptional({
    nullable: true,
    format: 'date-time',
    description: 'Optional sync timestamp. Send null to clear it on update.',
  })
  @IsOptional()
  @Transform(({ value }) => toNullableTrimmedString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsISO8601()
  syncDate?: string | null;
}
