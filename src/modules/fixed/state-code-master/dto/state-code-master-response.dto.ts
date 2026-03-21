import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfiguredGridStyleDto } from '../../../../common/configured-grid-sql/dto/configured-grid-style.dto';

export class StateCodeMasterErrorFieldDto {
  @ApiProperty({ example: 'stateName' })
  field!: string;

  @ApiProperty({ example: 'Duplicate state name is not allowed' })
  message!: string;
}

export class StateCodeMasterErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: StateCodeMasterErrorFieldDto, isArray: true })
  errors!: StateCodeMasterErrorFieldDto[];
}

export class StateCodeMasterPayloadDto {
  @ApiProperty({ minLength: 2, maxLength: 2 })
  stateCode!: string;

  @ApiProperty({ maxLength: 100 })
  stateName!: string;

  @ApiProperty({ example: false })
  stateUt!: boolean;

  @ApiPropertyOptional({ minLength: 2, maxLength: 2, nullable: true })
  tinCode!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: false })
  isDeleted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  stateSyncDate!: string | null;

  @ApiProperty()
  createdOn!: string;

  @ApiPropertyOptional({ nullable: true })
  createdBy!: string | null;

  @ApiProperty()
  modifiedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  modifiedBy!: string | null;
}

export class StateCodeMasterListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class StateCodeMasterDeleteResultDto {
  @ApiProperty({ minLength: 2, maxLength: 2 })
  stateCode!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class StateCodeMasterSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'State code fetched successfully' })
  message!: string;

  @ApiProperty({ type: StateCodeMasterPayloadDto })
  data!: StateCodeMasterPayloadDto;
}

export class StateCodeMasterSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'State codes fetched successfully' })
  message!: string;

  @ApiProperty({ type: StateCodeMasterPayloadDto, isArray: true })
  data!: StateCodeMasterPayloadDto[];

  @ApiProperty({ type: StateCodeMasterListMetaDto })
  meta!: StateCodeMasterListMetaDto;

  @ApiPropertyOptional({ type: ConfiguredGridStyleDto, isArray: true })
  styles?: ConfiguredGridStyleDto[];
}

export class StateCodeMasterSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'State code deleted successfully' })
  message!: string;

  @ApiProperty({ type: StateCodeMasterDeleteResultDto })
  data!: StateCodeMasterDeleteResultDto;
}
