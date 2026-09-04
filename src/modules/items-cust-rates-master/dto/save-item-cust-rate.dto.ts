import { Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableDateString,
  NullableString,
  NullableUuid,
  NullableUpperString,
  OptionalInteger,
  OptionalNumber,
  OptionalQueryBoolean,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredUuid,
  SkipOnNullish,
} from '../../../common/dto/dtoDecorators';

export class SaveItemCustRateDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing customer item rate row',
  })
  @OptionalUuid()
  csr_id?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  csr_branch_id?: string | null;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  csr_customer_id!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  csr_unit_rate_id!: string;

  @ApiPropertyOptional({ maxLength: 20, default: 'FIXED' })
  @OptionalTrimmedString(20)
  csr_rate_type?: string;

  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  csr_item_rate?: number;

  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  csr_disc_perc?: number;

  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  csr_disc_qty?: number;

  @ApiPropertyOptional({ maxLength: 1, nullable: true, description: 'A/B/C/D' })
  @NullableUpperString(1)
  @SkipOnNullish()
  @Matches(/^[A-D]$/, { message: 'csr_price_level must be one of A, B, C, D' })
  csr_price_level?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @NullableDateString()
  csr_valid_from?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @NullableDateString()
  csr_valid_to?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @OptionalInteger()
  csr_priority?: number;

  @ApiPropertyOptional({ default: true })
  @OptionalQueryBoolean()
  csr_is_active?: boolean;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  csr_created_by?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  csr_modified_by?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @NullableDateString()
  csr_uploaded_at?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  csr_uploaded_by?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  csr_remarks?: string | null;
}
