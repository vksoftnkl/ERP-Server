import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfiguredGridStyleDto } from '../../../../common/configured-grid-sql/dto/configured-grid-style.dto';

export class AreaErrorFieldDto {
  @ApiProperty({ example: 'armName' })
  field!: string;

  @ApiProperty({ example: 'Duplicate area name is not allowed for this city' })
  message!: string;
}

export class AreaErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: AreaErrorFieldDto, isArray: true })
  errors!: AreaErrorFieldDto[];
}

export class AreaPayloadDto {
  @ApiProperty({ format: 'uuid' })
  armId!: string;

  @ApiProperty({ maxLength: 150 })
  armName!: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  armAlias!: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  armShort!: string | null;

  @ApiProperty({ format: 'uuid' })
  armCityId!: string;

  @ApiProperty({ example: 0 })
  armSort!: number;

  @ApiPropertyOptional({ nullable: true, example: 10 })
  armDistanceKm!: number | null;

  @ApiProperty({ type: [Number], example: [] })
  armCollectionDays!: number[];

  @ApiProperty({ example: true })
  armIsActive!: boolean;

  @ApiProperty({ example: false })
  armIsDeleted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  armSyncDate!: string | null;

  @ApiProperty()
  armCreatedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  armCreatedBy!: string | null;

  @ApiProperty()
  armModifiedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  armModifiedBy!: string | null;
}

export class AreaListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class AreaDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  armId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class AreaSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Area fetched successfully' })
  message!: string;

  @ApiProperty({ type: AreaPayloadDto })
  data!: AreaPayloadDto;
}

export class AreaSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Areas fetched successfully' })
  message!: string;

  @ApiProperty({ type: AreaPayloadDto, isArray: true })
  data!: AreaPayloadDto[];

  @ApiProperty({ type: AreaListMetaDto })
  meta!: AreaListMetaDto;

  @ApiPropertyOptional({ type: ConfiguredGridStyleDto, isArray: true })
  styles?: ConfiguredGridStyleDto[];
}

export class AreaSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Area deleted successfully' })
  message!: string;

  @ApiProperty({ type: AreaDeleteResultDto })
  data!: AreaDeleteResultDto;
}
