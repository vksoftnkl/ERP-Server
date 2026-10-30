import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LedgerMapErrorFieldDto {
  @ApiProperty({ example: 'ledgerId' })
  field!: string;
  @ApiProperty({
    example: 'Discount allowed needs a EXPENSE ledger, but "HDFC Current A/c" is "BANK"',
  })
  message!: string;
}

export class LedgerMapErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;
  @ApiProperty({ example: 'Validation failed' })
  message!: string;
  @ApiProperty({ type: LedgerMapErrorFieldDto, isArray: true })
  errors!: LedgerMapErrorFieldDto[];
}

export class LedgerMapRolePayloadDto {
  @ApiProperty({ example: 'DISCOUNT_ALLOWED', maxLength: 30 })
  role!: string;
  @ApiProperty({ example: 'Discount allowed', maxLength: 60 })
  label!: string;
  @ApiProperty({
    example: 'SHARED',
    enum: ['REVENUE', 'OUTPUT_TAX', 'PURCHASE', 'INPUT_TAX', 'SHARED', 'RECEIPT', 'FUTURE'],
  })
  group!: string;
  @ApiProperty({ example: 220 })
  sortOrder!: number;
  @ApiPropertyOptional({
    nullable: true,
    example: 'EXPENSE',
    description: 'The ledger type this role demands. Null = not checked on this axis',
  })
  expectedLedgerType!: string | null;
  @ApiPropertyOptional({ nullable: true, example: null })
  expectedDutyHead!: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'Expenses' })
  expectedGroupNature!: string | null;
  @ApiProperty({ example: true })
  roleIsActive!: boolean;
  @ApiProperty({
    isArray: true,
    type: String,
    example: ['RECEIPT'],
    description: 'The documents that post this role today. Non-empty, and /delete refuses',
  })
  usedBy!: string[];
  @ApiPropertyOptional({ nullable: true, format: 'uuid', description: 'Null = unmapped' })
  almId!: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'uuid', description: 'Null = unmapped' })
  ledgerId!: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'Discount Allowed' })
  ledgerName!: string | null;
  @ApiPropertyOptional({ nullable: true, example: true })
  ledgerIsActive!: boolean | null;
  @ApiPropertyOptional({ nullable: true, example: false })
  ledgerIsDeleted!: boolean | null;
  @ApiPropertyOptional({ nullable: true, example: true })
  isActive!: boolean | null;
  @ApiPropertyOptional({ nullable: true })
  remarks!: string | null;
}

export class LedgerMapDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  almId!: string;
  @ApiProperty({ example: 'PURCHASE_RETURN' })
  role!: string;
  @ApiProperty({ example: true })
  deleted!: true;
}

export class LedgerMapRolesSuccessDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Posting roles fetched successfully' })
  message!: string;
  @ApiProperty({ type: LedgerMapRolePayloadDto, isArray: true })
  data!: LedgerMapRolePayloadDto[];
}

export class LedgerMapSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Posting ledger mapped successfully' })
  message!: string;
  @ApiProperty({ type: LedgerMapRolePayloadDto })
  data!: LedgerMapRolePayloadDto;
}

export class LedgerMapSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Posting ledger mapping removed successfully' })
  message!: string;
  @ApiProperty({ type: LedgerMapDeleteResultDto })
  data!: LedgerMapDeleteResultDto;
}
