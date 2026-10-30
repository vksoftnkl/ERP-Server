import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SalesErrorFieldDto, SalesErrorResponseDto } from 'src/common/utils/module-response.dto';
export { SalesErrorFieldDto as StateErrorFieldDto };
export { SalesErrorResponseDto as StateErrorResponseDto };
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
  @ApiPropertyOptional({ nullable: true })
  stmDescription!: string | null;
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
export class StateSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'State deleted successfully' })
  message!: string;
  @ApiProperty({ type: StateDeleteResultDto })
  data!: StateDeleteResultDto;
}
export class StateMasterCreateResultDto {
  @ApiProperty({ type: StatePayloadDto })
  stateMaster!: StatePayloadDto;
  @ApiProperty({ format: 'uuid', description: 'Linked account group id (equals stmId)' })
  accGroupId!: string;
}
export class StateMasterCreateSuccessDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'State created successfully' })
  message!: string;
  @ApiProperty({ type: StateMasterCreateResultDto })
  data!: StateMasterCreateResultDto;
}
