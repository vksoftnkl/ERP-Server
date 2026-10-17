import { IsEmail, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableDate,
  NullableInteger,
  NullableString,
  NullableUpperString,
  NullableUuid,
  OptionalBoolean,
  OptionalInteger,
  OptionalUpperString,
  OptionalUuid,
  RequiredUuid,
  SkipOnNullish,
} from 'src/common/dto/dtoDecorators';
import { Transform } from 'class-transformer';
import { IsString } from 'class-validator';
import { toUpperTrimmed } from 'src/common/dto/DtoTransforms';
import { SaaAddrType } from '../types/ledger-shipping-address-enum';

export class SaveLedgerShippingAddressDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing ledger shipping address',
  })
  @OptionalUuid()
  saaId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  saaCompanyId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  saaBranchId?: string | null;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  saaLedgerId!: string;

  @ApiPropertyOptional({
    enum: SaaAddrType,
    enumName: 'SaaAddrType',
    description: 'Allowed values: SHIP_TO, BILL_TO, BOTH (defaults to SHIP_TO)',
  })
  @IsOptional()
  @Transform(({ value }) => toUpperTrimmed(value))
  @IsEnum(SaaAddrType)
  saaAddrType?: SaaAddrType;

  @ApiPropertyOptional()
  @OptionalBoolean()
  saaIsDefault?: boolean;

  @ApiPropertyOptional({ minimum: 0 })
  @OptionalInteger(0)
  saaSort?: number;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  saaTradeName?: string | null;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableString(150)
  saaContactName?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  saaAddr1?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  saaAddr2?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  saaAddr3?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  saaLocation?: string | null;

  @ApiPropertyOptional({
    maxLength: 10,
    nullable: true,
    description: 'PIN code; must be 6 digits when the country is India',
  })
  @NullableString(10)
  saaPin?: string | null;

  @ApiPropertyOptional({
    maxLength: 2,
    minLength: 2,
    nullable: true,
    description: '2-digit GST numeric state code',
  })
  @NullableUpperString(2)
  saaStateCode?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  saaStateName?: string | null;

  @ApiPropertyOptional({
    maxLength: 2,
    minLength: 2,
    description: 'ISO country code (defaults to IN)',
  })
  @OptionalUpperString(2)
  saaCountryCode?: string;

  @ApiPropertyOptional({ minimum: 0, nullable: true })
  @NullableInteger(0)
  saaDistanceKm?: number | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  saaPhone?: string | null;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @IsOptional()
  @SkipOnNullish()
  @IsEmail()
  saaEmail?: string | null;

  @ApiProperty({
    maxLength: 15,
    description: 'Mandatory 15-character GSTIN',
  })
  @Transform(({ value }) => toUpperTrimmed(value))
  @IsString()
  @IsNotEmpty()
  saaGstin!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @NullableDate()
  saaSyncedOn?: Date | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  saaIsActive?: boolean;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  saaRemarks?: string | null;
}
