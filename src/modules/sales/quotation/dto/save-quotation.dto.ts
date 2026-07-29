import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, ValidateNested } from 'class-validator';
import {
  NullableDateString,
  NullableInteger,
  NullableNumber,
  NullableStringStrict,
  NullableUpperMaxString,
  NullableUuid,
  OptionalBoolean,
  OptionalDateString,
  OptionalInteger,
  OptionalNumber,
  OptionalUuid,
  RequiredInteger,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { SaveQuotationChargeDto } from './save-quotation-charge.dto';
import { SaveQuotationItemDto } from './save-quotation-item.dto';

export class SaveQuotationDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing quotation',
  })
  @OptionalUuid()
  sqId?: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sqCompanyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sqBranchId!: string;

  // Nullable since 20260729070445. Every property still needs at least one
  // class-validator decorator: whitelist + forbidNonWhitelisted reject an
  // undecorated one as "should not exist" rather than letting it through.
  // NullableUuid folds null/''/omitted into null and skips the pattern for them.
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sqTenantId?: string | null;

  @ApiProperty({ minLength: 9, maxLength: 9 })
  @TrimmedString(9)
  sqAccYear!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sqSessionId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sqCategoryId?: string | null;

  @ApiProperty()
  @RequiredInteger()
  sqPriceLevel!: number;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @NullableStringStrict(30)
  sqDocType?: string | null;

  @ApiProperty()
  @RequiredInteger()
  sqQuoteSlno!: number;

  @ApiProperty({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sqQuoteRefno?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sqUsrRefno?: string | null;

  @ApiPropertyOptional({ type: 'string', format: 'date', description: "Defaults to today's date" })
  @OptionalDateString()
  sqQuoteDate?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'date-time',
    description: 'Defaults to the save time',
  })
  @OptionalDateString()
  sqQuoteDatetime?: string;

  @ApiPropertyOptional({ type: 'string', format: 'date', nullable: true })
  @NullableDateString()
  sqValidUntil?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableInteger()
  sqValidityDays?: number | null;

  @ApiPropertyOptional()
  @OptionalInteger()
  sqRevisionNo?: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sqParentQuoteId?: string | null;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @NullableStringStrict(30)
  sqSrcDocType?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sqSrcDocId?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sqSrcDocRefno?: string | null;

  @ApiPropertyOptional({ type: 'string', format: 'date-time', nullable: true })
  @NullableDateString()
  sqSrcDocDate?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sqCustId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sqCustAreaId?: string | null;

  @ApiProperty({ maxLength: 200 })
  @TrimmedString(200)
  @IsNotEmpty()
  sqCustName!: string;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @NullableStringStrict(500)
  sqCustAddr?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sqCustPlace?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  sqCustPhone?: string | null;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableStringStrict(150)
  sqCustEmail?: string | null;

  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  @NullableStringStrict(15)
  sqCustGstin?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  sqCustGstType?: string | null;

  @ApiPropertyOptional({ minLength: 2, maxLength: 2, nullable: true })
  @NullableStringStrict(2)
  sqCustStcd?: string | null;

  @ApiPropertyOptional({ minLength: 2, maxLength: 2, nullable: true })
  @NullableStringStrict(2)
  sqPosStcd?: string | null;

  @ApiPropertyOptional({
    maxLength: 100,
    nullable: true,
    description: 'Snapshot of the state name',
  })
  @NullableStringStrict(100)
  sqStateName?: string | null;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableStringStrict(150)
  sqContactPerson?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  sqContactPhone?: string | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  sqHasLoad?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  sqHasUnload?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  sqHasFreight?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  sqHasPromo?: boolean;

  @ApiPropertyOptional()
  @OptionalBoolean()
  sqHasComm?: boolean;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sqUserId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sqSalesmanId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sqAgentId?: string | null;

  @ApiPropertyOptional()
  @OptionalInteger()
  sqTotItems?: number;

  @ApiPropertyOptional()
  @OptionalNumber()
  sqTotWeight?: string | number;

  @ApiPropertyOptional()
  @OptionalNumber()
  sqTotBags?: string | number;

  @ApiPropertyOptional()
  @OptionalNumber()
  sqGrossAmt?: string | number;

  @ApiPropertyOptional()
  @OptionalNumber()
  sqItemDisc?: string | number;

  @ApiPropertyOptional()
  @OptionalNumber()
  sqSplDisc?: string | number;

  @ApiPropertyOptional()
  @OptionalNumber()
  sqSchDisc?: string | number;

  @ApiPropertyOptional()
  @OptionalNumber()
  sqBillSchDisc?: string | number;

  @ApiPropertyOptional()
  @OptionalNumber()
  sqAddlDisc1?: string | number;

  @ApiPropertyOptional()
  @OptionalNumber()
  sqAddlDisc2?: string | number;

  @ApiPropertyOptional()
  @OptionalNumber()
  sqTaxableAmt?: string | number;

  @ApiPropertyOptional()
  @OptionalNumber()
  sqCgstAmt?: string | number;

  @ApiPropertyOptional()
  @OptionalNumber()
  sqSgstAmt?: string | number;

  @ApiPropertyOptional()
  @OptionalNumber()
  sqIgstAmt?: string | number;

  @ApiPropertyOptional()
  @OptionalNumber()
  sqCessAmt?: string | number;

  @ApiPropertyOptional()
  @OptionalNumber()
  sqTaxAmt?: string | number;

  @ApiPropertyOptional()
  @OptionalNumber()
  sqFreightAmt?: string | number;

  @ApiPropertyOptional()
  @OptionalNumber()
  sqLoadAmt?: string | number;

  @ApiPropertyOptional()
  @OptionalNumber()
  sqUnloadAmt?: string | number;

  @ApiPropertyOptional()
  @OptionalNumber()
  sqOtherAmt1?: string | number;

  @ApiPropertyOptional()
  @OptionalNumber()
  sqOtherAmt2?: string | number;

  @ApiPropertyOptional()
  @OptionalNumber()
  sqRoundOff?: string | number;

  @ApiPropertyOptional()
  @OptionalNumber()
  sqQuoteAmt?: string | number;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sqTotalCost?: string | number | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sqMarginAmt?: string | number | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sqMarginPerc?: string | number | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  sqPaymentTerms?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  sqDeliveryTerms?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Free text, no length limit' })
  @NullableStringStrict()
  sqTermsConditions?: string | null;

  @ApiPropertyOptional({
    maxLength: 20,
    nullable: true,
    description: 'DRAFT / SENT / ACCEPTED / REJECTED / EXPIRED / CONVERTED / CANCELLED',
  })
  @NullableStringStrict(20)
  sqStatus?: string | null;

  @ApiPropertyOptional({ type: 'string', format: 'date-time', nullable: true })
  @NullableDateString()
  sqSentOn?: string | null;

  @ApiPropertyOptional({ type: 'string', format: 'date-time', nullable: true })
  @NullableDateString()
  sqAcceptedOn?: string | null;

  @ApiPropertyOptional({ type: 'string', format: 'date-time', nullable: true })
  @NullableDateString()
  sqRejectedOn?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  sqRejectReason?: string | null;

  @ApiPropertyOptional({
    maxLength: 30,
    nullable: true,
    description: 'Document the quotation was converted into',
  })
  @NullableStringStrict(30)
  sqConvertedDocType?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sqConvertedDocId?: string | null;

  @ApiPropertyOptional({ type: 'string', format: 'date-time', nullable: true })
  @NullableDateString()
  sqConvertedOn?: string | null;

  @ApiPropertyOptional({ type: 'string', format: 'date-time', nullable: true })
  @NullableDateString()
  sqApprovedOn?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sqApprovedBy?: string | null;

  @ApiPropertyOptional({ type: 'string', format: 'date-time', nullable: true })
  @NullableDateString()
  sqCancelledOn?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sqCancelledBy?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  sqCancelReason?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sqMrpSavings?: string | number | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sqMrpSavingsPerc?: string | number | null;

  @ApiPropertyOptional()
  @OptionalInteger()
  sqPrintCount?: number;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  sqDeviceType?: string | null;

  // Text column (see 20260729070000): a device fingerprint / hostname, not a
  // uuid, and not length-capped the way sqDeviceType is.
  @ApiPropertyOptional({ nullable: true, description: 'Originating device identifier' })
  @NullableStringStrict()
  sqDeviceId?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @NullableStringStrict(500)
  sqRemarks?: string | null;

  // sq_created_by / sq_modified_by are text columns, not uuid: resolveActor falls
  // back to DEFAULT_ACTOR, which is the nil uuid and would not survive the uuid
  // pattern. Free text, no length cap, matching the column.
  @ApiPropertyOptional({ nullable: true, description: 'Actor id or name; defaults to the caller' })
  @NullableStringStrict()
  sqCreatedBy?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Actor id or name; defaults to the caller' })
  @NullableStringStrict()
  sqModifiedBy?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'How the freight charge is computed (snapshot of the charge master method)',
  })
  @NullableUpperMaxString(12)
  sqFreightCalcType?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'How the loading charge is computed (snapshot of the charge master method)',
  })
  @NullableUpperMaxString(12)
  sqLoadingCalcType?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'true = discounts change the basis the charges are computed on',
  })
  @OptionalBoolean()
  sqDiscAlterBase?: boolean | null;

  @ApiPropertyOptional({
    type: SaveQuotationItemDto,
    isArray: true,
    description:
      'Quotation line items. On update, lines with sqiId are updated, lines without are created, ' +
      'and existing lines omitted from the array are soft deleted. Omit the property entirely to leave lines untouched.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveQuotationItemDto)
  items?: SaveQuotationItemDto[];

  @ApiPropertyOptional({
    type: SaveQuotationChargeDto,
    isArray: true,
    description:
      'Applied charge lines (sale_charge_detail). Reconciled exactly like items: lines with cdId are ' +
      'updated, lines without are created, and existing lines omitted from the array are soft deleted. ' +
      'Omit the property entirely to leave charges untouched.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveQuotationChargeDto)
  charges?: SaveQuotationChargeDto[];
}
