import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfiguredGridStyleDto } from '../../../../common/configured-grid-sql/dto/configured-grid-style.dto';
import {
  SalesErrorFieldDto,
  SalesErrorResponseDto,
  SalesListMetaDto,
} from '../../utils/sales-response.dto';

export { SalesErrorFieldDto as CityErrorFieldDto };
export { SalesErrorResponseDto as CityErrorResponseDto };
export { SalesListMetaDto as CityListMetaDto };

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

export class CitySuccessListDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Cities fetched successfully' })
  message!: string;
  @ApiProperty({ type: CityPayloadDto, isArray: true })
  data!: CityPayloadDto[];
  @ApiProperty({ type: SalesListMetaDto })
  meta!: SalesListMetaDto;
  @ApiPropertyOptional({ type: ConfiguredGridStyleDto, isArray: true })
  styles?: ConfiguredGridStyleDto[];
}

export class CitySuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'City deleted successfully' })
  message!: string;
  @ApiProperty({ type: CityDeleteResultDto })
  data!: CityDeleteResultDto;
}
