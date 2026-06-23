import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LedGstPartyRegType, LedObType } from '@prisma/client';
export class AccountLedgerMasterErrorFieldDto {
  @ApiProperty({ example: 'ledName' })
  field!: string;

  @ApiProperty({ example: 'Duplicate ledName is not allowed for this company and group' })
  message!: string;
}
export class AccountLedgerMasterErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;
  @ApiProperty({ example: 'Validation failed' })
  message!: string;
  @ApiProperty({ type: AccountLedgerMasterErrorFieldDto, isArray: true })
  errors!: AccountLedgerMasterErrorFieldDto[];
}
export class AccountLedgerMasterPayloadDto {
  @ApiProperty({ format: 'uuid' })
  ledId!: string;
  @ApiPropertyOptional({ nullable: true })
  ledCompanyId!: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Name of the company' })
  ledCompanyName!: string | null;
  @ApiProperty({ format: 'uuid' })
  ledBranchId!: string;
  @ApiPropertyOptional({ nullable: true, description: 'Name of the branch' })
  ledBranchName!: string | null;
  @ApiProperty({ format: 'uuid' })
  ledGroupId!: string;
  @ApiPropertyOptional({ nullable: true, description: 'Name of the account group' })
  ledGroupName!: string | null;
  @ApiProperty({ maxLength: 200 })
  ledName!: string;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  ledAlias!: string | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  ledShort!: string | null;
  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  ledTallyName!: string | null;
  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  ledTallyGroupName!: string | null;
  @ApiPropertyOptional({ maxLength: 64, nullable: true })
  ledTallyGuid!: string | null;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Tally master id (BigInt serialized as string)',
  })
  ledTallyMasterId!: string | null;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Tally alter id (BigInt serialized as string)',
  })
  ledTallyAlterId!: string | null;
  @ApiProperty()
  ledCategory!: string;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  ledLedgerType!: string | null;
  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  ledMailingName!: string | null;
  @ApiProperty()
  ledIsBillByBill!: boolean;
  @ApiProperty()
  ledIsCostCenterReq!: boolean;
  @ApiProperty()
  ledIsInterestApplicable!: boolean;
  @ApiPropertyOptional({ nullable: true })
  ledInterestRate!: number | null;
  @ApiPropertyOptional({ nullable: true })
  ledContactPerson!: string | null;
  @ApiPropertyOptional({ nullable: true })
  ledEmail!: string | null;
  @ApiPropertyOptional({ nullable: true })
  ledTel!: string | null;
  @ApiPropertyOptional({ nullable: true })
  ledPhone1!: string | null;
  @ApiPropertyOptional({ nullable: true })
  ledPhone2!: string | null;
  @ApiPropertyOptional({ nullable: true })
  ledWhatsappNo!: string | null;
  @ApiPropertyOptional({ nullable: true })
  ledAddr1!: string | null;
  @ApiPropertyOptional({ nullable: true })
  ledAddr2!: string | null;
  @ApiPropertyOptional({ nullable: true })
  ledAddr3!: string | null;
  @ApiPropertyOptional({ nullable: true })
  ledCity!: string | null;
  @ApiPropertyOptional({ nullable: true })
  ledDistrict!: string | null;
  @ApiPropertyOptional({ nullable: true })
  ledStateName!: string | null;
  @ApiPropertyOptional({ nullable: true })
  ledStateCode!: string | null;
  @ApiPropertyOptional({ nullable: true })
  ledPin!: string | null;
  @ApiPropertyOptional({ nullable: true })
  ledCountry!: string | null;
  @ApiPropertyOptional({ nullable: true })
  ledRegionName!: string | null;
  @ApiPropertyOptional({ nullable: true })
  ledRegionAddr1!: string | null;
  @ApiPropertyOptional({ nullable: true })
  ledRegionAddr2!: string | null;
  @ApiPropertyOptional({ nullable: true })
  ledRegionAddr3!: string | null;
  @ApiPropertyOptional({ nullable: true })
  ledRegionCity!: string | null;
  @ApiPropertyOptional({ nullable: true })
  ledRegionDistrict!: string | null;
  @ApiPropertyOptional({ nullable: true })
  ledRegionStateName!: string | null;
  @ApiPropertyOptional({ nullable: true })
  ledRegionCountry!: string | null;
  @ApiPropertyOptional({
    enum: LedGstPartyRegType,
    enumName: 'LedGstPartyRegType',
    nullable: true,
  })
  ledGstPartyRegType!: LedGstPartyRegType | null;
  @ApiPropertyOptional({ nullable: true })
  ledGstinNo!: string | null;
  @ApiPropertyOptional({ nullable: true })
  ledPanNo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  ledAadharNo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  ledEcommerceGstin!: string | null;

  @ApiProperty()
  ledIsSez!: boolean;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  ledTypeOfSupply!: string | null;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  ledHsnSac!: string | null;

  @ApiPropertyOptional({ nullable: true })
  ledGstRate!: number | null;

  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  ledTaxability!: string | null;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  ledGstPartyType!: string | null;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  ledTanNo!: string | null;

  @ApiPropertyOptional({ maxLength: 21, nullable: true })
  ledCin!: string | null;

  @ApiPropertyOptional({ maxLength: 25, nullable: true })
  ledUdyamNo!: string | null;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  ledMsmeType!: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  ledGstDutyHead!: string | null;

  @ApiPropertyOptional({ nullable: true })
  ledTaxRate!: number | null;

  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  ledRoundingMethod!: string | null;

  @ApiPropertyOptional({ nullable: true })
  ledRoundingLimit!: number | null;

  @ApiProperty()
  ledIsTdsApplicable!: boolean;

  @ApiPropertyOptional({ maxLength: 40, nullable: true })
  ledTdsDeducteeType!: string | null;

  @ApiPropertyOptional({ maxLength: 80, nullable: true })
  ledTdsNatureOfPayment!: string | null;

  @ApiProperty()
  ledIsTcsApplicable!: boolean;

  @ApiProperty()
  ledObAmount!: number;

  @ApiProperty({
    enum: LedObType,
    enumName: 'LedObType',
  })
  ledObType!: LedObType;

  @ApiPropertyOptional({ nullable: true })
  ledObAsOn!: string | null;

  @ApiProperty()
  ledTotalDr!: number;

  @ApiProperty()
  ledTotalCr!: number;

  @ApiProperty()
  ledTotalBalance!: number;

  @ApiPropertyOptional({ nullable: true })
  ledSortOrder!: number | null;

  @ApiProperty()
  ledIsActive!: boolean;

  @ApiProperty()
  ledIsDeleted!: boolean;

  @ApiProperty()
  ledAllowEdit!: boolean;

  @ApiProperty()
  ledIsEntry!: boolean;

  @ApiProperty()
  ledAllowSms!: boolean;

  @ApiPropertyOptional({ nullable: true })
  ledRemarks!: string | null;

  @ApiPropertyOptional({ nullable: true })
  ledSyncDate!: string | null;

  @ApiProperty()
  ledCreatedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  ledCreatedBy!: string | null;

  @ApiProperty()
  ledModifiedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  ledModifiedBy!: string | null;
}

export class AccountLedgerMasterDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  ledId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class AccountLedgerMasterSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Account ledger fetched successfully' })
  message!: string;

  @ApiProperty({ type: AccountLedgerMasterPayloadDto })
  data!: AccountLedgerMasterPayloadDto;
}

export class AccountLedgerMasterSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Account ledger deleted successfully' })
  message!: string;

  @ApiProperty({ type: AccountLedgerMasterDeleteResultDto })
  data!: AccountLedgerMasterDeleteResultDto;
}
