import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, Matches, ValidateIf } from 'class-validator';
import {
  NullableString,
  NullableUuid,
  OptionalBoolean,
  OptionalTrimmedString,
  OptionalUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { DevicePlatform, DeviceType } from '../types/device-list-master-enum';
const isDeviceUidRequired = (deviceType?: DeviceType): boolean => deviceType === DeviceType.DESKTOP;
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
    description: 'Required when devDeviceType is Desktop',
  })
  @ValidateIf((dto: SaveDeviceListMasterDto) =>
    isDeviceUidRequired(dto.devDeviceType ?? DeviceType.DESKTOP),
  )
  @TrimmedString(120)
  @IsNotEmpty({ message: 'devDeviceUid is required when devDeviceType is Desktop' })
  devDeviceUid?: string;
  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @NullableString(120)
  devDeviceName?: string | null;

  @ApiPropertyOptional({
    maxLength: 10,
    nullable: true,
    example: 'D1',
    description:
      'Notes 160 C — the short code stock voucher numbers carry (TRF/2026-2027/D1/00016). Letters, digits, - and _, stored upper-case; unique across every device, deleted ones included (409 DEVICE_CODE_DUPLICATE). Blank on a new device: the next D1, D2, … is given. Blank or omitted on an update keeps the current code — a device always has one.',
  })
  @NullableString(10)
  @Matches(/^[A-Za-z0-9_-]{1,10}$/, {
    message: 'devCode may hold only letters, digits, - and _ (at most 10)',
  })
  devCode?: string | null;
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
