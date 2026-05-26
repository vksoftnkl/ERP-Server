import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class TenderTypeMasterErrorFieldDto {
  @ApiProperty({ example: 'ttmTypeName' })
  field!: string;
  @ApiProperty({ example: 'Duplicate ttmTypeName is not allowed' })
  message!: string;
}
export class TenderTypeMasterErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;
  @ApiProperty({ example: 'Validation failed' })
  message!: string;
  @ApiProperty({ type: TenderTypeMasterErrorFieldDto, isArray: true })
  errors!: TenderTypeMasterErrorFieldDto[];
}
export class TenderTypeMasterPayloadDto {
  @ApiProperty({ example: '1' })
  ttmTypeId!: string;
  @ApiProperty()
  ttmTypeName!: string;
  @ApiProperty()
  ttmIsActive!: boolean;
  @ApiProperty()
  ttmIsDeleted!: boolean;
  @ApiPropertyOptional({ nullable: true })
  ttmSyncDate!: string | null;
  @ApiProperty()
  ttmCreatedOn!: string;
  @ApiPropertyOptional({ nullable: true })
  ttmCreatedBy!: string | null;
  @ApiProperty()
  ttmModifiedOn!: string;
  @ApiPropertyOptional({ nullable: true })
  ttmModifiedBy!: string | null;
}
export class TenderTypeMasterDeleteResultDto {
  @ApiProperty({ example: '1' })
  ttmTypeId!: string;
  @ApiProperty({ example: true })
  deleted!: true;
}
export class TenderTypeMasterSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Tender type fetched successfully' })
  message!: string;
  @ApiProperty({ type: TenderTypeMasterPayloadDto })
  data!: TenderTypeMasterPayloadDto;
}
export class TenderTypeMasterSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Tender type deleted successfully' })
  message!: string;
  @ApiProperty({ type: TenderTypeMasterDeleteResultDto })
  data!: TenderTypeMasterDeleteResultDto;
}
