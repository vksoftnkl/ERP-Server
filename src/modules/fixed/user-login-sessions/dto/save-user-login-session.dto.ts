import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIP } from 'class-validator';
import {
  NullableDate,
  NullableString,
  NullableUuid,
  OptionalBoolean,
  OptionalDate,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredUuid,
} from 'src/common/dto/dtoDecorators';

export class SaveUserLoginSessionDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing user login session row',
  })
  @OptionalUuid()
  ulsId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  ulsCompanyId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  ulsBranchId?: string | null;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  ulsUserId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  ulsDeviceId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  ulsSessionId?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  ulsSessionToken?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableString(200)
  ulsRefreshTokenId?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @OptionalDate()
  ulsLoginOn?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @NullableDate()
  ulsLogoutOn?: Date | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  ulsLogoutType?: string | null;

  @ApiPropertyOptional({ maxLength: 20, default: 'SUCCESS' })
  @OptionalTrimmedString(20)
  ulsLoginStatus?: string;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  ulsFailReason?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  @IsIP()
  ulsIpAddress?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  ulsUserAgent?: string | null;

  @ApiPropertyOptional({ maxLength: 40, nullable: true })
  @NullableString(40)
  ulsAppVersion?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  ulsIsActiveSession?: boolean;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  ulsIsActive?: boolean;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  ulsCreatedBy?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  ulsModifiedBy?: string | null;
}
