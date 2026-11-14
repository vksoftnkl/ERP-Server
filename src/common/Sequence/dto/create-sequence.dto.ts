import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { toNullableUuid, toNullableString, toOptionalNumber } from 'src/common/dto/dto-transforms';
export class CreateSequenceDto {
  @ApiProperty({ example: 1 })
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  vchrTypeId!: number;
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all')
  companyId!: string;
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all')
  branchId!: string;
  @ApiProperty({ maxLength: 9, example: '2026-27' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(9)
  accYear!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  deviceId?: string | null;
  @ApiPropertyOptional({ maxLength: 20, default: 'MAIN' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  deviceCode?: string;
  @ApiProperty({ maxLength: 20, example: '2026-27' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  periodKey!: string;
  /** seq_voucher_prefix is VarChar(60). {FY} / {BR} are expanded as the row is written. */
  @ApiPropertyOptional({
    maxLength: 60,
    nullable: true,
    description: '{FY} and {BR} are expanded as the row is written (the expanded text must fit 60).',
  })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(60)
  voucherPrefix?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(20)
  companyCode?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(20)
  branchCode?: string | null;
  @ApiPropertyOptional({
    maxLength: 20,
    nullable: true,
    description: '{FY} and {BR} are expanded as the row is written (the expanded text must fit 20).',
  })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(20)
  voucherSuffix?: string | null;
  @ApiPropertyOptional({ minimum: 1, default: 5 })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt()
  @Min(1)
  noWidth?: number;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  lastRefno?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableUuid(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  createdBy?: string | null;
}
