import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class BranchMasterErrorFieldDto {
  @ApiProperty({ example: 'brName' })
  field!: string;
  @ApiProperty({ example: 'Duplicate brName is not allowed for this company' })
  message!: string;
}
export class BranchMasterErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;
  @ApiProperty({ example: 'Validation failed' })
  message!: string;
  @ApiProperty({ type: BranchMasterErrorFieldDto, isArray: true })
  errors!: BranchMasterErrorFieldDto[];
}

export class BranchMasterPayloadDto {
  @ApiProperty({ example: '018e1b2c-3d4e-7f8a-9b0c-1d2e3f4a5b6c' })
  brId!: string;

  @ApiProperty({ example: '019cc885-d0f4-771b-a7d1-7c98f9ff3ac1' })
  brCompId!: string;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Acme Pvt Ltd',
    description: 'Name of the linked company (resolved on the get endpoint)',
  })
  brCompName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  brCode!: string | null;

  @ApiProperty()
  brName!: string;

  @ApiPropertyOptional({ nullable: true })
  brMailingName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brAlias!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brShort!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brType!: string | null;

  @ApiProperty()
  brIsDefault!: boolean;

  @ApiProperty()
  brIsActive!: boolean;

  @ApiPropertyOptional({ nullable: true })
  brAddr1!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brAddr2!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brAddr3!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brCity!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brDistrict!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brState!: string | null;

  @ApiProperty()
  brStateCode!: string;

  @ApiPropertyOptional({ nullable: true })
  brPin!: number | null;

  @ApiProperty()
  brCountry!: string;

  @ApiPropertyOptional({ nullable: true })
  brLandmark!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brRegionAddr1!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brRegionAddr2!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brRegionAddr3!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brRegionCity!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brRegionDistrict!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brRegionState!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brRegionCountry!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brRegionName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brContactPerson!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brTel!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brPhone!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brMail!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brBillPrefix!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brInvoiceSeriesPrefix!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brBillGreeting!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brTerms!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brRoundingMode!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brRoundingValue!: number | null;

  @ApiPropertyOptional({ nullable: true })
  brDefaultGodownId!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Main Warehouse',
    description: 'Name of the default godown (resolved on the get endpoint)',
  })
  brDefaultGodownName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  brPosType!: string | null;

  @ApiProperty()
  brAllowNegativeStock!: boolean;

  @ApiProperty()
  brSmsApplicable!: boolean;

  @ApiPropertyOptional({ nullable: true })
  brBankId!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'HDFC Bank',
    description: 'Name of the linked bank (resolved on the get endpoint)',
  })
  brBankName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  brFssaiNo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brFssaiLicenseType!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brFssaiValidUpto!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brGstinNo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brGstRegType!: string | null;

  @ApiPropertyOptional({ nullable: true })
  brPanNo!: string | null;

  @ApiProperty()
  brIsDeleted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  brSyncDate!: string | null;

  @ApiProperty()
  brCreatedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  brCreatedBy!: string | null;

  @ApiProperty()
  brModifiedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  brModifiedBy!: string | null;
}

export class BranchMasterDeleteResultDto {
  @ApiProperty({ example: '018e1b2c-3d4e-7f8a-9b0c-1d2e3f4a5b6c' })
  brId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class BranchMasterSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Branch fetched successfully' })
  message!: string;

  @ApiProperty({ type: BranchMasterPayloadDto })
  data!: BranchMasterPayloadDto;
}

export class BranchMasterSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Branch deleted successfully' })
  message!: string;

  @ApiProperty({ type: BranchMasterDeleteResultDto })
  data!: BranchMasterDeleteResultDto;
}
