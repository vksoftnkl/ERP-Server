import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import {
  NullableDateString,
  NullableNumber,
  NullableStringStrict,
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
import { SaveChargeDetailDto } from '../../../master/charge-detail/dto/save-charge-detail.dto';
import { SaveTenderDetailDto } from '../../../accountsModule/tenderDetail/dto/save-tender-detail.dto';
import { SaveOrderAdvanceDto } from './save-order-advance.dto';
import { SaveOrderItemDto } from './save-order-item.dto';
// An array of uuids: undefined leaves the column untouched, null/'' clears it
// to an empty array, and a non-array/non-string input is left for IsUUID to
// reject.
//
// null is deliberately NOT passed through. soSalesmanId / soPackedId are uuid[]
// columns (Prisma `String[]`), and a Prisma scalar list has no nullable form:
// `null` fails to match SaleOrderUncheckedCreateInput, Prisma falls back to the
// checked variant, and the save dies on the misleading "Argument `customer` is
// missing" instead. An empty array is what "cleared" means for these columns
// anyway.
const toUuidArray = (value: unknown): string[] | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return [];
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
    Transform(({ value }: { value: unknown }) => toUuidArray(value)),
    IsArray(),
    IsUUID('all', { each: true }),
  );
export class SaveOrderDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing order',
  })
  @OptionalUuid()
  soId?: string;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  soCompanyId!: string;
  @ApiProperty({ format: 'uuid', description: 'Branch that TOOK the order' })
  @RequiredUuid()
  soBranchId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  soTenantId?: string | null;
  @ApiProperty({ minLength: 9, maxLength: 9 })
  @TrimmedString(9)
  soAccYear!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  soSessionId?: string | null;
  // The DEVICE is the counter — fixed.device_master is the register of billing
  // points, and so_device_id is NOT NULL with a RESTRICT FK, so unlike the
  // bill's free-text sbDeviceId this must be a registered device's uuid.
  @ApiProperty({
    format: 'uuid',
    description: 'fixed.device_master.dev_id — the billing point that raised this order',
  })
  @RequiredUuid()
  soDeviceId!: string;
  @ApiPropertyOptional({
    maxLength: 30,
    nullable: true,
    description: "SALES_ORDER / BOOKING / CUSTOM_ORDER — defaults to 'SALES_ORDER'",
  })
  @NullableStringStrict(30)
  soDocType?: string | null;
  @ApiPropertyOptional({
    maxLength: 20,
    nullable: true,
    description: "CASH / CREDIT — defaults to 'CASH'",
  })
  @NullableStringStrict(20)
  soOrderType?: string | null;
  @ApiProperty()
  @RequiredInteger()
  soPriceLevel!: number;
  // Both are assigned on create from the sales-order voucher sequence
  // (accounts.acc_voucher_seq, vchr_type_id 4) and are immutable afterwards.
  // They stay on the DTO so clients that still send them are not rejected by
  // forbidNonWhitelisted, but whatever they send is ignored.
  @ApiPropertyOptional({
    readOnly: true,
    description: 'Ignored — assigned from the sales-order voucher sequence on create',
  })
  @NullableNumber()
  soOrderSlno?: string | number;
  @ApiPropertyOptional({
    readOnly: true,
    maxLength: 100,
    nullable: true,
    description: 'Ignored — generated from the sales-order voucher sequence on create',
  })
  @NullableStringStrict(100)
  soOrderRefno?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  soUsrRefno?: string | null;
  @ApiPropertyOptional({ type: 'string', format: 'date', description: "Defaults to today's date" })
  @OptionalDateString()
  soOrderDate?: string;
  @ApiPropertyOptional({
    type: 'string',
    format: 'date-time',
    description: 'Defaults to the save time',
  })
  @OptionalDateString()
  soOrderDatetime?: string;
  @ApiPropertyOptional({
    type: 'string',
    format: 'date',
    nullable: true,
    description: 'The delivery date agreed with the customer; lines may carry their own',
  })
  @NullableDateString()
  soDeliveryDate?: string | null;
  @ApiPropertyOptional({
    maxLength: 30,
    nullable: true,
    description: "'FN' | 'AN' | '10-12' ... free text by design",
  })
  @NullableStringStrict(30)
  soDeliverySlot?: string | null;
  @ApiPropertyOptional({
    maxLength: 10,
    nullable: true,
    description: "LOW / NORMAL / HIGH / URGENT — defaults to 'NORMAL'",
  })
  @NullableStringStrict(10)
  soPriority?: string | null;
  @ApiPropertyOptional({
    type: 'string',
    format: 'date',
    nullable: true,
    description: 'An unclaimed booking lapses after this date',
  })
  @NullableDateString()
  soValidUntil?: string | null;
  @ApiPropertyOptional({
    maxLength: 30,
    nullable: true,
    description: 'Document this order was raised from: quotation, imported/marketplace order',
  })
  @NullableStringStrict(30)
  soSrcDocType?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  soSrcDocId?: string | null;
  @ApiPropertyOptional({
    minLength: 9,
    maxLength: 9,
    nullable: true,
    description: "The source document's OWN accounting year — a March quotation can become an April order",
  })
  @NullableStringStrict(9)
  soSrcDocAccYear?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  soSrcDocRefno?: string | null;
  @ApiPropertyOptional({ type: 'string', format: 'date', nullable: true })
  @NullableDateString()
  soSrcDocDate?: string | null;
  @ApiPropertyOptional({
    maxLength: 20,
    nullable: true,
    description:
      'STORE_PICKUP / HOME_DELIVERY / SHIP_FROM_STORE / COURIER / TRANSPORT — ' +
      "defaults to 'STORE_PICKUP'",
  })
  @NullableStringStrict(20)
  soDeliveryMode?: string | null;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  soCustId!: string;
  @ApiProperty({ maxLength: 200 })
  @TrimmedString(200)
  @IsNotEmpty()
  soCustName!: string;
  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @NullableStringStrict(500)
  soCustAddr?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  soCustPlace?: string | null;
  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableStringStrict(10)
  soCustPin?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  soCustPhone?: string | null;
  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableStringStrict(150)
  soCustEmail?: string | null;
  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  @NullableStringStrict(15)
  soCustGstin?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  soCustGstType?: string | null;
  @ApiPropertyOptional({ minLength: 2, maxLength: 2, nullable: true })
  @NullableStringStrict(2)
  soCustStcd?: string | null;
  @ApiPropertyOptional({
    minLength: 2,
    maxLength: 2,
    nullable: true,
    description: 'Place of supply: decides CGST+SGST vs IGST',
  })
  @NullableStringStrict(2)
  soPosStcd?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true, description: 'Snapshot of the state name' })
  @NullableStringStrict(100)
  soStateName?: string | null;
  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableStringStrict(150)
  soContactPerson?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  soContactPhone?: string | null;
  @ApiPropertyOptional({
    maxLength: 200,
    nullable: true,
    description: 'Ship-to, snapshotted separately from the billing address',
  })
  @NullableStringStrict(200)
  soShipName?: string | null;
  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @NullableStringStrict(500)
  soShipAddr?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  soShipPlace?: string | null;
  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableStringStrict(10)
  soShipPin?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  soShipPhone?: string | null;
  @ApiPropertyOptional({ minLength: 2, maxLength: 2, nullable: true })
  @NullableStringStrict(2)
  soShipStcd?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  soShipLandmark?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  soShipLat?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  soShipLng?: string | number | null;
  @ApiPropertyOptional()
  @OptionalBoolean()
  soHasLoad?: boolean;
  @ApiPropertyOptional()
  @OptionalBoolean()
  soHasUnload?: boolean;
  @ApiPropertyOptional()
  @OptionalBoolean()
  soHasFreight?: boolean;
  @ApiPropertyOptional()
  @OptionalBoolean()
  soHasPromo?: boolean;
  @ApiPropertyOptional()
  @OptionalBoolean()
  soHasComm?: boolean;
  @ApiPropertyOptional()
  @OptionalBoolean()
  soHasLoyalty?: boolean;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  soUserId!: string;
  @ApiPropertyOptional({ type: [String], format: 'uuid', nullable: true })
  @NullableUuidArray()
  soSalesmanId?: string[];
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  soAgentId?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  soAgentCommPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  soAgentCommAmt?: string | number | null;
  @ApiPropertyOptional({ type: [String], format: 'uuid', nullable: true })
  @NullableUuidArray()
  soPackedId?: string[];
  @ApiPropertyOptional({ description: 'Ordered LINES' })
  @OptionalInteger()
  soTotItems?: number;
  @ApiPropertyOptional({ description: 'Fully delivered LINES' })
  @OptionalInteger()
  soDeliveredItems?: number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soTotWeight?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soTotBags?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soGrossAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soItemDisc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soSplDisc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soSchDisc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soBillSchDisc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soAddlDisc1?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soAddlDisc2?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soCashDiscPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soCashDisc?: string | number;
  @ApiPropertyOptional({ description: 'POST-charge taxable value' })
  @OptionalNumber()
  soTaxableAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soCgstAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soSgstAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soIgstAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soCessAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soTaxAmt?: string | number;
  @ApiPropertyOptional({ description: 'Roll-up of applied freight charge lines' })
  @OptionalNumber()
  soFreightAmt?: string | number;
  @ApiPropertyOptional({ description: 'Roll-up of applied loading charge lines' })
  @OptionalNumber()
  soLoadAmt?: string | number;
  @ApiPropertyOptional({ description: 'Roll-up of applied unloading charge lines' })
  @OptionalNumber()
  soUnloadAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soOtherAmt1?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soOtherAmt2?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soRoundOff?: string | number;
  @ApiPropertyOptional({ description: 'The order value' })
  @OptionalNumber()
  soOrderAmt?: string | number;
  @ApiPropertyOptional({ nullable: true, description: 'Never printed; drives margin reports' })
  @NullableNumber()
  soTotalCost?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  soMarginAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true, description: 'Margin without tax' })
  @NullableNumber()
  soMarginAmtWot?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  soMarginPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  soMarginPercWot?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  soMrpSavings?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  soMrpSavingsPerc?: string | number | null;
  @ApiPropertyOptional({
    maxLength: 10,
    nullable: true,
    description:
      "NONE / FIXED / PERC / FULL — defaults to 'NONE'. PERC needs soAdvancePerc > 0, " +
      'FIXED needs soAdvanceRequired > 0 (ck_so_advance_policy_input)',
  })
  @NullableStringStrict(10)
  soAdvancePolicy?: string | null;
  @ApiPropertyOptional()
  @OptionalNumber()
  soAdvancePerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soAdvanceRequired?: string | number;
  @ApiPropertyOptional({ type: 'string', format: 'date', nullable: true })
  @NullableDateString()
  soAdvanceDueDate?: string | null;
  @ApiPropertyOptional()
  @OptionalBoolean()
  soIsAdvanceMandatory?: boolean;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Customer-advance liability ledger (accounts.acc_ledger_master)',
  })
  @NullableUuid()
  soAdvanceLedgerId?: string | null;
  @ApiPropertyOptional({ description: 'Roll-up cache from accounts.acc_tender_detail' })
  @OptionalNumber()
  soAdvanceRecdAmt?: string | number;
  @ApiPropertyOptional({ description: 'Roll-up cache from sale_order_advance_alloc' })
  @OptionalNumber()
  soAdvanceAdjustedAmt?: string | number;
  @ApiPropertyOptional({ description: 'Roll-up cache from sale_order_advance_alloc' })
  @OptionalNumber()
  soAdvanceRefundAmt?: string | number;
  @ApiPropertyOptional({ description: 'Roll-up cache from sale_order_advance_alloc' })
  @OptionalNumber()
  soAdvanceForfeitAmt?: string | number;
  @ApiPropertyOptional({
    description:
      'What the company still HOLDS = received − adjusted − refunded − forfeited ' +
      '(ck_so_advance_balance); when omitted it is derived from the other four',
  })
  @OptionalNumber()
  soAdvanceBalanceAmt?: string | number;
  @ApiPropertyOptional({
    maxLength: 20,
    nullable: true,
    description:
      'NONE / PENDING / PARTIAL / RECEIVED / ADJUSTED / REFUNDED / FORFEITED — ' +
      "defaults to 'NONE'",
  })
  @NullableStringStrict(20)
  soAdvanceStatus?: string | null;
  @ApiPropertyOptional({
    type: 'string',
    format: 'date-time',
    nullable: true,
    description: 'First instalment received on',
  })
  @NullableDateString()
  soAdvanceRecdOn?: string | null;
  @ApiPropertyOptional({
    maxLength: 20,
    nullable: true,
    description: 'Dominant tender mode, for quick filters',
  })
  @NullableStringStrict(20)
  soPayMode?: string | null;
  @ApiPropertyOptional()
  @OptionalNumber()
  soSurchargeAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soTenderAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soRefundAmt?: string | number;
  @ApiPropertyOptional({
    maxLength: 20,
    nullable: true,
    description: "UNPAID / PARTIAL / PAID — defaults to 'UNPAID'",
  })
  @NullableStringStrict(20)
  soPayStatus?: string | null;
  @ApiPropertyOptional({ description: 'Fulfilment cache — sale_bill is the truth' })
  @OptionalNumber()
  soBilledAmt?: string | number;
  @ApiPropertyOptional({ description: 'Fulfilment cache' })
  @OptionalNumber()
  soCancelledAmt?: string | number;
  @ApiPropertyOptional({ description: 'Fulfilment cache' })
  @OptionalNumber()
  soPendingAmt?: string | number;
  @ApiPropertyOptional({
    maxLength: 20,
    nullable: true,
    description: "PENDING / PARTIAL / COMPLETED / CANCELLED — defaults to 'PENDING'",
  })
  @NullableStringStrict(20)
  soFulfilStatus?: string | null;
  @ApiPropertyOptional({ type: 'string', format: 'date-time', nullable: true })
  @NullableDateString()
  soLastBilledOn?: string | null;
  @ApiPropertyOptional({
    type: 'string',
    format: 'date-time',
    nullable: true,
    description: 'Last line delivered',
  })
  @NullableDateString()
  soCompletedOn?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  soPaymentTerms?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  soDeliveryTerms?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Free text, no length limit' })
  @NullableStringStrict()
  soTermsConditions?: string | null;
  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @NullableStringStrict(500)
  soRemarks?: string | null;
  @ApiPropertyOptional({
    nullable: true,
    example: 'fixed',
    description:
      'How the freight charge is computed (snapshot of the charge master method)',
  })
  @NullableStringStrict(12)
  soFreightCalcType?: string | null;
  @ApiPropertyOptional({
    nullable: true,
    example: 'fixed',
    description:
      'How the loading charge is computed (snapshot of the charge master method)',
  })
  @NullableStringStrict(12)
  soLoadingCalcType?: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'true = discounts change the basis the charges are computed on',
  })
  @OptionalBoolean()
  soDiscAlterBase?: boolean | null;
  @ApiPropertyOptional()
  @OptionalNumber()
  soRoundOffStep?: string | number;
  @ApiPropertyOptional({
    maxLength: 20,
    nullable: true,
    description:
      'DRAFT / CONFIRMED / PARTIAL / COMPLETED / CANCELLED / CLOSED / EXPIRED — ' +
      "defaults to 'DRAFT'. The status TRAIL lives in public.txn_status_log; this " +
      'column is the current state only.',
  })
  @NullableStringStrict(20)
  soStatus?: string | null;
  @ApiPropertyOptional()
  @OptionalInteger()
  soVersionNo?: number;
  @ApiPropertyOptional()
  @OptionalInteger()
  soPrintCount?: number;
  // so_created_by / so_modified_by are VarChar(50) columns, not uuid: the actor
  // is whatever resolveActor settles on — a user id, but equally a name or
  // login the caller passed — so the uuid pattern does not fit.
  @ApiPropertyOptional({ nullable: true, description: 'Actor id or name; defaults to the caller' })
  @NullableStringStrict(50)
  soCreatedBy?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Actor id or name; defaults to the caller' })
  @NullableStringStrict(50)
  soModifiedBy?: string | null;
  @ApiPropertyOptional({
    type: SaveOrderItemDto,
    isArray: true,
    description:
      'Order line items. On update, lines with soiId are updated, lines without are created, ' +
      'and existing lines omitted from the array are soft deleted. Omit the property entirely ' +
      'to leave lines untouched.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveOrderItemDto)
  items?: SaveOrderItemDto[];
  @ApiPropertyOptional({
    type: SaveChargeDetailDto,
    isArray: true,
    description:
      "Applied charge lines, the charge-detail module's own entry (sale_charge_detail). Reconciled " +
      'exactly like items: lines with cdId are updated, lines without are created, and existing lines ' +
      'omitted from the array are soft deleted. Omit the property entirely to leave charges untouched. ' +
      'cdChgId and cdLedgerCode are required on a new line; cdDocType / cdDocId are the parent order ' +
      '(ORDER / soId) and must be omitted or match it, and cdCompId / cdBranchId / cdAccYear / ' +
      "cdVoucherNo default to the order's own scope.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveChargeDetailDto)
  charges?: SaveChargeDetailDto[];
  @ApiPropertyOptional({
    type: SaveTenderDetailDto,
    isArray: true,
    description:
      "Tendered amounts, the tender-detail module's own entry (acc_tender_detail): the advance " +
      'money the customer actually handed over, one line per tender (cash, card, UPI, …). ' +
      'Reconciled exactly like items: lines with tdId are updated, lines without are created, and ' +
      'existing lines omitted from the array are soft deleted. Omit the property entirely to leave ' +
      'tenders untouched. tdTenderId is required on a new line; the document triple (tdSrcModule / ' +
      'tdSrcDocType / tdSrcDocId) is this order (SALES / SALES_ORDER / soId) and must be omitted or ' +
      'match it, and tdCompanyId / tdBranchId / tdTenantId / tdAccYear / tdDocDate / tdPartyLedgerId ' +
      "/ tdUserId / tdSessionId / tdDeviceId / tdDrCr all default to the order's own scope.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveTenderDetailDto)
  tenders?: SaveTenderDetailDto[];
  @ApiPropertyOptional({
    type: SaveOrderAdvanceDto,
    isArray: true,
    description:
      'Advance allocations (sale_order_advance_alloc): where money taken up front actually went — ' +
      'adjusted into an invoice, refunded, forfeited, or transferred to another order. Owned by ' +
      'this module. Reconciled exactly like items: rows with soaId are updated, rows without are ' +
      'created, and existing rows omitted from the array are soft deleted. Omit the property ' +
      'entirely to leave allocations untouched. soaAllocType / soaAllocDate / soaAmount are ' +
      'required on a new row; soaOrderId / soaOrderAccYear are the parent order and must be ' +
      'omitted or match it.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveOrderAdvanceDto)
  advances?: SaveOrderAdvanceDto[];
}
