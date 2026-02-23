import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LedgerBankAccountErrorFieldDto {
  @ApiProperty({ example: 'lbaAccountNo' })
  field!: string;

  @ApiProperty({ example: 'Duplicate lbaAccountNo is not allowed for this ledger' })
  message!: string;
}

export class LedgerBankAccountErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: LedgerBankAccountErrorFieldDto, isArray: true })
  errors!: LedgerBankAccountErrorFieldDto[];
}

export class LedgerBankAccountPayloadDto {
  @ApiProperty({ format: 'uuid' })
  lbaId!: string;

  @ApiPropertyOptional({ nullable: true })
  lbaCompanyId!: number | null;

  @ApiProperty({ format: 'uuid' })
  lbaLedgerId!: string;

  @ApiProperty({ maxLength: 200 })
  lbaAccountHolder!: string;

  @ApiProperty({ maxLength: 200 })
  lbaBankName!: string;

  @ApiPropertyOptional({ nullable: true })
  lbaBranchName!: string | null;

  @ApiProperty({ maxLength: 50 })
  lbaAccountNo!: string;

  @ApiPropertyOptional({ nullable: true })
  lbaIfscCode!: string | null;

  @ApiPropertyOptional({ nullable: true })
  lbaMicrCode!: string | null;

  @ApiPropertyOptional({ nullable: true })
  lbaAccountType!: string | null;

  @ApiPropertyOptional({ nullable: true })
  lbaUpiId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  lbaChequeName!: string | null;

  @ApiProperty()
  lbaIsDefault!: boolean;

  @ApiProperty()
  lbaIsActive!: boolean;

  @ApiProperty()
  lbaIsDeleted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  lbaSyncDate!: string | null;

  @ApiProperty()
  lbaCreatedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  lbaCreatedBy!: string | null;

  @ApiProperty()
  lbaModifiedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  lbaModifiedBy!: string | null;

  @ApiPropertyOptional({ nullable: true })
  lbaRemarks!: string | null;
}

export class LedgerBankAccountListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class LedgerBankAccountDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  lbaId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class LedgerBankAccountSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Ledger bank account fetched successfully' })
  message!: string;

  @ApiProperty({ type: LedgerBankAccountPayloadDto })
  data!: LedgerBankAccountPayloadDto;
}

export class LedgerBankAccountSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Ledger bank accounts fetched successfully' })
  message!: string;

  @ApiProperty({ type: LedgerBankAccountPayloadDto, isArray: true })
  data!: LedgerBankAccountPayloadDto[];

  @ApiProperty({ type: LedgerBankAccountListMetaDto })
  meta!: LedgerBankAccountListMetaDto;
}

export class LedgerBankAccountSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Ledger bank account deleted successfully' })
  message!: string;

  @ApiProperty({ type: LedgerBankAccountDeleteResultDto })
  data!: LedgerBankAccountDeleteResultDto;
}
