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
  @ApiProperty({ format: 'uuid', example: '0199b3a4-7777-7888-8999-aaaabbbbcccc' })
  lbaId!: string;

  @ApiPropertyOptional({ nullable: true, example: '0199b3a4-1111-7222-8333-444455556666' })
  lbaCompanyId!: string | null;

  @ApiProperty({ format: 'uuid', example: '0199b3a4-1c2d-7e3f-8a9b-0c1d2e3f4a5b' })
  lbaLedgerId!: string;

  @ApiProperty({ maxLength: 200, example: 'Acme Industries Pvt Ltd' })
  lbaAccountHolder!: string;

  @ApiProperty({ maxLength: 200, example: 'HDFC Bank' })
  lbaBankName!: string;

  @ApiPropertyOptional({ nullable: true, example: 'MG Road' })
  lbaBranchName!: string | null;

  @ApiProperty({ maxLength: 50, example: '50100123456789' })
  lbaAccountNo!: string;

  @ApiPropertyOptional({ nullable: true, example: 'HDFC0001234' })
  lbaIfscCode!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '560240002' })
  lbaMicrCode!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'CURRENT' })
  lbaAccountType!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'acme@hdfcbank' })
  lbaUpiId!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Acme Industries' })
  lbaChequeName!: string | null;

  @ApiProperty({ example: true })
  lbaIsDefault!: boolean;

  @ApiProperty({ example: true })
  lbaIsActive!: boolean;

  @ApiProperty({ example: false })
  lbaIsDeleted!: boolean;

  @ApiPropertyOptional({ nullable: true, example: null })
  lbaSyncDate!: string | null;

  @ApiProperty({ example: '2026-06-23T10:15:00.000Z' })
  lbaCreatedOn!: string;

  @ApiPropertyOptional({ nullable: true, example: 'user-001' })
  lbaCreatedBy!: string | null;

  @ApiProperty({ example: '2026-06-23T10:15:00.000Z' })
  lbaModifiedOn!: string;

  @ApiPropertyOptional({ nullable: true, example: null })
  lbaModifiedBy!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Primary settlement account' })
  lbaRemarks!: string | null;
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

export class LedgerBankAccountSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Ledger bank account deleted successfully' })
  message!: string;

  @ApiProperty({ type: LedgerBankAccountDeleteResultDto })
  data!: LedgerBankAccountDeleteResultDto;
}
