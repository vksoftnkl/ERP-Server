import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfiguredGridStyleDto } from '../../../../common/configured-grid-sql/dto/configured-grid-style.dto';
import {
  SalesErrorFieldDto,
  SalesErrorResponseDto,
  SalesListMetaDto,
} from 'src/common/utils/module-response.dto';

export { SalesErrorFieldDto as StateErrorFieldDto };
export { SalesErrorResponseDto as StateErrorResponseDto };
export { SalesListMetaDto as StateListMetaDto };

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

  @ApiProperty({ type: SalesListMetaDto })
  meta!: SalesListMetaDto;

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
