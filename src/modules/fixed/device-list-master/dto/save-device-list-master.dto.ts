import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIP, IsNotEmpty, ValidateIf } from 'class-validator';
import {
  NullableString,
  NullableUuid,
  OptionalBoolean,
  OptionalTrimmedString,
  OptionalUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { DevicePlatform, DeviceType } from '../types/device-list-master-enum';
const isDeviceUidRequired = (deviceType?: DeviceType): boolean =>
  deviceType === DeviceType.DESKTOP || deviceType === DeviceType.MOBILE;
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
  @ApiPropertyOptional({
    maxLength: 120,
    description: 'Required when devDeviceType is Desktop or Mobile',
  })
  @ValidateIf((dto: SaveDeviceListMasterDto) => isDeviceUidRequired(dto.devDeviceType ?? DeviceType.DESKTOP))
  @TrimmedString(120)
  @IsNotEmpty({ message: 'devDeviceUid is required when devDeviceType is Desktop or Mobile' })
  devDeviceUid?: string;
  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @NullableString(120)
  devDeviceName?: string | null;
  @ApiPropertyOptional({ enum: DeviceType, enumName: 'DeviceListMasterDeviceType', maxLength: 30 })
  @OptionalTrimmedString(30)
  @IsEnum(DeviceType)
  devDeviceType?: DeviceType;
  @ApiPropertyOptional({
    enum: DevicePlatform,
    enumName: 'DeviceListMasterDevicePlatform',
    maxLength: 30,
    nullable: true,
  })
  @NullableString(30)
  @IsEnum(DevicePlatform)
  devPlatform?: DevicePlatform | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableString(50)
  devMacAddress?: string | null;
  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  devIsBlocked?: boolean;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  devBlockReason?: string | null;
  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  devIsActive?: boolean;
  @ApiPropertyOptional({ maxLength: 100, nullable: false })
  @NullableString(100)
  devEntryBy?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  devcreatedOrModifiedBy?: string | null;
}