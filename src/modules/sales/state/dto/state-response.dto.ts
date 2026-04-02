import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfiguredGridStyleDto } from '../../../../common/configured-grid-sql/dto/configured-grid-style.dto';

export class StateErrorFieldDto {
  @ApiProperty({ example: 'stmName' })
  field!: string;

  @ApiProperty({ example: 'Duplicate state name is not allowed' })
  message!: string;
}

export class StateErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: StateErrorFieldDto, isArray: true })
  errors!: StateErrorFieldDto[];
}

export class StatePayloadDto {
  @ApiProperty({ format: 'uuid' })
  stmId!: string;

  @ApiProperty({ maxLength: 150 })
  stmName!: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  stmAlias!: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  stmShort!: string | null;

  @ApiProperty({ example: 0 })
  stmOrder!: number;

  @ApiProperty({ example: true })
  stmIsActive!: boolean;

  @ApiProperty({ example: false })
  stmIsDeleted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  stmSyncDate!: string | null;

  @ApiProperty()
  stmCreatedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  stmCreatedBy!: string | null;

  @ApiProperty()
  stmModifiedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  stmModifiedBy!: string | null;
}

export class StateListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class StateDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  stmId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class StateSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'State fetched successfully' })
  message!: string;

  @ApiProperty({ type: StatePayloadDto })
  data!: StatePayloadDto;
}

export class StateSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'States fetched successfully' })
  message!: string;

  @ApiProperty({ type: StatePayloadDto, isArray: true })
  data!: StatePayloadDto[];

  @ApiProperty({ type: StateListMetaDto })
  meta!: StateListMetaDto;

  @ApiPropertyOptional({ type: ConfiguredGridStyleDto, isArray: true })
  styles?: ConfiguredGridStyleDto[];
}

export class StateSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'State deleted successfully' })
  message!: string;

  @ApiProperty({ type: StateDeleteResultDto })
  data!: StateDeleteResultDto;
}
