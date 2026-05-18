import { IsEmail, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableDate,
  NullableInteger,
  NullableString,
  NullableUpperString,
  OptionalBoolean,
  OptionalInteger,
  OptionalUuid,
  RequiredUuid,
  SkipOnNullish,
} from 'src/common/dto/dtoDecorators';
import { Transform } from 'class-transformer';
import { IsString } from 'class-validator';
import { toUpperTrimmed } from 'src/common/dto/DtoTransforms';

export class SaveLedgerShippingAddressDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing ledger shipping address',
  })
  @OptionalUuid()
  saaId?: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @NullableInteger()
  saaCompanyId?: number | null;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  saaLedgerId!: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @Transform(({ value }) => toUpperTrimmed(value))
  @IsString()
  saaAddrType?: string;

  @ApiPropertyOptional()
  @OptionalBoolean()
  saaIsDefault?: boolean;

  @ApiPropertyOptional({ minimum: 0 })
  @OptionalInteger(0)
  saaSort?: number;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  saaTrdnm?: string | null;

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
  saaLoc?: string | null;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableString(10)
  saaPin?: string | null;

  @ApiPropertyOptional({ maxLength: 2, minLength: 2, nullable: true })
  @NullableUpperString(2)
  saaStateCode?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  saaStateName?: string | null;

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

  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  @NullableString(15)
  saaGstin?: string | null;

  @ApiPropertyOptional({ maxLength: 10, minLength: 10, nullable: true })
  @NullableUpperString(10)
  saaPan?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @NullableDate()
  saaSyncDate?: Date | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  saaIsActive?: boolean;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  saaRemarks?: string | null;
}
