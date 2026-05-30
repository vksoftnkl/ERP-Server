import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FixedErrorFieldDto,
  FixedErrorResponseDto,
  FixedListMetaDto,
} from 'src/common/utils/module-response.dto';
export { FixedErrorFieldDto as StateCodeMasterErrorFieldDto };
export { FixedErrorResponseDto as StateCodeMasterErrorResponseDto };
export { FixedListMetaDto as StateCodeMasterListMetaDto };
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
  @ApiProperty({ type: FixedListMetaDto })
  meta!: FixedListMetaDto;
}
export class StateCodeMasterSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'State code deleted successfully' })
  message!: string;
  @ApiProperty({ type: StateCodeMasterDeleteResultDto })
  data!: StateCodeMasterDeleteResultDto;
}