import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfiguredGridStyleDto } from '../../../../common/configured-grid-sql/dto/configured-grid-style.dto';
import {
  FixedErrorFieldDto,
  FixedErrorResponseDto,
  FixedListMetaDto,
} from 'src/common/utils/module-response.dto';
import { DevicePlatform, DeviceType } from '../types/device-list-master-enum';
export { FixedErrorFieldDto as DeviceListMasterErrorFieldDto };
export { FixedErrorResponseDto as DeviceListMasterErrorResponseDto };
export { FixedListMetaDto as DeviceListMasterListMetaDto };
export class DeviceListMasterPayloadDto {
  @ApiProperty({ format: 'uuid' })
  devId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  devCompanyId!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  devBranchId!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  devUserId!: string | null;
  @ApiProperty({ maxLength: 120 })
  devDeviceUid!: string;
  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  devDeviceName!: string | null;
  @ApiProperty({ enum: DeviceType, enumName: 'DeviceListMasterDeviceType', maxLength: 30 })
  devDeviceType!: DeviceType;
  @ApiPropertyOptional({
    enum: DevicePlatform,
    enumName: 'DeviceListMasterDevicePlatform',
    maxLength: 30,
    nullable: true,
  })
  devPlatform!: DevicePlatform | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  devMacAddress!: string | null;
  @ApiProperty({ example: false })
  devIsBlocked!: boolean;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  devBlockReason!: string | null;
  @ApiPropertyOptional({ nullable: true })
  devLastIp!: string | null;
  @ApiProperty({ example: true })
  devIsActive!: boolean;
  @ApiProperty({ example: false })
  devIsDeleted!: boolean;
  @ApiPropertyOptional({ nullable: true })
  devSyncDate!: string | null;
  @ApiProperty()
  devCreatedOn!: string;
  @ApiPropertyOptional({ nullable: true })
  devCreatedBy!: string | null;
  @ApiPropertyOptional({ nullable: true })
  devModifiedOn!: string | null;
  @ApiPropertyOptional({ nullable: true })
  devModifiedBy!: string | null;
}
export class DeviceListMasterDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  devId!: string;
  @ApiProperty({ example: true })
  deleted!: true;
}
export class DeviceListMasterSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Device fetched successfully' })
  message!: string;
  @ApiProperty({ type: DeviceListMasterPayloadDto })
  data!: DeviceListMasterPayloadDto;
}
export class DeviceListMasterSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Devices fetched successfully' })
  message!: string;
  @ApiProperty({ type: DeviceListMasterPayloadDto, isArray: true })
  data!: DeviceListMasterPayloadDto[];
  @ApiProperty({ type: FixedListMetaDto })
  meta!: FixedListMetaDto;
  @ApiPropertyOptional({ type: ConfiguredGridStyleDto, isArray: true })
  styles?: ConfiguredGridStyleDto[];
}
export class DeviceListMasterSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Device deleted successfully' })
  message!: string;
  @ApiProperty({ type: DeviceListMasterDeleteResultDto })
  data!: DeviceListMasterDeleteResultDto;
}
