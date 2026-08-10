import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableDateString,
  NullableInteger,
  NullableNumber,
  NullableStringStrict,
  NullableUuid,
  OptionalBoolean,
  OptionalInteger,
  OptionalNumber,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredUuid,
} from 'src/common/dto/dtoDecorators';
// One ORDERED LINE on a sales order (not a batch allocation: an order allocates
// no stock, so there is no split/stock row here — that is the bill's shape).
export class SaveSaleOrderItemDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, updates the existing line; otherwise a new line is created',
  })
  @OptionalUuid()
  soiId?: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Owning order id (defaults to the parent order)',
  })
  @OptionalUuid()
  soiOrderId?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Defaults to the parent order scope' })
  @OptionalUuid()
  soiCompanyId?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Defaults to the parent order scope' })
  @OptionalUuid()
  soiBranchId?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Defaults to the parent order scope' })
  @OptionalUuid()
  soiTenantId?: string;
  @ApiPropertyOptional({
    minLength: 9,
    maxLength: 9,
    description: 'Defaults to the parent order scope',
  })
  @OptionalTrimmedString(9)
  soiAccYear?: string;
  @ApiPropertyOptional({ description: 'Defaults to the 1-based position within the items array' })
  @OptionalInteger(1)
  soiLineNo?: number;
  @ApiPropertyOptional({
    maxLength: 30,
    nullable: true,
    description: 'Document this line came from (quotation)',
  })
  @NullableStringStrict(30)
  soiSrcDocType?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  soiSrcDocId?: string | null;
  @ApiPropertyOptional({
    minLength: 9,
    maxLength: 9,
    nullable: true,
    description: "The source document's OWN accounting year",
  })
  @NullableStringStrict(9)
  soiSrcDocAccYear?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  soiSrcDocRefno?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableInteger()
  soiSrcLineNo?: number | null;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  soiItemId!: string;
  @ApiProperty({
    format: 'uuid',
    description: 'item_unit_conversion.iucId — NOT item_unit_master.unit_id',
  })
  @RequiredUuid()
  soiItemUnitId!: string;
  @ApiPropertyOptional({
    description: 'Snapshot of item_unit_conversion.iucToBaseFactor for soiItemUnitId',
  })
  @OptionalNumber()
  soiToBaseFactor?: string | number;
  @ApiPropertyOptional({ maxLength: 8, nullable: true })
  @NullableStringStrict(8)
  soiHsnCode?: string | null;
  @ApiPropertyOptional({ description: 'Defaults to the parent order price level' })
  @OptionalInteger()
  soiPriceLevel?: number;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  soiEanCode?: string | null;
  @ApiPropertyOptional({
    maxLength: 50,
    nullable: true,
    description:
      'Free-text dimension the operator typed, e.g. "12*6*2*10" — stored verbatim so a ' +
      'reprint shows the size the customer agreed to (blank is rejected, ck_soi_size)',
  })
  @NullableStringStrict(50)
  soiSize?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  soiSizeUom?: string | null;
  // Reservation is a soft hold; inventory owns the hard one. soi_godown_id is
  // nullable — an order line need not say where the stock will come from.
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  soiGodownId?: string | null;
  @ApiPropertyOptional()
  @OptionalBoolean()
  soiIsReserved?: boolean;
  @ApiPropertyOptional({ description: '0 ≤ reserved ≤ ordered (ck_soi_reserved)' })
  @OptionalNumber()
  soiReservedQty?: string | number;
  @ApiPropertyOptional({ type: 'string', format: 'date', nullable: true })
  @NullableDateString()
  soiReserveExpiresOn?: string | null;
  @ApiPropertyOptional()
  @OptionalBoolean()
  soiIsTaxIncl?: boolean;
  @ApiPropertyOptional()
  @OptionalBoolean()
  soiIsPromo?: boolean;
  @ApiPropertyOptional()
  @OptionalBoolean()
  soiIsFree?: boolean;
  @ApiPropertyOptional({
    maxLength: 20,
    nullable: true,
    description: 'NULL / SCHEME / SAMPLE / REPLACEMENT (ck_soi_free_type in DB)',
  })
  @NullableStringStrict(20)
  soiFreeType?: string | null;
  @ApiPropertyOptional()
  @OptionalBoolean()
  soiIsService?: boolean;
  @ApiPropertyOptional()
  @OptionalBoolean()
  soiHasFreight?: boolean;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiCaseQty?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiOrderQty?: string | number;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  soiLengthQty?: string | number | null;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiNetQty?: string | number;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  soiWeightQty?: string | number | null;
  @ApiPropertyOptional({ description: 'Informational snapshot at order time' })
  @OptionalNumber()
  soiAvailableStock?: string | number;
  @ApiPropertyOptional({ description: 'Fulfilment cache — sale_bill_item is the truth' })
  @OptionalNumber()
  soiDeliveredQty?: string | number;
  @ApiPropertyOptional({ description: 'Fulfilment cache' })
  @OptionalNumber()
  soiCancelledQty?: string | number;
  @ApiPropertyOptional({
    description:
      'Fulfilment cache. Ordered = delivered + cancelled + pending (ck_soi_qty_balance); ' +
      'when omitted it is derived as ordered − delivered − cancelled.',
  })
  @OptionalNumber()
  soiPendingQty?: string | number;
  @ApiPropertyOptional({ description: 'Fulfilment cache' })
  @OptionalNumber()
  soiBilledAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiRate?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiRatePreTax?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiRateDiff?: string | number;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  soiActPrice?: string | number | null;
  @ApiPropertyOptional({ nullable: true, description: 'MRP' })
  @NullableNumber()
  soiMaxPrice?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  soiMinPrice?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  soiCostPrice?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  soiCostPreTax?: string | number | null;
  @ApiPropertyOptional({
    description:
      'true (default) = a confirmed order holds its price even if the price master moves; ' +
      'false lets the bill re-price at delivery',
  })
  @OptionalBoolean()
  soiIsRateLocked?: boolean;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiItemDiscPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiItemDiscQty?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiItemDiscAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiSplDiscPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiSplDiscQty?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiSplDiscAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiSchDiscPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiSchDiscQty?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiSchDiscAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiBillSchPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiBillSchQty?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiBillSchAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiAddlDisc1Perc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiAddlDisc1Amt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiAddlDisc2Perc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiAddlDisc2Amt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiCashDiscPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiCashDiscAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiGrossAmt?: string | number;
  @ApiPropertyOptional({ nullable: true, description: 'Line net/gross basis the charges sit on' })
  @NullableNumber()
  soiNetGross?: string | number | null;
  @ApiPropertyOptional({ nullable: true, description: 'Line charges landing before tax' })
  @NullableNumber()
  soiChrgBeforeTax?: string | number | null;
  @ApiPropertyOptional({ nullable: true, description: 'Line charges landing after tax' })
  @NullableNumber()
  soiChrgAfterTax?: string | number | null;
  @ApiPropertyOptional({ description: 'On the POST-charge taxable' })
  @OptionalNumber()
  soiTaxableAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiTaxPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiTaxAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiCgstPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiCgstAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiSgstPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiSgstAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiIgstPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiIgstAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiCessPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiCessPerUnit?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiCessAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiAcessPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiAcessPerUnit?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiAcessAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiFreightQty?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiFreightAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiLoadQty?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiLoadAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiUnloadQty?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiUnloadAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiRoundOff?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  soiNetAmt?: string | number;
  @ApiPropertyOptional({ nullable: true, description: 'Costing / margin, PER UNIT' })
  @NullableNumber()
  soiSoldPrice?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  soiSoldPreTax?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  soiItemProfit?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  soiProfitPreTax?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  soiMrpSavings?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  soiMrpSavingsPerc?: string | number | null;
  @ApiPropertyOptional({
    type: 'string',
    format: 'date',
    nullable: true,
    description: 'A split delivery date for this line, when it differs from the header',
  })
  @NullableDateString()
  soiDeliveryDate?: string | null;
  @ApiPropertyOptional({
    maxLength: 20,
    nullable: true,
    description: "PENDING / PARTIAL / DELIVERED / CANCELLED — defaults to 'PENDING'",
  })
  @NullableStringStrict(20)
  soiLineStatus?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  soiSalesmanId?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  soiSchemeId?: string | null;
  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableStringStrict(150)
  soiSchemeName?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  soiRemarks?: string | null;
  // VarChar(50) columns, exactly like the header's soCreatedBy / soModifiedBy:
  // the actor is whatever resolveActor settles on — a user id, but equally a
  // name or login the caller passed — so the uuid pattern does not fit.
  @ApiPropertyOptional({ nullable: true, description: 'Actor id or name; defaults to the caller' })
  @NullableStringStrict(50)
  soiCreatedBy?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Actor id or name; defaults to the caller' })
  @NullableStringStrict(50)
  soiModifiedBy?: string | null;
}
