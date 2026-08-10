import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// A bill's applied charges are plain txn_charge_detail rows (cdDocType =
// 'INVOICE' — a bill IS the tax invoice), so the response model is the
// charge-detail module's, not a bill-specific copy of it.
import { ChargeDetailPayloadDto } from '../../../master/charge-detail/dto/charge-detail-response.dto';
// Same for the tendered amounts: plain acc_tender_detail rows (SALES /
// SALE_BILL), so the response model is the tender-detail module's.
import { TenderDetailPayloadDto } from '../../../accountsModule/tenderDetail/dto/tender-detail-response.dto';
export class BillErrorFieldDto {
  @ApiProperty({ example: 'sbCustId' })
  field!: string;
  @ApiProperty({ example: 'sbCustId is required' })
  message!: string;
}
export class BillErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;
  @ApiProperty({ example: 'Validation failed' })
  message!: string;
  @ApiProperty({ type: BillErrorFieldDto, isArray: true })
  errors!: BillErrorFieldDto[];
}
export class BillItemPayloadDto {
  @ApiProperty({ format: 'uuid' })
  sbiId!: string;
  @ApiProperty({ format: 'uuid' })
  sbiBillId!: string;
  @ApiProperty({ format: 'uuid' })
  sbiCompanyId!: string;
  @ApiProperty({ format: 'uuid' })
  sbiBranchId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sbiTenantId!: string | null;
  @ApiProperty({ minLength: 9, maxLength: 9 })
  sbiAccYear!: string;
  @ApiProperty()
  sbiLineNo!: number;
  @ApiProperty({ default: 1 })
  sbiSplitNo!: number;
  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  sbiSrcDocType!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sbiSrcDocId!: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  sbiSrcDocRefno!: string | null;
  @ApiPropertyOptional({ nullable: true })
  sbiSrcItemQty!: number | null;
  @ApiPropertyOptional({ nullable: true })
  sbiSrcFreeQty!: number | null;
  @ApiProperty({ format: 'uuid' })
  sbiItemId!: string;
  @ApiPropertyOptional({
    nullable: true,
    description: 'item_master.itemNameEn for sbiItemId — only populated on GET',
  })
  sbiItemName?: string | null;
  @ApiProperty({
    format: 'uuid',
    description: 'item_unit_conversion.iucId — NOT item_unit_master.unit_id',
  })
  sbiItemUnitId!: string;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'item_unit_master.unit_name reached via item_unit_conversion — only populated on GET',
  })
  sbiUnitName?: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'item_unit_master.unit_decimal_count reached via item_unit_conversion — only populated on GET',
  })
  sbiDecimalCount?: number | null;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'item_master.item_group_id for sbiItemId — only populated on GET',
  })
  sbiGroupId?: string | null;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'item_master.item_brand_id for sbiItemId — only populated on GET',
  })
  sbiBrandId?: string | null;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'item_master.item_section_id for sbiItemId — only populated on GET',
  })
  sbiSectionId?: string | null;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'item_master.item_category_id for sbiItemId — only populated on GET',
  })
  sbiCategoryId?: string | null;
  @ApiProperty({
    description: 'Snapshot of item_unit_conversion.iucToBaseFactor for sbiItemUnitId',
  })
  sbiToBaseFactor!: number;
  @ApiPropertyOptional({ maxLength: 8, nullable: true })
  sbiHsnCode!: string | null;
  @ApiProperty()
  sbiPriceLevel!: number;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  sbiEanCode!: string | null;
  @ApiProperty({ format: 'uuid', description: 'The inventory godown the stock was taken from' })
  sbiGodownId!: string;
  @ApiPropertyOptional({
    nullable: true,
    description: 'godown_locations.gdl_name for sbiGodownId — only populated on GET',
  })
  sbiGodownName?: string | null;
  @ApiProperty({ format: 'uuid', description: 'The inventory batch/stock row allocated' })
  sbiStockId!: string;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  sbiBatchNo!: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date' })
  sbiBatchDate!: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date' })
  sbiExpiryDate!: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  sbiSerialNo!: string | null;
  @ApiProperty()
  sbiIsTaxIncl!: boolean;
  @ApiProperty()
  sbiIsPromo!: boolean;
  @ApiProperty()
  sbiIsFree!: boolean;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  sbiFreeType!: string | null;
  @ApiProperty()
  sbiIsService!: boolean;
  @ApiProperty()
  sbiHasFreight!: boolean;
  @ApiProperty()
  sbiCaseQty!: number;
  @ApiProperty()
  sbiBillQty!: number;
  @ApiPropertyOptional({ nullable: true })
  sbiLengthQty!: number | null;
  @ApiProperty()
  sbiNetQty!: number;
  @ApiPropertyOptional({ nullable: true })
  sbiWeightQty!: number | null;
  @ApiProperty()
  sbiAvailableStock!: number;
  @ApiProperty({ description: 'Cache mirrored from sale_return' })
  sbiReturnQty!: number;
  @ApiProperty()
  sbiRate!: number;
  @ApiProperty()
  sbiRatePreTax!: number;
  @ApiProperty()
  sbiRateDiff!: number;
  @ApiPropertyOptional({ nullable: true })
  sbiActPrice!: number | null;
  @ApiPropertyOptional({ nullable: true, description: 'MRP' })
  sbiMaxPrice!: number | null;
  @ApiPropertyOptional({ nullable: true })
  sbiMinPrice!: number | null;
  @ApiPropertyOptional({ nullable: true })
  sbiCostPrice!: number | null;
  @ApiPropertyOptional({ nullable: true })
  sbiCostPreTax!: number | null;
  @ApiProperty()
  sbiItemDiscPerc!: number;
  @ApiProperty()
  sbiItemDiscQty!: number;
  @ApiProperty()
  sbiItemDiscAmt!: number;
  @ApiProperty()
  sbiSplDiscPerc!: number;
  @ApiProperty()
  sbiSplDiscQty!: number;
  @ApiProperty()
  sbiSplDiscAmt!: number;
  @ApiProperty()
  sbiSchDiscPerc!: number;
  @ApiProperty()
  sbiSchDiscQty!: number;
  @ApiProperty()
  sbiSchDiscAmt!: number;
  @ApiProperty()
  sbiBillSchPerc!: number;
  @ApiProperty()
  sbiBillSchQty!: number;
  @ApiProperty()
  sbiBillSchAmt!: number;
  @ApiProperty()
  sbiAddlDisc1Perc!: number;
  @ApiProperty()
  sbiAddlDisc1Amt!: number;
  @ApiProperty()
  sbiAddlDisc2Perc!: number;
  @ApiProperty()
  sbiAddlDisc2Amt!: number;
  @ApiProperty()
  sbiCashDiscPerc!: number;
  @ApiProperty()
  sbiCashDiscAmt!: number;
  @ApiProperty()
  sbiGrossAmt!: number;
  @ApiPropertyOptional({ nullable: true, description: 'Line net/gross basis the charges sit on' })
  sbiNetGross!: number | null;
  @ApiPropertyOptional({ nullable: true, description: 'Line charges landing before tax' })
  sbiChrgBeforeTax!: number | null;
  @ApiPropertyOptional({ nullable: true, description: 'Line charges landing after tax' })
  sbiChrgAfterTax!: number | null;
  @ApiProperty()
  sbiTaxableAmt!: number;
  @ApiProperty()
  sbiTaxPerc!: number;
  @ApiProperty()
  sbiTaxAmt!: number;
  @ApiProperty()
  sbiCgstPerc!: number;
  @ApiProperty()
  sbiCgstAmt!: number;
  @ApiProperty()
  sbiSgstPerc!: number;
  @ApiProperty()
  sbiSgstAmt!: number;
  @ApiProperty()
  sbiIgstPerc!: number;
  @ApiProperty()
  sbiIgstAmt!: number;
  @ApiProperty()
  sbiCessPerc!: number;
  @ApiProperty()
  sbiCessPerUnit!: number;
  @ApiProperty()
  sbiCessAmt!: number;
  @ApiProperty()
  sbiAcessPerc!: number;
  @ApiProperty()
  sbiAcessPerUnit!: number;
  @ApiProperty()
  sbiAcessAmt!: number;
  @ApiProperty({ description: "The item's batch configuration, snapshotted onto the line" })
  sbiBatchConfig!: number;
  @ApiProperty()
  sbiFreightQty!: number;
  @ApiProperty()
  sbiFreightAmt!: number;
  @ApiProperty()
  sbiLoadQty!: number;
  @ApiProperty()
  sbiLoadAmt!: number;
  @ApiProperty()
  sbiUnloadQty!: number;
  @ApiProperty()
  sbiUnloadAmt!: number;
  @ApiProperty()
  sbiRoundOff!: number;
  @ApiProperty()
  sbiNetAmt!: number;
  @ApiPropertyOptional({ nullable: true })
  sbiSoldPrice!: number | null;
  @ApiPropertyOptional({ nullable: true })
  sbiSoldPreTax!: number | null;
  @ApiPropertyOptional({ nullable: true })
  sbiItemProfit!: number | null;
  @ApiPropertyOptional({ nullable: true })
  sbiProfitPreTax!: number | null;
  @ApiPropertyOptional({ nullable: true })
  sbiMrpSavings!: number | null;
  @ApiPropertyOptional({ nullable: true })
  sbiMrpSavingsPerc!: number | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sbiSalesmanId!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sbiSchemeId!: string | null;
  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  sbiSchemeName!: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  sbiRemarks!: string | null;
  @ApiProperty()
  sbiIsDeleted!: boolean;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  sbiSyncDate!: string | null;
  @ApiProperty()
  sbiCreatedOn!: string;
  @ApiProperty({ format: 'uuid' })
  sbiCreatedBy!: string;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  sbiModifiedOn!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sbiModifiedBy!: string | null;
}
export class BillPayloadDto {
  @ApiProperty({ format: 'uuid' })
  sbId!: string;
  @ApiProperty({ format: 'uuid' })
  sbCompanyId!: string;
  @ApiProperty({ format: 'uuid' })
  sbBranchId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sbTenantId!: string | null;
  @ApiProperty({ minLength: 9, maxLength: 9 })
  sbAccYear!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sbSessionId!: string | null;
  @ApiProperty({ format: 'uuid', description: 'The counter/device that raised this document' })
  sbCounterId!: string;
  @ApiProperty({ maxLength: 20 })
  sbDeviceType!: string;
  @ApiProperty()
  sbDeviceId!: string;
  @ApiProperty({ maxLength: 30 })
  sbDocType!: string;
  @ApiProperty({ maxLength: 20 })
  sbBillType!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sbCategoryId!: string | null;
  @ApiProperty()
  sbPriceLevel!: number;
  @ApiPropertyOptional({
    example: '1',
    nullable: true,
    description: 'BigInt serialized as string; allocated from the bill voucher sequence',
  })
  sbBillSlno!: string | null;
  @ApiPropertyOptional({
    example: 'bil00001',
    maxLength: 100,
    nullable: true,
    description: 'Printable bill number generated from the bill voucher sequence',
  })
  sbBillRefno!: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  sbUsrRefno!: string | null;
  @ApiProperty({ format: 'date' })
  sbBillDate!: string;
  @ApiProperty({ format: 'date-time' })
  sbBillDatetime!: string;
  @ApiPropertyOptional({ nullable: true })
  sbDueDays!: number | null;
  @ApiPropertyOptional({ nullable: true, format: 'date' })
  sbDueDate!: string | null;
  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  sbSrcDocType!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sbSrcDocId!: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  sbSrcDocRefno!: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date' })
  sbSrcDocDate!: string | null;
  @ApiProperty({ format: 'uuid' })
  sbCustId!: string;
  @ApiProperty({ maxLength: 200 })
  sbCustName!: string;
  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  sbCustAddr!: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  sbCustPlace!: string | null;
  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  sbCustPin!: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  sbCustPhone!: string | null;
  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  sbCustGstin!: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  sbCustGstType!: string | null;
  @ApiPropertyOptional({ minLength: 2, maxLength: 2, nullable: true })
  sbCustStcd!: string | null;
  @ApiPropertyOptional({ minLength: 2, maxLength: 2, nullable: true })
  sbPosStcd!: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  sbStateName!: string | null;
  @ApiProperty()
  sbHasLoad!: boolean;
  @ApiProperty()
  sbHasUnload!: boolean;
  @ApiProperty()
  sbHasFreight!: boolean;
  @ApiProperty()
  sbHasPromo!: boolean;
  @ApiProperty()
  sbHasComm!: boolean;
  @ApiProperty()
  sbHasLoyalty!: boolean;
  @ApiProperty({ format: 'uuid' })
  sbUserId!: string;
  @ApiPropertyOptional({ type: [String], format: 'uuid', nullable: true })
  sbSalesmanId!: string[] | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sbAgentId!: string | null;
  @ApiPropertyOptional({ nullable: true })
  sbAgentCommPerc!: number | null;
  @ApiPropertyOptional({ nullable: true })
  sbAgentCommAmt!: number | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sbDriverId!: string | null;
  @ApiPropertyOptional({ type: [String], format: 'uuid', nullable: true })
  sbLoadmanId!: string[] | null;
  @ApiPropertyOptional({ type: [String], format: 'uuid', nullable: true })
  sbPackedId!: string[] | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sbSupervisorId!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sbVehicleId!: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  sbVehicleNo!: string | null;
  @ApiProperty({ description: 'Printed LINES, not split rows' })
  sbTotItems!: number;
  @ApiProperty()
  sbTotWeight!: number;
  @ApiProperty()
  sbTotBags!: number;
  @ApiProperty()
  sbGrossAmt!: number;
  @ApiProperty()
  sbItemDisc!: number;
  @ApiProperty()
  sbSplDisc!: number;
  @ApiProperty()
  sbSchDisc!: number;
  @ApiProperty()
  sbBillSchDisc!: number;
  @ApiProperty()
  sbAddlDisc1!: number;
  @ApiProperty()
  sbAddlDisc2!: number;
  @ApiProperty()
  sbCashDisc!: number;
  @ApiProperty({ description: 'POST-charge taxable value' })
  sbTaxableAmt!: number;
  @ApiProperty()
  sbCgstAmt!: number;
  @ApiProperty()
  sbSgstAmt!: number;
  @ApiProperty()
  sbIgstAmt!: number;
  @ApiProperty()
  sbCessAmt!: number;
  @ApiProperty()
  sbTaxAmt!: number;
  @ApiProperty()
  sbFreightAmt!: number;
  @ApiProperty()
  sbLoadAmt!: number;
  @ApiProperty()
  sbUnloadAmt!: number;
  @ApiProperty()
  sbOtherAmt1!: number;
  @ApiProperty()
  sbOtherAmt2!: number;
  @ApiProperty()
  sbRoundOff!: number;
  @ApiProperty()
  sbBillAmt!: number;
  @ApiPropertyOptional({ nullable: true })
  sbTotalCost!: number | null;
  @ApiPropertyOptional({ nullable: true })
  sbMarginAmt!: number | null;
  @ApiPropertyOptional({ nullable: true, description: 'Margin without tax' })
  sbMarginAmtWot!: number | null;
  @ApiPropertyOptional({ nullable: true })
  sbMarginPerc!: number | null;
  @ApiPropertyOptional({ nullable: true })
  sbMrpSavings!: number | null;
  @ApiPropertyOptional({ nullable: true })
  sbMrpSavingsPerc!: number | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  sbPayMode!: string | null;
  @ApiProperty()
  sbCreditAmt!: number;
  @ApiProperty()
  sbSurchargeAmt!: number;
  @ApiProperty()
  sbTenderAmt!: number;
  @ApiProperty()
  sbRefundAmt!: number;
  @ApiProperty()
  sbAdvanceAmt!: number;
  @ApiProperty()
  sbPaidAmt!: number;
  @ApiProperty()
  sbBalanceAmt!: number;
  @ApiProperty({ maxLength: 20 })
  sbPayStatus!: string;
  @ApiProperty({ description: 'Cache mirrored from sale_return' })
  sbReturnedAmt!: number;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  sbReturnStatus!: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  sbPaymentTerms!: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  sbDeliveryTerms!: string | null;
  @ApiPropertyOptional({ nullable: true })
  sbTermsConditions!: string | null;
  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  sbRemarks!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    example: 'fixed',
    description: 'How the freight charge is computed, lower case',
  })
  sbFreightCalcType!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    example: 'fixed',
    description: 'How the loading charge is computed, lower case',
  })
  sbLoadingCalcType!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'true = discounts change the basis the charges are computed on',
  })
  sbDiscAlterBase!: boolean | null;
  @ApiProperty()
  sbRoundOffStep!: number;
  @ApiProperty({ maxLength: 20 })
  sbStatus!: string;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  sbPostedOn!: string | null;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'accounts.acc_voucher_header',
  })
  sbPostedVoucherId!: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  sbApprovedOn!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sbApprovedBy!: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  sbCancelledOn!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sbCancelledBy!: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  sbCancelReason!: string | null;
  @ApiProperty()
  sbVersionNo!: number;
  @ApiProperty()
  sbPrintCount!: number;
  @ApiProperty()
  sbIsDeleted!: boolean;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  sbSyncDate!: string | null;
  @ApiProperty()
  sbCreatedOn!: string;
  @ApiProperty()
  sbCreatedBy!: string;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  sbModifiedOn!: string | null;
  @ApiPropertyOptional({ nullable: true })
  sbModifiedBy!: string | null;
  @ApiProperty({ type: BillItemPayloadDto, isArray: true })
  items!: BillItemPayloadDto[];
  @ApiProperty({ type: ChargeDetailPayloadDto, isArray: true })
  charges!: ChargeDetailPayloadDto[];
  @ApiProperty({ type: TenderDetailPayloadDto, isArray: true })
  tenders!: TenderDetailPayloadDto[];
}
export class BillDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  sbId!: string;
  @ApiProperty({ example: true })
  deleted!: true;
}
export class BillSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Bill fetched successfully' })
  message!: string;
  @ApiProperty({
    type: BillPayloadDto,
    description: 'Bill record including its line items and applied charges',
  })
  data!: BillPayloadDto;
}
export class BillSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Bill deleted successfully' })
  message!: string;
  @ApiProperty({ type: BillDeleteResultDto })
  data!: BillDeleteResultDto;
}
