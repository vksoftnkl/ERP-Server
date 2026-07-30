import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ChargeApplyOn,
  ChargeCostAlloc,
  ChargeDocType,
  ChargeMethod,
  ChargeRole,
  ChargeType,
} from '../../../master/charge-master/types/charge-enum';
export class QuotationErrorFieldDto {
  @ApiProperty({ example: 'sqQuoteRefno' })
  field!: string;
  @ApiProperty({ example: 'Duplicate quotation reference number is not allowed' })
  message!: string;
}
export class QuotationErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;
  @ApiProperty({ example: 'Validation failed' })
  message!: string;
  @ApiProperty({ type: QuotationErrorFieldDto, isArray: true })
  errors!: QuotationErrorFieldDto[];
}
// One applied charge line (sale_charge_detail row with cdDocType = 'QUOTATION').
export class QuotationChargePayloadDto {
  @ApiProperty({ format: 'uuid' })
  cdId!: string;
  @ApiProperty({ enum: ChargeDocType, enumName: 'ChargeDocType', example: ChargeDocType.QUOTATION })
  cdDocType!: ChargeDocType;
  @ApiProperty({ format: 'uuid', description: 'The parent quotation (sqId)' })
  cdDocId!: string;
  @ApiPropertyOptional({ nullable: true })
  cdSlno!: number | null;
  @ApiProperty({ format: 'uuid' })
  cdCompId!: string;
  @ApiProperty({ format: 'uuid' })
  cdBranchId!: string;
  @ApiProperty({ minLength: 9, maxLength: 9 })
  cdAccYear!: string;
  @ApiPropertyOptional({
    nullable: true,
    example: '1',
    description: 'BigInt serialized as string',
  })
  cdVoucherNo!: string | null;
  @ApiProperty({ format: 'uuid', description: 'charge_master.chgId' })
  cdChgId!: string;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  cdChgName!: string | null;
  @ApiPropertyOptional({ enum: ChargeRole, enumName: 'ChargeRole', nullable: true })
  cdRole!: ChargeRole | null;
  @ApiPropertyOptional({ enum: ChargeMethod, enumName: 'ChargeMethod', nullable: true })
  cdMethod!: ChargeMethod | null;
  @ApiProperty({ enum: ChargeType, enumName: 'ChargeType', example: ChargeType.ADD })
  cdType!: ChargeType;
  @ApiPropertyOptional({ enum: ChargeApplyOn, enumName: 'ChargeApplyOn', nullable: true })
  cdApplyOn!: ChargeApplyOn | null;
  @ApiProperty({ format: 'uuid' })
  cdLedgerCode!: string;
  @ApiProperty()
  cdLandingCost!: boolean;
  @ApiPropertyOptional({ enum: ChargeCostAlloc, enumName: 'ChargeCostAlloc', nullable: true })
  cdCostAlloc!: ChargeCostAlloc | null;
  @ApiProperty()
  cdBeforeTax!: boolean;
  @ApiProperty()
  cdTaxApl!: boolean;
  @ApiProperty()
  cdSepPost!: boolean;
  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  cdUnit!: string | null;
  @ApiPropertyOptional({ nullable: true })
  cdQtyVal!: number | null;
  @ApiPropertyOptional({ nullable: true })
  cdWeight!: number | null;
  @ApiPropertyOptional({ nullable: true })
  cdRate!: number | null;
  @ApiPropertyOptional({ nullable: true })
  cdAmount!: number | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  cdTaxCode!: string | null;
  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  cdHsn!: string | null;
  @ApiPropertyOptional({ nullable: true })
  cdTaxPerc!: number | null;
  @ApiPropertyOptional({ nullable: true })
  cdTaxAmt!: number | null;
  @ApiPropertyOptional({ nullable: true })
  cdSgstPerc!: number | null;
  @ApiPropertyOptional({ nullable: true })
  cdSgstAmt!: number | null;
  @ApiPropertyOptional({ nullable: true })
  cdCgstPerc!: number | null;
  @ApiPropertyOptional({ nullable: true })
  cdCgstAmt!: number | null;
  @ApiPropertyOptional({ nullable: true })
  cdIgstPerc!: number | null;
  @ApiPropertyOptional({ nullable: true })
  cdIgstAmt!: number | null;
  @ApiPropertyOptional({ nullable: true })
  cdCessPerc!: number | null;
  @ApiPropertyOptional({ nullable: true })
  cdCessAmt!: number | null;
  @ApiPropertyOptional({ nullable: true })
  cdNetAmt!: number | null;
  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  cdRemarks!: string | null;
  @ApiProperty()
  cdIsActive!: boolean;
  @ApiProperty()
  cdIsDeleted!: boolean;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  cdSyncDate!: string | null;
  @ApiProperty({ format: 'date-time' })
  cdCreatedOn!: string;
  // Text columns, not uuid — the actor may be an id or a name.
  @ApiPropertyOptional({ nullable: true })
  cdCreatedBy!: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  cdModifiedOn!: string | null;
  @ApiPropertyOptional({ nullable: true })
  cdModifiedBy!: string | null;
}
export class QuotationItemPayloadDto {
  @ApiProperty({ format: 'uuid' })
  sqiId!: string;
  @ApiProperty({ format: 'uuid' })
  sqiQuoteId!: string;
  @ApiProperty({ format: 'uuid' })
  sqiCompanyId!: string;
  @ApiProperty({ format: 'uuid' })
  sqiBranchId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sqiTenantId!: string | null;
  @ApiProperty({ minLength: 9, maxLength: 9 })
  sqiAccYear!: string;
  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  sqiSrcDocType!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sqiSrcItemId!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sqiSrcUnitId!: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  sqiSrcDocRefno!: string | null;
  @ApiPropertyOptional({ nullable: true })
  sqiSrcItemQty!: number | null;
  @ApiProperty()
  sqiLineNo!: number;
  @ApiProperty({ format: 'uuid' })
  sqiItemId!: string;
  @ApiPropertyOptional({
    nullable: true,
    description: 'item_master.itemNameEn for sqiItemId — only populated on GET',
  })
  sqiItemName?: string | null;
  @ApiProperty({
    format: 'uuid',
    description: 'item_unit_conversion.iucId — NOT item_unit_master.unit_id',
  })
  sqiItemUnitId!: string;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'item_unit_master.unit_name reached via item_unit_conversion — only populated on GET',
  })
  sqiUnitName?: string | null;
  @ApiPropertyOptional({ maxLength: 8, nullable: true })
  sqiHsnCode!: string | null;
  @ApiProperty()
  sqiPriceLevel!: number;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  sqiEanCode!: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  sqiBatchNo!: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date' })
  sqiBatchDate!: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date' })
  sqiExpiryDate!: string | null;
  @ApiProperty()
  sqiIsTaxIncl!: boolean;
  @ApiProperty()
  sqiIsPromo!: boolean;
  @ApiProperty()
  sqiIsFree!: boolean;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  sqiFreeType!: string | null;
  @ApiProperty()
  sqiIsService!: boolean;
  @ApiProperty()
  sqiCaseQty!: number;
  @ApiProperty()
  sqiBillQty!: number;
  @ApiPropertyOptional({ nullable: true })
  sqiLengthQty!: number | null;
  @ApiProperty()
  sqiNetQty!: number;
  @ApiPropertyOptional({ nullable: true })
  sqiWeightQty!: number | null;
  @ApiProperty()
  sqiAvailableStock!: number;
  @ApiProperty()
  sqiRate!: number;
  @ApiProperty()
  sqiRatePreTax!: number;
  @ApiProperty()
  sqiItemDiscPerc!: number;
  @ApiProperty()
  sqiItemDiscQty!: number;
  @ApiProperty()
  sqiItemDiscAmt!: number;
  @ApiProperty()
  sqiSplDiscPerc!: number;
  @ApiProperty()
  sqiSplDiscQty!: number;
  @ApiProperty()
  sqiSplDiscAmt!: number;
  @ApiProperty()
  sqiSchDiscPerc!: number;
  @ApiProperty()
  sqiSchDiscQty!: number;
  @ApiProperty()
  sqiSchDiscAmt!: number;
  @ApiProperty()
  sqiBillSchPerc!: number;
  @ApiProperty()
  sqiBillSchQty!: number;
  @ApiProperty()
  sqiBillSchAmt!: number;
  @ApiProperty()
  sqiAddlDisc1Perc!: number;
  @ApiProperty()
  sqiAddlDisc1Amt!: number;
  @ApiProperty()
  sqiAddlDisc2Perc!: number;
  @ApiProperty()
  sqiAddlDisc2Amt!: number;
  @ApiProperty()
  sqiCashDiscPerc!: number;
  @ApiProperty()
  sqiCashDiscAmt!: number;
  @ApiProperty()
  sqiGrossAmt!: number;
  @ApiProperty()
  sqiTaxableAmt!: number;
  @ApiProperty()
  sqiTaxPerc!: number;
  @ApiProperty()
  sqiTaxAmt!: number;
  @ApiProperty()
  sqiCgstPerc!: number;
  @ApiProperty()
  sqiCgstAmt!: number;
  @ApiProperty()
  sqiSgstPerc!: number;
  @ApiProperty()
  sqiSgstAmt!: number;
  @ApiProperty()
  sqiIgstPerc!: number;
  @ApiProperty()
  sqiIgstAmt!: number;
  @ApiProperty()
  sqiCessPerc!: number;
  @ApiProperty()
  sqiCessPerUnit!: number;
  @ApiProperty()
  sqiCessAmt!: number;
  @ApiProperty()
  sqiAcessPerc!: number;
  @ApiProperty()
  sqiAcessPerUnit!: number;
  @ApiProperty()
  sqiAcessAmt!: number;
  @ApiProperty()
  sqiFreightQty!: number;
  @ApiProperty()
  sqiFreightAmt!: number;
  @ApiProperty()
  sqiLoadQty!: number;
  @ApiProperty()
  sqiLoadAmt!: number;
  @ApiProperty()
  sqiUnloadQty!: number;
  @ApiProperty()
  sqiUnloadAmt!: number;
  @ApiProperty()
  sqiRoundOff!: number;
  @ApiProperty()
  sqiNetAmt!: number;
  @ApiPropertyOptional({ nullable: true })
  sqiCostPrice!: number | null;
  @ApiPropertyOptional({ nullable: true })
  sqiMaxPrice!: number | null;
  @ApiPropertyOptional({ nullable: true })
  sqiMinPrice!: number | null;
  @ApiPropertyOptional({ nullable: true })
  sqiActPrice!: number | null;
  @ApiPropertyOptional({ nullable: true })
  sqiQuotePrice!: number | null;
  @ApiPropertyOptional({ nullable: true })
  sqiItemProfit!: number | null;
  @ApiPropertyOptional({ nullable: true })
  sqiCostPreTax!: number | null;
  @ApiPropertyOptional({ nullable: true })
  sqiQuotePreTax!: number | null;
  @ApiPropertyOptional({ nullable: true })
  sqiProfitPreTax!: number | null;
  @ApiPropertyOptional({ nullable: true })
  sqiMrpSavings!: number | null;
  @ApiPropertyOptional({ nullable: true })
  sqiMrpSavingsPerc!: number | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sqiSchemeId!: string | null;
  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  sqiSchemeName!: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  sqiRemarks!: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Line net/gross basis the charges sit on' })
  sqiNetGross!: number | null;
  @ApiPropertyOptional({ nullable: true, description: 'Line charges landing before tax' })
  sqiChrgBeforeTax!: number | null;
  @ApiPropertyOptional({ nullable: true, description: 'Line charges landing after tax' })
  sqiChrgAfterTax!: number | null;
  @ApiProperty({
    description: 'Snapshot of item_unit_conversion.iucToBaseFactor for sqiItemUnitId',
  })
  sqiToBaseFactor!: number;
  @ApiProperty()
  sqiRateDiff!: number;
  @ApiProperty()
  sqiHasFreight!: boolean;
  @ApiProperty()
  sqiIsDeleted!: boolean;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  sqiSyncDate!: string | null;
  @ApiProperty()
  sqiCreatedOn!: string;
  @ApiProperty({ format: 'uuid' })
  sqiCreatedBy!: string;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  sqiModifiedOn!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sqiModifiedBy!: string | null;
}
export class QuotationPayloadDto {
  @ApiProperty({ format: 'uuid' })
  sqId!: string;
  @ApiProperty({ format: 'uuid' })
  sqCompanyId!: string;
  @ApiProperty({ format: 'uuid' })
  sqBranchId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sqTenantId!: string | null;
  @ApiProperty({ minLength: 9, maxLength: 9 })
  sqAccYear!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sqSessionId!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sqCategoryId!: string | null;
  @ApiProperty()
  sqPriceLevel!: number;
  @ApiProperty({ maxLength: 30 })
  sqDocType!: string;
  @ApiProperty({ example: '1', description: 'BigInt serialized as string' })
  sqQuoteSlno!: string;
  @ApiProperty({ maxLength: 100 })
  sqQuoteRefno!: string;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  sqUsrRefno!: string | null;
  @ApiProperty({ format: 'date' })
  sqQuoteDate!: string;
  @ApiProperty({ format: 'date-time' })
  sqQuoteDatetime!: string;
  @ApiPropertyOptional({ nullable: true, format: 'date' })
  sqValidUntil!: string | null;
  @ApiPropertyOptional({ nullable: true })
  sqValidityDays!: number | null;
  @ApiProperty()
  sqRevisionNo!: number;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sqParentQuoteId!: string | null;
  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  sqSrcDocType!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sqSrcDocId!: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  sqSrcDocRefno!: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  sqSrcDocDate!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sqCustId!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sqCustAreaId!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'area_master.armName for sqCustAreaId — only populated on GET',
  })
  sqCustAreaName?: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'area_master.armDistanceKm for sqCustAreaId — only populated on GET',
  })
  sqCustAreaDistanceKm?: number | null;
  @ApiProperty({ maxLength: 200 })
  sqCustName!: string;
  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  sqCustAddr!: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  sqCustPlace!: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  sqCustPhone!: string | null;
  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  sqCustEmail!: string | null;
  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  sqCustGstin!: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  sqCustGstType!: string | null;
  @ApiPropertyOptional({ minLength: 2, maxLength: 2, nullable: true })
  sqCustStcd!: string | null;
  @ApiPropertyOptional({ minLength: 2, maxLength: 2, nullable: true })
  sqPosStcd!: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  sqStateName!: string | null;
  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  sqContactPerson!: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  sqContactPhone!: string | null;
  @ApiProperty()
  sqHasLoad!: boolean;
  @ApiProperty()
  sqHasUnload!: boolean;
  @ApiProperty()
  sqHasFreight!: boolean;
  @ApiProperty()
  sqHasPromo!: boolean;
  @ApiProperty()
  sqHasComm!: boolean;
  @ApiProperty({ format: 'uuid' })
  sqUserId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sqSalesmanId!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'employee_master.empName for sqSalesmanId — only populated on GET',
  })
  sqSalesmanName?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sqAgentId!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'sale_agents.saName for sqAgentId — only populated on GET',
  })
  sqAgentName?: string | null;
  @ApiProperty()
  sqTotItems!: number;
  @ApiProperty()
  sqTotWeight!: number;
  @ApiProperty()
  sqTotBags!: number;
  @ApiProperty()
  sqGrossAmt!: number;
  @ApiProperty()
  sqItemDisc!: number;
  @ApiProperty()
  sqSplDisc!: number;
  @ApiProperty()
  sqSchDisc!: number;
  @ApiProperty()
  sqBillSchDisc!: number;
  @ApiProperty()
  sqAddlDisc1!: number;
  @ApiProperty()
  sqAddlDisc2!: number;

  @ApiProperty()
  sqTaxableAmt!: number;

  @ApiProperty()
  sqCgstAmt!: number;

  @ApiProperty()
  sqSgstAmt!: number;

  @ApiProperty()
  sqIgstAmt!: number;

  @ApiProperty()
  sqCessAmt!: number;

  @ApiProperty()
  sqTaxAmt!: number;

  @ApiProperty()
  sqFreightAmt!: number;

  @ApiProperty()
  sqLoadAmt!: number;

  @ApiProperty()
  sqUnloadAmt!: number;

  @ApiProperty()
  sqOtherAmt1!: number;

  @ApiProperty()
  sqOtherAmt2!: number;

  @ApiProperty()
  sqRoundOff!: number;

  @ApiProperty()
  sqQuoteAmt!: number;

  @ApiPropertyOptional({ nullable: true })
  sqTotalCost!: number | null;

  @ApiPropertyOptional({ nullable: true })
  sqMarginAmt!: number | null;

  @ApiPropertyOptional({ nullable: true })
  sqMarginPerc!: number | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  sqPaymentTerms!: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  sqDeliveryTerms!: string | null;

  @ApiPropertyOptional({ nullable: true })
  sqTermsConditions!: string | null;

  @ApiProperty({ maxLength: 20 })
  sqStatus!: string;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  sqSentOn!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  sqAcceptedOn!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  sqRejectedOn!: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  sqRejectReason!: string | null;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  sqConvertedDocType!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sqConvertedDocId!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  sqConvertedOn!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  sqApprovedOn!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sqApprovedBy!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  sqCancelledOn!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sqCancelledBy!: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  sqCancelReason!: string | null;

  @ApiPropertyOptional({ nullable: true })
  sqMrpSavings!: number | null;

  @ApiPropertyOptional({ nullable: true })
  sqMrpSavingsPerc!: number | null;

  @ApiProperty()
  sqPrintCount!: number;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  sqDeviceType!: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Originating device identifier' })
  sqDeviceId!: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  sqRemarks!: string | null;

  @ApiProperty()
  sqIsDeleted!: boolean;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  sqSyncDate!: string | null;

  @ApiProperty()
  sqCreatedOn!: string;

  @ApiProperty({ format: 'uuid' })
  sqCreatedBy!: string;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  sqModifiedOn!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sqModifiedBy!: string | null;

  // Not typed as ChargeMethod: these two are stored lower case (the save DTO
  // lower-cases them), so they never match an uppercase enum member.
  @ApiPropertyOptional({
    nullable: true,
    example: 'fixed',
    description:
      'How the freight charge is computed (snapshot of the charge master method), lower case',
  })
  sqFreightCalcType!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'fixed',
    description:
      'How the loading charge is computed (snapshot of the charge master method), lower case',
  })
  sqLoadingCalcType!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'true = discounts change the basis the charges are computed on',
  })
  sqDiscAlterBase!: boolean | null;

  @ApiProperty({ type: QuotationItemPayloadDto, isArray: true })
  items!: QuotationItemPayloadDto[];

  @ApiProperty({ type: QuotationChargePayloadDto, isArray: true })
  charges!: QuotationChargePayloadDto[];
}

export class QuotationDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  sqId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class QuotationSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Quotation fetched successfully' })
  message!: string;

  @ApiProperty({
    type: QuotationPayloadDto,
    description: 'Quotation record including its line items and applied charges',
  })
  data!: QuotationPayloadDto;
}

export class QuotationSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Quotation deleted successfully' })
  message!: string;

  @ApiProperty({ type: QuotationDeleteResultDto })
  data!: QuotationDeleteResultDto;
}
