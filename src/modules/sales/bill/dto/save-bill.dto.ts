import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import {
  NullableDateString,
  NullableInteger,
  NullableLowerMaxString,
  NullableNumber,
  NullableStringStrict,
  NullableUuid,
  OptionalBoolean,
  OptionalDateString,
  OptionalInteger,
  OptionalNumber,
  OptionalUuid,
  RequiredInteger,
  RequiredNumber,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { SaveBillChargeDto } from './save-bill-charge.dto';
import { SaveBillItemDto } from './save-bill-item.dto';
// A nullable array of uuids: undefined leaves the column untouched, null/''
// clears it, and a non-array/non-string input is left for IsUUID to reject.
const toNullableUuidArray = (value: unknown): string[] | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => (typeof entry === 'string' ? entry.trim() : String(entry)));
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  return value as string[];
};
const NullableUuidArray = () =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }: { value: unknown }) => toNullableUuidArray(value)),
    IsArray(),
    IsUUID('all', { each: true }),
  );
export class SaveBillDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing bill',
  })
  @OptionalUuid()
  sbId?: string;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sbCompanyId!: string;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sbBranchId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sbTenantId?: string | null;
  @ApiProperty({ minLength: 9, maxLength: 9 })
  @TrimmedString(9)
  sbAccYear!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sbSessionId?: string | null;
  // Counter is required: in an offline chain the counter owns the document and
  // its number series (see sbBillSlno / sbBillRefno below).
  @ApiProperty({ format: 'uuid', description: 'The counter/device that raised this document' })
  @RequiredUuid()
  sbCounterId!: string;
  @ApiProperty({ maxLength: 20 })
  @TrimmedString(20)
  @IsNotEmpty()
  sbDeviceType!: string;
  @ApiProperty({
    description: 'Originating device identifier (fingerprint / hostname, not a uuid)',
  })
  @TrimmedString()
  @IsNotEmpty()
  sbDeviceId!: string;
  @ApiPropertyOptional({
    maxLength: 30,
    nullable: true,
    description: "TAX_INVOICE / BILL_OF_SUPPLY — defaults to 'TAX_INVOICE'",
  })
  @NullableStringStrict(30)
  sbDocType?: string | null;
  @ApiPropertyOptional({
    maxLength: 20,
    nullable: true,
    description: "CASH / CREDIT — defaults to 'CASH'",
  })
  @NullableStringStrict(20)
  sbBillType?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sbCategoryId?: string | null;
  @ApiProperty()
  @RequiredInteger()
  sbPriceLevel!: number;
  // The counter that raised this document owns the number series (see
  // sbCounterId), so unlike the quotation module's sqQuoteSlno / sqQuoteRefno
  // these are supplied by the client, not allocated from a server sequence —
  // a counter operating offline cannot reach a central counter in real time.
  @ApiProperty({
    description:
      'Bill serial number, owned by the raising counter (per company/branch/year/counter)',
  })
  @RequiredNumber()
  sbBillSlno!: string | number;
  @ApiProperty({ maxLength: 100 })
  @TrimmedString(100)
  @IsNotEmpty()
  sbBillRefno!: string;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sbUsrRefno?: string | null;
  @ApiPropertyOptional({ type: 'string', format: 'date', description: "Defaults to today's date" })
  @OptionalDateString()
  sbBillDate?: string;
  @ApiPropertyOptional({
    type: 'string',
    format: 'date-time',
    description: 'Defaults to the save time',
  })
  @OptionalDateString()
  sbBillDatetime?: string;
  @ApiPropertyOptional({ nullable: true })
  @NullableInteger()
  sbDueDays?: number | null;
  @ApiPropertyOptional({ type: 'string', format: 'date', nullable: true })
  @NullableDateString()
  sbDueDate?: string | null;
  @ApiPropertyOptional({
    maxLength: 30,
    nullable: true,
    description: 'Document this bill was raised from: quotation, sales order, delivery challan',
  })
  @NullableStringStrict(30)
  sbSrcDocType?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sbSrcDocId?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sbSrcDocRefno?: string | null;
  @ApiPropertyOptional({ type: 'string', format: 'date', nullable: true })
  @NullableDateString()
  sbSrcDocDate?: string | null;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sbCustId!: string;
  @ApiProperty({ maxLength: 200 })
  @TrimmedString(200)
  @IsNotEmpty()
  sbCustName!: string;
  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @NullableStringStrict(500)
  sbCustAddr?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sbCustPlace?: string | null;
  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableStringStrict(10)
  sbCustPin?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  sbCustPhone?: string | null;
  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  @NullableStringStrict(15)
  sbCustGstin?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  sbCustGstType?: string | null;
  @ApiPropertyOptional({ minLength: 2, maxLength: 2, nullable: true })
  @NullableStringStrict(2)
  sbCustStcd?: string | null;
  @ApiPropertyOptional({
    minLength: 2,
    maxLength: 2,
    nullable: true,
    description: 'Place of supply: decides CGST+SGST vs IGST',
  })
  @NullableStringStrict(2)
  sbPosStcd?: string | null;
  @ApiPropertyOptional({
    maxLength: 100,
    nullable: true,
    description: 'Snapshot of the state name',
  })
  @NullableStringStrict(100)
  sbStateName?: string | null;
  @ApiPropertyOptional()
  @OptionalBoolean()
  sbHasLoad?: boolean;
  @ApiPropertyOptional()
  @OptionalBoolean()
  sbHasUnload?: boolean;
  @ApiPropertyOptional()
  @OptionalBoolean()
  sbHasFreight?: boolean;
  @ApiPropertyOptional()
  @OptionalBoolean()
  sbHasPromo?: boolean;
  @ApiPropertyOptional()
  @OptionalBoolean()
  sbHasComm?: boolean;
  @ApiPropertyOptional()
  @OptionalBoolean()
  sbHasLoyalty?: boolean;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sbUserId!: string;
  @ApiPropertyOptional({ type: [String], format: 'uuid', nullable: true })
  @NullableUuidArray()
  sbSalesmanId?: string[] | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sbAgentId?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sbAgentCommPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sbAgentCommAmt?: string | number | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sbDriverId?: string | null;
  @ApiPropertyOptional({ type: [String], format: 'uuid', nullable: true })
  @NullableUuidArray()
  sbLoadmanId?: string[] | null;
  @ApiPropertyOptional({ type: [String], format: 'uuid', nullable: true })
  @NullableUuidArray()
  sbPackedId?: string[] | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sbSupervisorId?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sbVehicleId?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  sbVehicleNo?: string | null;
  @ApiPropertyOptional({ description: 'Printed LINES, not split rows' })
  @OptionalInteger()
  sbTotItems?: number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbTotWeight?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbTotBags?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbGrossAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbItemDisc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbSplDisc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbSchDisc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbBillSchDisc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbAddlDisc1?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbAddlDisc2?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbCashDisc?: string | number;
  @ApiPropertyOptional({ description: 'POST-charge taxable value' })
  @OptionalNumber()
  sbTaxableAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbCgstAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbSgstAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbIgstAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbCessAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbTaxAmt?: string | number;
  @ApiPropertyOptional({ description: 'Roll-up of applied freight charge lines' })
  @OptionalNumber()
  sbFreightAmt?: string | number;
  @ApiPropertyOptional({ description: 'Roll-up of applied loading charge lines' })
  @OptionalNumber()
  sbLoadAmt?: string | number;
  @ApiPropertyOptional({ description: 'Roll-up of applied unloading charge lines' })
  @OptionalNumber()
  sbUnloadAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbOtherAmt1?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbOtherAmt2?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbRoundOff?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbBillAmt?: string | number;
  @ApiPropertyOptional({ nullable: true, description: 'Never printed; drives margin reports' })
  @NullableNumber()
  sbTotalCost?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sbMarginAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true, description: 'Margin without tax' })
  @NullableNumber()
  sbMarginAmtWot?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sbMarginPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sbMrpSavings?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sbMrpSavingsPerc?: string | number | null;
  @ApiPropertyOptional({
    maxLength: 20,
    nullable: true,
    description: 'Dominant tender mode, for quick filters',
  })
  @NullableStringStrict(20)
  sbPayMode?: string | null;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbCreditAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbSurchargeAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbTenderAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbRefundAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbAdvanceAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbPaidAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbBalanceAmt?: string | number;
  @ApiPropertyOptional({
    maxLength: 20,
    nullable: true,
    description: "UNPAID / PARTIAL / PAID — defaults to 'UNPAID'",
  })
  @NullableStringStrict(20)
  sbPayStatus?: string | null;
  @ApiPropertyOptional({ description: 'Cache mirrored from sale_return' })
  @OptionalNumber()
  sbReturnedAmt?: string | number;
  @ApiPropertyOptional({ maxLength: 20, nullable: true, description: 'NULL / PARTIAL / FULL' })
  @NullableStringStrict(20)
  sbReturnStatus?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  sbPaymentTerms?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  sbDeliveryTerms?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Free text, no length limit' })
  @NullableStringStrict()
  sbTermsConditions?: string | null;
  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @NullableStringStrict(500)
  sbRemarks?: string | null;
  @ApiPropertyOptional({
    nullable: true,
    example: 'fixed',
    description:
      'How the freight charge is computed (snapshot of the charge master method), stored lower case',
  })
  @NullableLowerMaxString(12)
  sbFreightCalcType?: string | null;
  @ApiPropertyOptional({
    nullable: true,
    example: 'fixed',
    description:
      'How the loading charge is computed (snapshot of the charge master method), stored lower case',
  })
  @NullableLowerMaxString(12)
  sbLoadingCalcType?: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'true = discounts change the basis the charges are computed on',
  })
  @OptionalBoolean()
  sbDiscAlterBase?: boolean | null;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbRoundOffStep?: string | number;
  @ApiPropertyOptional({
    maxLength: 20,
    nullable: true,
    description: "DRAFT / POSTED / CANCELLED — defaults to 'DRAFT'",
  })
  @NullableStringStrict(20)
  sbStatus?: string | null;
  @ApiPropertyOptional({ type: 'string', format: 'date-time', nullable: true })
  @NullableDateString()
  sbPostedOn?: string | null;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'accounts.acc_voucher_header',
  })
  @NullableUuid()
  sbPostedVoucherId?: string | null;
  @ApiPropertyOptional({ type: 'string', format: 'date-time', nullable: true })
  @NullableDateString()
  sbApprovedOn?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sbApprovedBy?: string | null;
  @ApiPropertyOptional({ type: 'string', format: 'date-time', nullable: true })
  @NullableDateString()
  sbCancelledOn?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sbCancelledBy?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  sbCancelReason?: string | null;
  @ApiPropertyOptional()
  @OptionalInteger()
  sbVersionNo?: number;
  @ApiPropertyOptional()
  @OptionalInteger()
  sbPrintCount?: number;
  // sb_created_by / sb_modified_by are text columns, not uuid: the actor is
  // whatever resolveActor settles on — a user id, but equally a name or login
  // the caller passed — so the uuid pattern does not fit. Free text, no length
  // cap, matching the column.
  @ApiPropertyOptional({ nullable: true, description: 'Actor id or name; defaults to the caller' })
  @NullableStringStrict()
  sbCreatedBy?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Actor id or name; defaults to the caller' })
  @NullableStringStrict()
  sbModifiedBy?: string | null;
  @ApiPropertyOptional({
    type: SaveBillItemDto,
    isArray: true,
    description:
      'Bill line items. On update, lines with sbiId are updated, lines without are created, ' +
      'and existing lines omitted from the array are soft deleted. Omit the property entirely to leave lines untouched.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveBillItemDto)
  items?: SaveBillItemDto[];
  @ApiPropertyOptional({
    type: SaveBillChargeDto,
    isArray: true,
    description:
      'Applied charge lines (sale_charge_detail). Reconciled exactly like items: lines with cdId are ' +
      'updated, lines without are created, and existing lines omitted from the array are soft deleted. ' +
      'Omit the property entirely to leave charges untouched.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveBillChargeDto)
  charges?: SaveBillChargeDto[];
}
