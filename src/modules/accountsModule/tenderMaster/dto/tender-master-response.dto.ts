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

  @ApiProperty({ format: 'uuid' })
  tndCompanyId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  tndBranchId!: string | null;

  @ApiProperty({ example: '1' })
  tndTypeId!: string;

  @ApiProperty()
  tndName!: string;

  @ApiProperty()
  tndShortName!: string;

  @ApiProperty({ format: 'uuid' })
  tndLedgerId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  tndSettlementLedgerId!: string | null;

  @ApiProperty()
  tndSettlementDays!: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  tndBankAccountId!: string | null;

  @ApiProperty()
  tndMinAmount!: number;

  @ApiPropertyOptional({ nullable: true })
  tndMaxAmount!: number | null;

  @ApiPropertyOptional({ nullable: true })
  tndDailyLimit!: number | null;

  @ApiProperty()
  tndSurchargePerc!: number;

  @ApiProperty()
  tndSurchargeAmount!: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  tndSurchargeLedgerId!: string | null;

  @ApiProperty()
  tndEditSurcharge!: boolean;

  @ApiProperty()
  tndEditLedger!: boolean;

  @ApiPropertyOptional({ nullable: true })
  tndUpiVpa!: string | null;

  @ApiPropertyOptional({ nullable: true })
  tndUpiQrPayload!: string | null;

  @ApiPropertyOptional({ nullable: true })
  tndMerchantId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  tndTerminalId!: string | null;

  @ApiProperty()
  tndConversionRate!: number;

  @ApiPropertyOptional({ nullable: true, description: 'null = inherit from the tender type' })
  tndNeedsRef!: boolean | null;

  @ApiPropertyOptional({ nullable: true, description: 'null = inherit from the tender type' })
  tndAllowChange!: boolean | null;

  @ApiPropertyOptional({ nullable: true, description: 'null = inherit from the tender type' })
  tndAllowInReturn!: boolean | null;

  @ApiProperty()
  tndOpenCashDrawer!: boolean;

  @ApiProperty()
  tndIsDefault!: boolean;

  @ApiProperty()
  tndDisplayPosition!: number;

  @ApiPropertyOptional({ nullable: true })
  tndHotkey!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '#00A3FF' })
  tndColour!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-08-01' })
  tndEffectiveFrom!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2027-03-31' })
  tndEffectiveTo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  tndRemarks!: string | null;

  @ApiProperty()
  tndIsActive!: boolean;

  @ApiProperty()
  tndIsDeleted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  tndTallyGuid!: string | null;

  @ApiPropertyOptional({ nullable: true })
  tndSyncDate!: string | null;

  @ApiProperty()
  tndCreatedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  tndCreatedBy!: string | null;

  @ApiPropertyOptional({ nullable: true })
  tndModifiedOn!: string | null;

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
