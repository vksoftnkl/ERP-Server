import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TenderMasterErrorFieldDto {
  @ApiProperty({ example: 'tndName' })
  field!: string;

  @ApiProperty({ example: 'Duplicate tndName is not allowed for this tender type' })
  message!: string;
}

export class TenderMasterErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: TenderMasterErrorFieldDto, isArray: true })
  errors!: TenderMasterErrorFieldDto[];
}

export class TenderMasterPayloadDto {
  @ApiProperty({ format: 'uuid' })
  tndId!: string;

  @ApiProperty({ example: '1' })
  tndTypeId!: string;

  @ApiProperty()
  tndName!: string;

  @ApiProperty({ format: 'uuid' })
  tndLedgerId!: string;

  @ApiProperty()
  tndMinAmount!: number;

  @ApiPropertyOptional({ nullable: true })
  tndMaxAmount!: number | null;

  @ApiProperty()
  tndDisplayPosition!: number;

  @ApiProperty()
  tndSurchargePerc!: number;

  @ApiProperty()
  tndIsActive!: boolean;

  @ApiProperty()
  tndIsDeleted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  tndRemarks!: string | null;

  @ApiProperty()
  tndEditSurcharge!: boolean;

  @ApiProperty()
  tndEditLedger!: boolean;

  @ApiPropertyOptional({ nullable: true })
  tndSyncDate!: string | null;

  @ApiProperty()
  tndCreatedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  tndCreatedBy!: string | null;

  @ApiProperty()
  tndModifiedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  tndModifiedBy!: string | null;
}

export class TenderMasterDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  tndId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class TenderMasterSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Tender fetched successfully' })
  message!: string;

  @ApiProperty({ type: TenderMasterPayloadDto })
  data!: TenderMasterPayloadDto;
}

export class TenderMasterSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Tender deleted successfully' })
  message!: string;

  @ApiProperty({ type: TenderMasterDeleteResultDto })
  data!: TenderMasterDeleteResultDto;
}
