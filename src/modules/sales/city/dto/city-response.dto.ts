import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CityErrorFieldDto {
  @ApiProperty({ example: 'ctmName' })
  field!: string;

  @ApiProperty({ example: 'Duplicate city name is not allowed for this state' })
  message!: string;
}

export class CityErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: CityErrorFieldDto, isArray: true })
  errors!: CityErrorFieldDto[];
}

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

export class CityListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
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

  @ApiProperty({ type: CityListMetaDto })
  meta!: CityListMetaDto;
}

export class CitySuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'City deleted successfully' })
  message!: string;

  @ApiProperty({ type: CityDeleteResultDto })
  data!: CityDeleteResultDto;
}
