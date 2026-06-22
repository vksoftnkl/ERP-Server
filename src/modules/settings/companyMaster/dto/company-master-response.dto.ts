import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class CompanyMasterErrorFieldDto {
  @ApiProperty({ example: 'compName' })
  field!: string;

  @ApiProperty({ example: 'Duplicate compName is not allowed' })
  message!: string;
}
export class CompanyMasterErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: CompanyMasterErrorFieldDto, isArray: true })
  errors!: CompanyMasterErrorFieldDto[];
}
export class CompanyMasterPayloadDto {
  @ApiProperty({ example: '019cc885-d0f4-771b-a7d1-7c98f9ff3ac1' })
  compId!: string;

  @ApiPropertyOptional({ nullable: true })
  compCode!: string | null;

  @ApiProperty()
  compName!: string;

  @ApiPropertyOptional({ nullable: true })
  compShort!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compLegalName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compGstinNo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compGstRegType!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compPanNo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compTanNo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compCinNo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compFssaiNo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compDrugLicenseNo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compAddr1!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compAddr2!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compAddr3!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compCity!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compDistrict!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compState!: string | null;

  @ApiProperty()
  compStateCode!: string;

  @ApiPropertyOptional({ nullable: true })
  compPin!: number | null;

  @ApiProperty()
  compCountry!: string;

  @ApiPropertyOptional({ nullable: true })
  compRegionAddr1!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compRegionAddr2!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compRegionAddr3!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compRegionCity!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compRegionDistrict!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compRegionState!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compRegionCountry!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compRegionName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compTel!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compPhone!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compMail!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compSupportEmail!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compSupportPhone!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compWebsiteName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compFinYearFrom!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compFinYearTo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compBooksBeginFrom!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compBooksLockDate!: string | null;

  @ApiProperty()
  compGstApplicable!: boolean;

  @ApiProperty()
  compTcsApplicable!: boolean;

  @ApiProperty()
  compSmsApplicable!: boolean;

  @ApiProperty()
  compEinvoiceApplicable!: boolean;

  @ApiProperty()
  compEwayApplicable!: boolean;

  @ApiPropertyOptional({ nullable: true })
  compEwayDate!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compEwayInterLimit!: number | null;

  @ApiProperty()
  compEwayIntraApl!: boolean;

  @ApiProperty()
  compEwayIntraLimit!: number;

  @ApiPropertyOptional({ nullable: true })
  compEinvoiceDate!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compEinvoiceInclEway!: boolean | null;

  @ApiProperty()
  compStylesheetId!: number;

  @ApiPropertyOptional({ nullable: true })
  compBankId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compPriceFixing!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compPrefixCode!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compBillGreeting!: string | null;

  @ApiProperty()
  compNegStkApl!: boolean;

  @ApiProperty()
  compDefault!: boolean;

  @ApiProperty()
  compIsActive!: boolean;

  @ApiProperty()
  compCurrencyCode!: string;

  @ApiPropertyOptional({ nullable: true })
  compCurrencySymbol!: string | null;

  @ApiProperty()
  compLocaleCode!: string;

  @ApiPropertyOptional({ nullable: true })
  compRemarks!: string | null;

  @ApiPropertyOptional({ nullable: true })
  compAuthorizeSignature!: string | null;

  @ApiProperty()
  compIsDeleted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  compSyncDate!: string | null;

  @ApiProperty()
  compCreatedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  compCreatedBy!: string | null;

  @ApiProperty()
  compModifiedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  compModifiedBy!: string | null;
}

export class CompanyMasterDeleteResultDto {
  @ApiProperty({ example: '019cc885-d0f4-771b-a7d1-7c98f9ff3ac1' })
  compId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class CompanyMasterSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Company fetched successfully' })
  message!: string;

  @ApiProperty({ type: CompanyMasterPayloadDto })
  data!: CompanyMasterPayloadDto;
}

export class CompanyMasterSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Company deleted successfully' })
  message!: string;

  @ApiProperty({ type: CompanyMasterDeleteResultDto })
  data!: CompanyMasterDeleteResultDto;
}
