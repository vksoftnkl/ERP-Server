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

  @ApiProperty({ format: 'uuid' })
  ledBranchId!: string;

  @ApiProperty({ format: 'uuid' })
  ledGroupId!: string;

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

  @ApiProperty()
  ledCategory!: string;

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

  @ApiPropertyOptional({ nullable: true })
  ledChequeName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  ledBankName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  ledBankBranch!: string | null;

  @ApiPropertyOptional({ nullable: true })
  ledBankAcNo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  ledBankIfsc!: string | null;

  @ApiPropertyOptional({ nullable: true })
  ledUpiId!: string | null;

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

export class AccountLedgerMasterListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
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

export class AccountLedgerMasterSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Account ledgers fetched successfully' })
  message!: string;

  @ApiProperty({ type: AccountLedgerMasterPayloadDto, isArray: true })
  data!: AccountLedgerMasterPayloadDto[];

  @ApiProperty({ type: AccountLedgerMasterListMetaDto })
  meta!: AccountLedgerMasterListMetaDto;
}

export class AccountLedgerMasterSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Account ledger deleted successfully' })
  message!: string;

  @ApiProperty({ type: AccountLedgerMasterDeleteResultDto })
  data!: AccountLedgerMasterDeleteResultDto;
}
