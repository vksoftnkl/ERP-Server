import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// An order's applied charges are plain txn_charge_detail rows (cdDocType =
// 'ORDER'), so the response model is the charge-detail module's, not an
// order-specific copy of it.
import { ChargeDetailPayloadDto } from '../../../master/charge-detail/dto/charge-detail-response.dto';
// Same for the tendered amounts: plain acc_tender_detail rows (SALES /
// SALES_ORDER), so the response model is the tender-detail module's.
import { TenderDetailPayloadDto } from '../../../accountsModule/tenderDetail/dto/tender-detail-response.dto';
export class SaleOrderErrorFieldDto {
  @ApiProperty({ example: 'soCustId' })
  field!: string;
  @ApiProperty({ example: 'soCustId is required' })
  message!: string;
}
export class SaleOrderErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;
  @ApiProperty({ example: 'Validation failed' })
  message!: string;
  @ApiProperty({ type: SaleOrderErrorFieldDto, isArray: true })
  errors!: SaleOrderErrorFieldDto[];
}
export class SaleOrderItemPayloadDto {
  @ApiProperty({ format: 'uuid' })
  soiId!: string;
  @ApiProperty({ format: 'uuid' })
  soiOrderId!: string;
  @ApiProperty({ format: 'uuid' })
  soiCompanyId!: string;
  @ApiPropertyOptional({
    nullable: true,
    description: 'company.comp_name for soiCompanyId — only populated on GET',
  })
  soiCompanyName?: string | null;
  @ApiProperty({ format: 'uuid' })
  soiBranchId!: string;
  @ApiPropertyOptional({
    nullable: true,
    description: 'branch_master.br_name for soiBranchId — only populated on GET',
  })
  soiBranchName?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  soiTenantId!: string | null;
  @ApiProperty({ minLength: 9, maxLength: 9 })
  soiAccYear!: string;
  @ApiProperty()
  soiLineNo!: number;
  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  soiSrcDocType!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  soiSrcDocId!: string | null;
  @ApiPropertyOptional({ minLength: 9, maxLength: 9, nullable: true })
  soiSrcDocAccYear!: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  soiSrcDocRefno!: string | null;
  @ApiPropertyOptional({ nullable: true })
  soiSrcLineNo!: number | null;
  @ApiProperty({ format: 'uuid' })
  soiItemId!: string;
  @ApiPropertyOptional({
    nullable: true,
    description: 'item_master.itemNameEn for soiItemId — only populated on GET',
  })
  soiItemName?: string | null;
  @ApiProperty({
    format: 'uuid',
    description: 'item_unit_conversion.iucId — NOT item_unit_master.unit_id',
  })
  soiItemUnitId!: string;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'item_unit_master.unit_name reached via item_unit_conversion — only populated on GET',
  })
  soiUnitName?: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'item_unit_master.unit_decimal_count reached via item_unit_conversion — only populated on GET',
  })
  soiDecimalCount?: number | null;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'item_master.item_group_id for soiItemId — only populated on GET',
  })
  soiGroupId?: string | null;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'item_master.item_brand_id for soiItemId — only populated on GET',
  })
  soiBrandId?: string | null;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'item_master.item_section_id for soiItemId — only populated on GET',
  })
  soiSectionId?: string | null;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'item_master.item_category_id for soiItemId — only populated on GET',
  })
  soiCategoryId?: string | null;
  @ApiProperty({
    description: 'Snapshot of item_unit_conversion.iucToBaseFactor for soiItemUnitId',
  })
  soiToBaseFactor!: number;
  @ApiPropertyOptional({ maxLength: 8, nullable: true })
  soiHsnCode!: string | null;
  @ApiProperty()
  soiPriceLevel!: number;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  soiEanCode!: string | null;
  @ApiPropertyOptional({
    maxLength: 50,
    nullable: true,
    description: 'Free-text dimension the operator typed, stored verbatim',
  })
  soiSize!: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  soiSizeUom!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  soiGodownId!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'godown_locations.gdl_name for soiGodownId — only populated on GET',
  })
  soiGodownName?: string | null;
  @ApiProperty({ description: 'Soft hold; inventory owns the hard one' })
  soiIsReserved!: boolean;
  @ApiProperty()
  soiReservedQty!: number;
  @ApiPropertyOptional({ nullable: true, format: 'date' })
  soiReserveExpiresOn!: string | null;
  @ApiProperty()
  soiIsTaxIncl!: boolean;
  @ApiProperty()
  soiIsPromo!: boolean;
  @ApiProperty()
  soiIsFree!: boolean;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  soiFreeType!: string | null;
  @ApiProperty()
  soiIsService!: boolean;
  @ApiProperty()
  soiHasFreight!: boolean;
  @ApiProperty()
  soiCaseQty!: number;
  @ApiProperty()
  soiOrderQty!: number;
  @ApiPropertyOptional({ nullable: true })
  soiLengthQty!: number | null;
  @ApiProperty()
  soiNetQty!: number;
  @ApiPropertyOptional({ nullable: true })
  soiWeightQty!: number | null;
  @ApiProperty({ description: 'Informational snapshot at order time' })
  soiAvailableStock!: number;
  @ApiProperty({ description: 'Fulfilment cache — sale_bill_item is the truth' })
  soiDeliveredQty!: number;
  @ApiProperty({ description: 'Fulfilment cache' })
  soiCancelledQty!: number;
  @ApiProperty({ description: 'Fulfilment cache; ordered = delivered + cancelled + pending' })
  soiPendingQty!: number;
  @ApiProperty({ description: 'Fulfilment cache' })
  soiBilledAmt!: number;
  @ApiProperty()
  soiRate!: number;
  @ApiProperty()
  soiRatePreTax!: number;
  @ApiProperty()
  soiRateDiff!: number;
  @ApiPropertyOptional({ nullable: true })
  soiActPrice!: number | null;
  @ApiPropertyOptional({ nullable: true, description: 'MRP' })
  soiMaxPrice!: number | null;
  @ApiPropertyOptional({ nullable: true })
  soiMinPrice!: number | null;
  @ApiPropertyOptional({ nullable: true })
  soiCostPrice!: number | null;
  @ApiPropertyOptional({ nullable: true })
  soiCostPreTax!: number | null;
  @ApiProperty({
    description: 'true = the order holds its price even if the price master moves',
  })
  soiIsRateLocked!: boolean;
  @ApiProperty()
  soiItemDiscPerc!: number;
  @ApiProperty()
  soiItemDiscQty!: number;
  @ApiProperty()
  soiItemDiscAmt!: number;
  @ApiProperty()
  soiSplDiscPerc!: number;
  @ApiProperty()
  soiSplDiscQty!: number;
  @ApiProperty()
  soiSplDiscAmt!: number;
  @ApiProperty()
  soiSchDiscPerc!: number;
  @ApiProperty()
  soiSchDiscQty!: number;
  @ApiProperty()
  soiSchDiscAmt!: number;
  @ApiProperty()
  soiBillSchPerc!: number;
  @ApiProperty()
  soiBillSchQty!: number;
  @ApiProperty()
  soiBillSchAmt!: number;
  @ApiProperty()
  soiAddlDisc1Perc!: number;
  @ApiProperty()
  soiAddlDisc1Amt!: number;
  @ApiProperty()
  soiAddlDisc2Perc!: number;
  @ApiProperty()
  soiAddlDisc2Amt!: number;
  @ApiProperty()
  soiCashDiscPerc!: number;
  @ApiProperty()
  soiCashDiscAmt!: number;
  @ApiProperty()
  soiGrossAmt!: number;
  @ApiPropertyOptional({ nullable: true, description: 'Line net/gross basis the charges sit on' })
  soiNetGross!: number | null;
  @ApiPropertyOptional({ nullable: true, description: 'Line charges landing before tax' })
  soiChrgBeforeTax!: number | null;
  @ApiPropertyOptional({ nullable: true, description: 'Line charges landing after tax' })
  soiChrgAfterTax!: number | null;
  @ApiProperty({ description: 'On the POST-charge taxable' })
  soiTaxableAmt!: number;
  @ApiProperty()
  soiTaxPerc!: number;
  @ApiProperty()
  soiTaxAmt!: number;
  @ApiProperty()
  soiCgstPerc!: number;
  @ApiProperty()
  soiCgstAmt!: number;
  @ApiProperty()
  soiSgstPerc!: number;
  @ApiProperty()
  soiSgstAmt!: number;
  @ApiProperty()
  soiIgstPerc!: number;
  @ApiProperty()
  soiIgstAmt!: number;
  @ApiProperty()
  soiCessPerc!: number;
  @ApiProperty()
  soiCessPerUnit!: number;
  @ApiProperty()
  soiCessAmt!: number;
  @ApiProperty()
  soiAcessPerc!: number;
  @ApiProperty()
  soiAcessPerUnit!: number;
  @ApiProperty()
  soiAcessAmt!: number;
  @ApiProperty()
  soiFreightQty!: number;
  @ApiProperty()
  soiFreightAmt!: number;
  @ApiProperty()
  soiLoadQty!: number;
  @ApiProperty()
  soiLoadAmt!: number;
  @ApiProperty()
  soiUnloadQty!: number;
  @ApiProperty()
  soiUnloadAmt!: number;
  @ApiProperty()
  soiRoundOff!: number;
  @ApiProperty()
  soiNetAmt!: number;
  @ApiPropertyOptional({ nullable: true, description: 'Costing / margin, PER UNIT' })
  soiSoldPrice!: number | null;
  @ApiPropertyOptional({ nullable: true })
  soiSoldPreTax!: number | null;
  @ApiPropertyOptional({ nullable: true })
  soiItemProfit!: number | null;
  @ApiPropertyOptional({ nullable: true })
  soiProfitPreTax!: number | null;
  @ApiPropertyOptional({ nullable: true })
  soiMrpSavings!: number | null;
  @ApiPropertyOptional({ nullable: true })
  soiMrpSavingsPerc!: number | null;
  @ApiPropertyOptional({
    nullable: true,
    format: 'date',
    description: 'A split delivery date for this line',
  })
  soiDeliveryDate!: string | null;
  @ApiProperty({ maxLength: 20, description: 'PENDING / PARTIAL / DELIVERED / CANCELLED' })
  soiLineStatus!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  soiSalesmanId!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'employee_master.emp_name for soiSalesmanId — only populated on GET',
  })
  soiSalesmanName?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  soiSchemeId!: string | null;
  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  soiSchemeName!: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  soiRemarks!: string | null;
  @ApiProperty()
  soiIsDeleted!: boolean;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  soiSyncDate!: string | null;
  @ApiProperty()
  soiCreatedOn!: string;
  @ApiProperty()
  soiCreatedBy!: string;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  soiModifiedOn!: string | null;
  @ApiPropertyOptional({ nullable: true })
  soiModifiedBy!: string | null;
}
// The charge-detail / tender-detail models plus the scope names this module
// resolves on GET — the rows themselves are unchanged, so the owning modules'
// DTOs are extended rather than copied.
export class SaleOrderChargePayloadDto extends ChargeDetailPayloadDto {
  @ApiPropertyOptional({
    nullable: true,
    description: 'company.comp_name for cdCompId — only populated on GET',
  })
  cdCompName?: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'branch_master.br_name for cdBranchId — only populated on GET',
  })
  cdBranchName?: string | null;
}
export class SaleOrderTenderPayloadDto extends TenderDetailPayloadDto {
  @ApiPropertyOptional({
    nullable: true,
    description: 'company.comp_name for tdCompanyId — only populated on GET',
  })
  tdCompanyName?: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'acc_ledger_master.led_name for tdPartyLedgerId — only populated on GET',
  })
  tdPartyLedgerName?: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'user_master.usr_display_name for tdUserId — only populated on GET',
  })
  tdUserName?: string | null;
}
export class SaleOrderPayloadDto {
  @ApiProperty({ format: 'uuid' })
  soId!: string;
  @ApiProperty({ format: 'uuid' })
  soCompanyId!: string;
  @ApiPropertyOptional({
    nullable: true,
    description: 'company.comp_name for soCompanyId — only populated on GET',
  })
  soCompanyName?: string | null;
  @ApiProperty({ format: 'uuid', description: 'Branch that TOOK the order' })
  soBranchId!: string;
  @ApiPropertyOptional({
    nullable: true,
    description: 'branch_master.br_name for soBranchId — only populated on GET',
  })
  soBranchName?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  soTenantId!: string | null;
  @ApiProperty({ minLength: 9, maxLength: 9 })
  soAccYear!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  soSessionId!: string | null;
  @ApiProperty({
    format: 'uuid',
    description: 'fixed.device_master.dev_id — the billing point that raised this order',
  })
  soDeviceId!: string;
  @ApiProperty({ maxLength: 30, description: 'SALES_ORDER / BOOKING / CUSTOM_ORDER' })
  soDocType!: string;
  @ApiProperty({ maxLength: 20, description: 'CASH / CREDIT' })
  soOrderType!: string;
  @ApiProperty()
  soPriceLevel!: number;
  @ApiPropertyOptional({
    example: '1',
    nullable: true,
    description: 'BigInt serialized as string; allocated from the sales-order voucher sequence',
  })
  soOrderSlno!: string | null;
  @ApiProperty({
    example: 'sor00001',
    maxLength: 100,
    description: 'Printable order number generated from the sales-order voucher sequence',
  })
  soOrderRefno!: string;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  soUsrRefno!: string | null;
  @ApiProperty({ format: 'date' })
  soOrderDate!: string;
  @ApiProperty({ format: 'date-time' })
  soOrderDatetime!: string;
  @ApiPropertyOptional({
    nullable: true,
    format: 'date',
    description: 'The delivery date agreed with the customer',
  })
  soDeliveryDate!: string | null;
  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  soDeliverySlot!: string | null;
  @ApiProperty({ maxLength: 10, description: 'LOW / NORMAL / HIGH / URGENT' })
  soPriority!: string;
  @ApiPropertyOptional({
    nullable: true,
    format: 'date',
    description: 'An unclaimed booking lapses after this date',
  })
  soValidUntil!: string | null;
  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  soSrcDocType!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  soSrcDocId!: string | null;
  @ApiPropertyOptional({ minLength: 9, maxLength: 9, nullable: true })
  soSrcDocAccYear!: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  soSrcDocRefno!: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date' })
  soSrcDocDate!: string | null;
  @ApiProperty({
    maxLength: 20,
    description: 'STORE_PICKUP / HOME_DELIVERY / SHIP_FROM_STORE / COURIER / TRANSPORT',
  })
  soDeliveryMode!: string;
  @ApiProperty({ format: 'uuid' })
  soCustId!: string;
  @ApiProperty({ maxLength: 200 })
  soCustName!: string;
  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  soCustAddr!: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  soCustPlace!: string | null;
  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  soCustPin!: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  soCustPhone!: string | null;
  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  soCustEmail!: string | null;
  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  soCustGstin!: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  soCustGstType!: string | null;
  @ApiPropertyOptional({ minLength: 2, maxLength: 2, nullable: true })
  soCustStcd!: string | null;
  @ApiPropertyOptional({
    minLength: 2,
    maxLength: 2,
    nullable: true,
    description: 'Place of supply: decides CGST+SGST vs IGST',
  })
  soPosStcd!: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  soStateName!: string | null;
  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  soContactPerson!: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  soContactPhone!: string | null;
  @ApiPropertyOptional({
    maxLength: 200,
    nullable: true,
    description: 'Ship-to, snapshotted separately from the billing address',
  })
  soShipName!: string | null;
  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  soShipAddr!: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  soShipPlace!: string | null;
  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  soShipPin!: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  soShipPhone!: string | null;
  @ApiPropertyOptional({ minLength: 2, maxLength: 2, nullable: true })
  soShipStcd!: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  soShipLandmark!: string | null;
  @ApiPropertyOptional({ nullable: true })
  soShipLat!: number | null;
  @ApiPropertyOptional({ nullable: true })
  soShipLng!: number | null;
  @ApiProperty()
  soHasLoad!: boolean;
  @ApiProperty()
  soHasUnload!: boolean;
  @ApiProperty()
  soHasFreight!: boolean;
  @ApiProperty()
  soHasPromo!: boolean;
  @ApiProperty()
  soHasComm!: boolean;
  @ApiProperty()
  soHasLoyalty!: boolean;
  @ApiProperty({ format: 'uuid' })
  soUserId!: string;
  @ApiPropertyOptional({ type: [String], format: 'uuid', nullable: true })
  soSalesmanId!: string[] | null;
  @ApiPropertyOptional({
    type: [String],
    nullable: true,
    description:
      'employee_master.emp_name per soSalesmanId entry, in the same order — only populated on GET',
  })
  soSalesmanName?: (string | null)[] | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  soAgentId!: string | null;
  @ApiPropertyOptional({ nullable: true })
  soAgentCommPerc!: number | null;
  @ApiPropertyOptional({ nullable: true })
  soAgentCommAmt!: number | null;
  @ApiPropertyOptional({ type: [String], format: 'uuid', nullable: true })
  soPackedId!: string[] | null;
  @ApiProperty({ description: 'Ordered LINES' })
  soTotItems!: number;
  @ApiProperty({ description: 'Fully delivered LINES' })
  soDeliveredItems!: number;
  @ApiProperty()
  soTotWeight!: number;
  @ApiProperty()
  soTotBags!: number;
  @ApiProperty()
  soGrossAmt!: number;
  @ApiProperty()
  soItemDisc!: number;
  @ApiProperty()
  soSplDisc!: number;
  @ApiProperty()
  soSchDisc!: number;
  @ApiProperty()
  soBillSchDisc!: number;
  @ApiProperty()
  soAddlDisc1!: number;
  @ApiProperty()
  soAddlDisc2!: number;
  @ApiProperty()
  soCashDiscPerc!: number;
  @ApiProperty()
  soCashDisc!: number;
  @ApiProperty({ description: 'POST-charge taxable value' })
  soTaxableAmt!: number;
  @ApiProperty()
  soCgstAmt!: number;
  @ApiProperty()
  soSgstAmt!: number;
  @ApiProperty()
  soIgstAmt!: number;
  @ApiProperty()
  soCessAmt!: number;
  @ApiProperty()
  soTaxAmt!: number;
  @ApiProperty()
  soFreightAmt!: number;
  @ApiProperty()
  soLoadAmt!: number;
  @ApiProperty()
  soUnloadAmt!: number;
  @ApiProperty()
  soOtherAmt1!: number;
  @ApiProperty()
  soOtherAmt2!: number;
  @ApiProperty()
  soRoundOff!: number;
  @ApiProperty({ description: 'The order value' })
  soOrderAmt!: number;
  @ApiPropertyOptional({ nullable: true, description: 'Never printed; drives margin reports' })
  soTotalCost!: number | null;
  @ApiPropertyOptional({ nullable: true })
  soMarginAmt!: number | null;
  @ApiPropertyOptional({ nullable: true, description: 'Margin without tax' })
  soMarginAmtWot!: number | null;
  @ApiPropertyOptional({ nullable: true })
  soMarginPerc!: number | null;
  @ApiPropertyOptional({ nullable: true })
  soMarginPercWot!: number | null;
  @ApiPropertyOptional({ nullable: true })
  soMrpSavings!: number | null;
  @ApiPropertyOptional({ nullable: true })
  soMrpSavingsPerc!: number | null;
  @ApiProperty({ maxLength: 10, description: 'NONE / FIXED / PERC / FULL' })
  soAdvancePolicy!: string;
  @ApiProperty()
  soAdvancePerc!: number;
  @ApiProperty()
  soAdvanceRequired!: number;
  @ApiPropertyOptional({ nullable: true, format: 'date' })
  soAdvanceDueDate!: string | null;
  @ApiProperty()
  soIsAdvanceMandatory!: boolean;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Customer-advance liability ledger',
  })
  soAdvanceLedgerId!: string | null;
  @ApiProperty({ description: 'Roll-up cache from accounts.acc_tender_detail' })
  soAdvanceRecdAmt!: number;
  @ApiProperty({ description: 'Advance set against invoices — stated by the caller' })
  soAdvanceAdjustedAmt!: number;
  @ApiProperty({ description: 'Advance paid back — stated by the caller' })
  soAdvanceRefundAmt!: number;
  @ApiProperty({ description: 'Advance kept on cancellation — stated by the caller' })
  soAdvanceForfeitAmt!: number;
  @ApiProperty({
    description: 'What the company still HOLDS = received − adjusted − refunded − forfeited',
  })
  soAdvanceBalanceAmt!: number;
  @ApiProperty({
    maxLength: 20,
    nullable: true,
    description: 'NONE / PENDING / PARTIAL / RECEIVED / ADJUSTED / REFUNDED / FORFEITED',
  })
  soAdvanceStatus!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    format: 'date-time',
    description: 'First instalment received on',
  })
  soAdvanceRecdOn!: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  soPayMode!: string | null;
  @ApiProperty()
  soSurchargeAmt!: number;
  @ApiProperty()
  soTenderAmt!: number;
  @ApiProperty()
  soRefundAmt!: number;
  @ApiProperty({ maxLength: 20, description: 'UNPAID / PARTIAL / PAID' })
  soPayStatus!: string;
  @ApiProperty({ description: 'Fulfilment cache — sale_bill is the truth' })
  soBilledAmt!: number;
  @ApiProperty({ description: 'Fulfilment cache' })
  soCancelledAmt!: number;
  @ApiProperty({ description: 'Fulfilment cache' })
  soPendingAmt!: number;
  @ApiProperty({ maxLength: 20, description: 'PENDING / PARTIAL / COMPLETED / CANCELLED' })
  soFulfilStatus!: string;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  soLastBilledOn!: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date-time', description: 'Last line delivered' })
  soCompletedOn!: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  soPaymentTerms!: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  soDeliveryTerms!: string | null;
  @ApiPropertyOptional({ nullable: true })
  soTermsConditions!: string | null;
  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  soRemarks!: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'fixed' })
  soFreightCalcType!: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'fixed' })
  soLoadingCalcType!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'true = discounts change the basis the charges are computed on',
  })
  soDiscAlterBase!: boolean | null;
  @ApiProperty()
  soRoundOffStep!: number;
  @ApiProperty({
    maxLength: 20,
    description:
      'DRAFT / CONFIRMED / PARTIAL / COMPLETED / CANCELLED / CLOSED / EXPIRED — the current ' +
      'state; the status TRAIL lives in public.txn_status_log',
  })
  soStatus!: string;
  @ApiProperty()
  soVersionNo!: number;
  @ApiProperty()
  soPrintCount!: number;
  @ApiProperty()
  soIsDeleted!: boolean;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  soSyncDate!: string | null;
  @ApiProperty()
  soCreatedOn!: string;
  @ApiProperty()
  soCreatedBy!: string;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  soModifiedOn!: string | null;
  @ApiPropertyOptional({ nullable: true })
  soModifiedBy!: string | null;
  @ApiProperty({ type: SaleOrderItemPayloadDto, isArray: true })
  items!: SaleOrderItemPayloadDto[];
  @ApiProperty({ type: SaleOrderChargePayloadDto, isArray: true })
  charges!: SaleOrderChargePayloadDto[];
  @ApiProperty({ type: SaleOrderTenderPayloadDto, isArray: true })
  tenders!: SaleOrderTenderPayloadDto[];
}
export class SaleOrderDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  soId!: string;
  @ApiProperty({ example: true })
  deleted!: true;
}
export class SaleOrderSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Order fetched successfully' })
  message!: string;
  @ApiProperty({
    type: SaleOrderPayloadDto,
    description:
      'Order record including its line items, applied charges and tendered amounts',
  })
  data!: SaleOrderPayloadDto;
}
export class SaleOrderSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Order deleted successfully' })
  message!: string;
  @ApiProperty({ type: SaleOrderDeleteResultDto })
  data!: SaleOrderDeleteResultDto;
}
export class SaleOrderCancelledLineDto {
  @ApiProperty({ format: 'uuid' })
  soiId!: string;
  @ApiProperty({ example: 1 })
  soiLineNo!: number;
  @ApiProperty({
    example: 8,
    description: 'Quantity this call moved out of pending, not the line running total',
  })
  soiCancelledQty!: number;
  @ApiProperty({
    example: 'PARTIAL',
    description: 'PARTIAL when the line had already delivered something, CANCELLED when it had not',
  })
  soiLineStatus!: string;
}
export class SaleOrderCancelLinesResultDto {
  @ApiProperty({ format: 'uuid' })
  soId!: string;
  @ApiProperty({ example: '2026-2027' })
  soAccYear!: string;
  @ApiProperty({ example: 'PARTIAL' })
  soStatus!: string;
  @ApiProperty({ example: 'PARTIAL' })
  soFulfilStatus!: string;
  @ApiProperty({ example: 2, description: 'Lines closed by this call; 0 on a repeat call' })
  cancelledLines!: number;
  @ApiProperty({ example: 18, description: 'Total quantity cancelled by this call' })
  cancelledQty!: number;
  @ApiProperty({ example: 1440.5, description: 'Header roll-up recomputed from the lines' })
  soCancelledAmt!: number;
  @ApiProperty({ example: 0, description: 'Header roll-up recomputed from the lines' })
  soPendingAmt!: number;
  @ApiProperty({ type: SaleOrderCancelledLineDto, isArray: true })
  lines!: SaleOrderCancelledLineDto[];
}
export class SaleOrderSuccessCancelLinesDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Order lines cancelled successfully' })
  message!: string;
  @ApiProperty({ type: SaleOrderCancelLinesResultDto })
  data!: SaleOrderCancelLinesResultDto;
}
