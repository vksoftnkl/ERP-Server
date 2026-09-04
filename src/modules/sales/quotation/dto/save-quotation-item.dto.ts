import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableDateString,
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
export class SaveQuotationItemDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, updates the existing line; otherwise a new line is created',
  })
  @OptionalUuid()
  sqiId?: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Owning quotation id (defaults to the parent quotation)',
  })
  @OptionalUuid()
  sqiQuoteId?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Defaults to the parent quotation scope' })
  @OptionalUuid()
  sqiCompanyId?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Defaults to the parent quotation scope' })
  @OptionalUuid()
  sqiBranchId?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Defaults to the parent quotation scope' })
  @OptionalUuid()
  sqiTenantId?: string;
  @ApiPropertyOptional({
    minLength: 9,
    maxLength: 9,
    description: 'Defaults to the parent quotation scope',
  })
  @OptionalTrimmedString(9)
  sqiAccYear?: string;
  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @NullableStringStrict(30)
  sqiSrcDocType?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sqiSrcItemId?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sqiSrcUnitId?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sqiSrcDocRefno?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sqiSrcItemQty?: string | number | null;
  @ApiProperty({
    format: 'uuid',
    description: 'item_unit_conversion.iucId — NOT item_unit_master.unit_id',
  })
  @RequiredUuid()
  sqiItemUnitId!: string;
  @ApiPropertyOptional({ description: 'Defaults to the 1-based position within the items array' })
  @OptionalInteger()
  sqiLineNo?: number;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sqiItemId!: string;
  @ApiPropertyOptional({ maxLength: 8, nullable: true })
  @NullableStringStrict(8)
  sqiHsnCode?: string | null;
  @ApiPropertyOptional({ description: 'Defaults to the parent quotation price level' })
  @OptionalInteger()
  sqiPriceLevel?: number;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sqiEanCode?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sqiBatchNo?: string | null;
  @ApiPropertyOptional({ type: 'string', format: 'date', nullable: true })
  @NullableDateString()
  sqiBatchDate?: string | null;
  @ApiPropertyOptional({ type: 'string', format: 'date', nullable: true })
  @NullableDateString()
  sqiExpiryDate?: string | null;
  @ApiPropertyOptional()
  @OptionalBoolean()
  sqiIsTaxIncl?: boolean;
  @ApiPropertyOptional()
  @OptionalBoolean()
  sqiIsPromo?: boolean;
  @ApiPropertyOptional()
  @OptionalBoolean()
  sqiIsFree?: boolean;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  sqiFreeType?: string | null;
  @ApiPropertyOptional()
  @OptionalBoolean()
  sqiIsService?: boolean;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiCaseQty?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiBillQty?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiLengthQty?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiNetQty?: string | number;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sqiWeightQty?: string | number | null;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiAvailableStock?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiRate?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiRatePreTax?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiItemDiscPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiItemDiscQty?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiItemDiscAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiSplDiscPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiSplDiscQty?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiSplDiscAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiSchDiscPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiSchDiscQty?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiSchDiscAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiBillSchPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiBillSchQty?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiBillSchAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiAddlDisc1Perc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiAddlDisc1Amt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiAddlDisc2Perc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiAddlDisc2Amt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiCashDiscPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiCashDiscAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiGrossAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiTaxableAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiTaxPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiTaxAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiCgstPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiCgstAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiSgstPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiSgstAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiIgstPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiIgstAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiCessPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiCessPerUnit?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiCessAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiAcessPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiAcessPerUnit?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiAcessAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiFreightQty?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiFreightAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiLoadQty?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiLoadAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiUnloadQty?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiUnloadAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiRoundOff?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sqiNetAmt?: string | number;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sqiCostPrice?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sqiMaxPrice?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sqiMinPrice?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sqiActPrice?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sqiQuotePrice?: string | number | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sqiItemProfit?: string | number | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sqiCostPreTax?: string | number | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sqiQuotePreTax?: string | number | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sqiProfitPreTax?: string | number | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sqiMrpSavings?: string | number | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sqiMrpSavingsPerc?: string | number | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sqiSchemeId?: string | null;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableStringStrict(150)
  sqiSchemeName?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  sqiRemarks?: string | null;

  // Text columns, not uuid — same as the header's sqCreatedBy / sqModifiedBy.
  @ApiPropertyOptional({ nullable: true, description: 'Actor id or name; defaults to the caller' })
  @NullableStringStrict()
  sqiCreatedBy?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Actor id or name; defaults to the caller' })
  @NullableStringStrict()
  sqiModifiedBy?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Line net/gross basis the charges sit on' })
  @NullableNumber()
  sqiNetGross?: string | number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Line charges landing before tax' })
  @NullableNumber()
  sqiChrgBeforeTax?: string | number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Line charges landing after tax' })
  @NullableNumber()
  sqiChrgAfterTax?: string | number | null;

  @ApiPropertyOptional({
    description: 'Snapshot of item_unit_conversion.iucToBaseFactor for sqiItemUnitId',
  })
  @OptionalNumber()
  sqiToBaseFactor?: string | number;

  @ApiPropertyOptional()
  @OptionalNumber()
  sqiRateDiff?: string | number;

  @ApiPropertyOptional()
  @OptionalBoolean()
  sqiHasFreight?: boolean;

  @ApiPropertyOptional({
    maxLength: 50,
    nullable: true,
    description:
      'Free-text dimension the operator typed, e.g. "12*6*2*10" — stored verbatim so a ' +
      'reprint shows the size the customer was quoted',
  })
  @NullableStringStrict(50)
  sqiSize?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  sqiSizeUom?: string | null;
}
