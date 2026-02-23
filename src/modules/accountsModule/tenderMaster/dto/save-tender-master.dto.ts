import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const toNullableString = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toNullableNumber = (value: unknown): number | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : (value as number);
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : (value as number);
};

export class SaveTenderMasterDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing tender',
  })
  @IsOptional()
  @IsUUID('all')
  tndId?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('all')
  tndTypeId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tndName!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('all')
  tndLedgerId!: string;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  tndMinAmount!: number;

  @ApiPropertyOptional({ nullable: true, minimum: 0 })
  @IsOptional()
  @Transform(({ value }) => toNullableNumber(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  tndMaxAmount?: number | null;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt()
  @Min(0)
  tndDisplayPosition?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  tndSurchargePerc?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  tndIsActive?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  tndRemarks?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  tndEditSurcharge?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  tndEditLedger?: boolean;
}
