import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIP, IsNotEmpty } from 'class-validator';

import {
  NullableString,
  NullableUuid,
  OptionalBoolean,
  OptionalUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';

export class SaveDeviceListMasterDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing device row',
  })
  @OptionalUuid()
  devId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  devCompanyId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  devBranchId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  devUserId?: string | null;

  @ApiProperty({ maxLength: 120 })
  @TrimmedString(120)
  @IsNotEmpty()
  devDeviceUid!: string;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @NullableString(120)
  devDeviceName?: string | null;

  @ApiProperty({ maxLength: 30 })
  @TrimmedString(30)
  @IsNotEmpty()
  devDeviceType!: string;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @NullableString(30)
  devPlatform?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableString(50)
  devMacAddress?: string | null;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  devIsBlocked?: boolean;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  devBlockReason?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'IPv4 or IPv6 address' })
  @NullableString()
  @IsIP()
  devLastIp?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  devIsActive?: boolean;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  devCreatedBy?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  devModifiedBy?: string | null;
}
