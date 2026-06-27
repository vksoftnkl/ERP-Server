import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SalesErrorFieldDto,
  SalesErrorResponseDto,
} from 'src/common/utils/module-response.dto';

export { SalesErrorFieldDto as CityErrorFieldDto };
export { SalesErrorResponseDto as CityErrorResponseDto };

export class CityPayloadDto {
  @ApiProperty({ format: 'uuid' })
  ctmId!: string;
  @ApiProperty({ maxLength: 150 })
  ctmName!: string;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  ctmAlias!: string | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  ctmShort!: string | null;
  @ApiProperty({ format: 'uuid' })
  ctmStateId!: string;
  @ApiPropertyOptional({
    nullable: true,
    example: 'Tamil Nadu',
    description: 'Name of the linked state (resolved on the get endpoint)',
  })
  ctmStateName?: string | null;
  @ApiProperty({ example: 0 })
  ctmOrder!: number;
  @ApiProperty({ example: true })
  ctmIsActive!: boolean;
  @ApiProperty({ example: false })
  ctmIsDeleted!: boolean;
  @ApiPropertyOptional({ nullable: true })
  ctmSyncDate!: string | null;
  @ApiProperty()
  ctmCreatedOn!: string;
  @ApiPropertyOptional({ nullable: true })
  ctmCreatedBy!: string | null;
  @ApiProperty()
  ctmModifiedOn!: string;
  @ApiPropertyOptional({ nullable: true })
  ctmModifiedBy!: string | null;
}

export class CityDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  ctmId!: string;
  @ApiProperty({ example: true })
  deleted!: true;
}

export class CitySuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'City fetched successfully' })
  message!: string;
  @ApiProperty({ type: CityPayloadDto })
  data!: CityPayloadDto;
}


export class CitySuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'City deleted successfully' })
  message!: string;
  @ApiProperty({ type: CityDeleteResultDto })
  data!: CityDeleteResultDto;
}

export class CityMasterCreateResultDto {
  @ApiProperty({ type: CityPayloadDto })
  cityMaster!: CityPayloadDto;
  @ApiProperty({ format: 'uuid', description: 'Linked account group id (equals ctmId)' })
  accGroupId!: string;
}

export class CityMasterCreateSuccessDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'City created successfully' })
  message!: string;
  @ApiProperty({ type: CityMasterCreateResultDto })
  data!: CityMasterCreateResultDto;
}
