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
// One batch allocation row on a bill. The printed line = GROUP BY sbiLineNo;
// stock/GST reads rows as they are.
export class SaveBillItemDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, updates the existing line; otherwise a new line is created',
  })
  @OptionalUuid()
  sbiId?: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Owning bill id (defaults to the parent bill)',
  })
  @OptionalUuid()
  sbiBillId?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Defaults to the parent bill scope' })
  @OptionalUuid()
  sbiCompanyId?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Defaults to the parent bill scope' })
  @OptionalUuid()
  sbiBranchId?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Defaults to the parent bill scope' })
  @OptionalUuid()
  sbiTenantId?: string;
  @ApiPropertyOptional({
    minLength: 9,
    maxLength: 9,
    description: 'Defaults to the parent bill scope',
  })
  @OptionalTrimmedString(9)
  sbiAccYear?: string;
  @ApiPropertyOptional({ description: 'Defaults to the 1-based position within the items array' })
  @OptionalInteger()
  sbiLineNo?: number;
  @ApiPropertyOptional({ description: 'Which allocation within the printed line', default: 1 })
  @OptionalInteger(1)
  sbiSplitNo?: number;
  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @NullableStringStrict(30)
  sbiSrcDocType?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sbiSrcDocId?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sbiSrcDocRefno?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sbiSrcItemQty?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sbiSrcFreeQty?: string | number | null;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sbiItemId!: string;
  @ApiProperty({
    format: 'uuid',
    description: 'item_unit_conversion.iucId — NOT item_unit_master.unit_id',
  })
  @RequiredUuid()
  sbiItemUnitId!: string;
  @ApiPropertyOptional({
    description: 'Snapshot of item_unit_conversion.iucToBaseFactor for sbiItemUnitId',
  })
  @OptionalNumber()
  sbiToBaseFactor?: string | number;
  @ApiPropertyOptional({ maxLength: 8, nullable: true })
  @NullableStringStrict(8)
  sbiHsnCode?: string | null;
  @ApiPropertyOptional({ description: 'Defaults to the parent bill price level' })
  @OptionalInteger()
  sbiPriceLevel?: number;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sbiEanCode?: string | null;
  @ApiProperty({ format: 'uuid', description: 'The inventory godown the stock was taken from' })
  @RequiredUuid()
  sbiGodownId!: string;
  @ApiProperty({
    format: 'uuid',
    description: 'The inventory batch/stock row the quantity was taken from',
  })
  @RequiredUuid()
  sbiStockId!: string;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sbiBatchNo?: string | null;
  @ApiPropertyOptional({ type: 'string', format: 'date', nullable: true })
  @NullableDateString()
  sbiBatchDate?: string | null;
  @ApiPropertyOptional({ type: 'string', format: 'date', nullable: true })
  @NullableDateString()
  sbiExpiryDate?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sbiSerialNo?: string | null;
  @ApiPropertyOptional()
  @OptionalBoolean()
  sbiIsTaxIncl?: boolean;
  @ApiPropertyOptional()
  @OptionalBoolean()
  sbiIsPromo?: boolean;
  @ApiPropertyOptional()
  @OptionalBoolean()
  sbiIsFree?: boolean;
  @ApiPropertyOptional({
    maxLength: 20,
    nullable: true,
    description: 'NULL / SCHEME / SAMPLE / REPLACEMENT (ck_sbi_free_type in DB)',
  })
  @NullableStringStrict(20)
  sbiFreeType?: string | null;
  @ApiPropertyOptional()
  @OptionalBoolean()
  sbiIsService?: boolean;
  @ApiPropertyOptional()
  @OptionalBoolean()
  sbiHasFreight?: boolean;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiCaseQty?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiBillQty?: string | number;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sbiLengthQty?: string | number | null;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiNetQty?: string | number;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sbiWeightQty?: string | number | null;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiAvailableStock?: string | number;
  @ApiPropertyOptional({ description: 'Cache mirrored from sale_return' })
  @OptionalNumber()
  sbiReturnQty?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiRate?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiRatePreTax?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiRateDiff?: string | number;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sbiActPrice?: string | number | null;
  @ApiPropertyOptional({ nullable: true, description: 'MRP' })
  @NullableNumber()
  sbiMaxPrice?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sbiMinPrice?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sbiCostPrice?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sbiCostPreTax?: string | number | null;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiItemDiscPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiItemDiscQty?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiItemDiscAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiSplDiscPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiSplDiscQty?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiSplDiscAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiSchDiscPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiSchDiscQty?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiSchDiscAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiBillSchPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiBillSchQty?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiBillSchAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiAddlDisc1Perc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiAddlDisc1Amt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiAddlDisc2Perc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiAddlDisc2Amt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiCashDiscPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiCashDiscAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiGrossAmt?: string | number;
  @ApiPropertyOptional({ nullable: true, description: 'Line net/gross basis the charges sit on' })
  @NullableNumber()
  sbiNetGross?: string | number | null;
  @ApiPropertyOptional({ nullable: true, description: 'Line charges landing before tax' })
  @NullableNumber()
  sbiChrgBeforeTax?: string | number | null;
  @ApiPropertyOptional({ nullable: true, description: 'Line charges landing after tax' })
  @NullableNumber()
  sbiChrgAfterTax?: string | number | null;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiTaxableAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiTaxPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiTaxAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiCgstPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiCgstAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiSgstPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiSgstAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiIgstPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiIgstAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiCessPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiCessPerUnit?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiCessAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiAcessPerc?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiAcessPerUnit?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiAcessAmt?: string | number;
  @ApiPropertyOptional({
    description: "The item's batch configuration, snapshotted onto the line",
    default: 0,
  })
  @OptionalInteger(0)
  sbiBatchConfig?: number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiFreightQty?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiFreightAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiLoadQty?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiLoadAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiUnloadQty?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiUnloadAmt?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiRoundOff?: string | number;
  @ApiPropertyOptional()
  @OptionalNumber()
  sbiNetAmt?: string | number;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sbiSoldPrice?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sbiSoldPreTax?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sbiItemProfit?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sbiProfitPreTax?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sbiMrpSavings?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sbiMrpSavingsPerc?: string | number | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sbiSalesmanId?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sbiSchemeId?: string | null;
  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableStringStrict(150)
  sbiSchemeName?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  sbiRemarks?: string | null;
  // Uuid columns, unlike the header's text sbCreatedBy / sbModifiedBy.
  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Defaults to the caller' })
  @NullableUuid()
  sbiCreatedBy?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Defaults to the caller' })
  @NullableUuid()
  sbiModifiedBy?: string | null;
}
