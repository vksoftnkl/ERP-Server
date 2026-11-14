import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableDateString,
  NullableInteger,
  NullableNumber,
  NullableStringStrict,
  NullableUuid,
  OptionalBoolean,
  OptionalUuid,
  RequiredUuid,
} from 'src/common/dto/dtoDecorators';
import { IsIn, IsOptional } from 'class-validator';
import { OptionalStockBucket } from '../../posting/sales-dto.decorators';

// GENERATED from information_schema for sales.sale_return_item (2026-09-22), hand-tuned.
export class SaveSaleReturnItemDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'When provided, updates the existing line' })
  @OptionalUuid()
  sriId?: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sriCompanyId?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sriBranchId?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sriTenantId?: string | null;
  @ApiPropertyOptional({ maxLength: 9, nullable: true })
  @NullableStringStrict(9)
  sriAccYear?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableInteger()
  sriLineNo?: number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableInteger()
  sriSplitNo?: number | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sriBillItemId?: string | null;
  @ApiPropertyOptional({ maxLength: 9, nullable: true })
  @NullableStringStrict(9)
  sriBillAccYear?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableInteger()
  sriBillLineNo?: number | null;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sriItemId!: string;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sriItemUnitId!: string;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriToBaseFactor?: string | number | null;
  @ApiPropertyOptional({ maxLength: 8, nullable: true })
  @NullableStringStrict(8)
  sriHsnCode?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sriTaxId?: string | null;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sriGodownId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sriLotId?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sriBatchNo?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableDateString()
  sriBatchDate?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableDateString()
  sriExpiryDate?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sriSerialNo?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  sriCondition?: string | null;
  // Applied after OptionalStockBucket's own, so this description wins in Swagger.
  @ApiPropertyOptional({
    description:
      'Accepted and IGNORED: the server takes the bucket from sriCondition (D12; user 2026-11-14) — ' +
      'a CLAIM line EXPIRED for an expired condition, else DAMAGED.',
  })
  @OptionalStockBucket()
  sriBucket?: string;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriCaseQty?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriReturnQty?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriFreeQty?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriNetQty?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriWeightQty?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriRate?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriRatePreTax?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriMaxPrice?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriCostPrice?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriGrossAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriDiscAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriTaxableAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriTaxPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriCgstPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriCgstAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriSgstPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriSgstAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriIgstPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriIgstAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriCessPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriCessAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriTaxAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriRoundOff?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriNetAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableInteger()
  sriPriceLevel?: number | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sriEanCode?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @OptionalBoolean()
  sriIsTaxIncl?: boolean;
  @ApiPropertyOptional({ nullable: true })
  @OptionalBoolean()
  sriIsPromo?: boolean;
  @ApiPropertyOptional({ nullable: true })
  @OptionalBoolean()
  sriIsFree?: boolean;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  sriFreeType?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @OptionalBoolean()
  sriIsService?: boolean;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriActPrice?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriMinPrice?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriItemDiscPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriItemDiscAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriSplDiscPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriSplDiscAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriSchDiscPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriSchDiscAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriBillSchAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriChrgBeforeTax?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriChrgAfterTax?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriCessPerUnit?: string | number | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sriSalesmanId?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sriSchemeId?: string | null;
  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableStringStrict(150)
  sriSchemeName?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sriLoyaltyPoints?: string | number | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableStringStrict(50)
  sriSize?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  sriSizeUom?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  sriRemarks?: string | null;
  // ── Sale Return screen (plan v5 §5.2, migration 20261113160000) ────────
  // The money / rate / cost columns below are worked out by the server from
  // the bill line (D45): accepted so a /get echoed back passes the
  // whitelist, and overwritten on every save.
  @ApiPropertyOptional({
    maxLength: 10,
    nullable: true,
    enum: ['BACK', 'DESTROYED'],
    description: 'A CLAIM line: the goods come Back, or were Destroyed at the shop (D23)',
  })
  @IsOptional()
  @IsIn(['BACK', 'DESTROYED'])
  sriClaimGoods?: string | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Server-owned' })
  @OptionalBoolean()
  sriSupplierClaim?: boolean;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Server-owned (D45)' })
  @NullableNumber()
  sriItemDiscQty?: string | number | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Server-owned (D45)' })
  @NullableNumber()
  sriSplDiscQty?: string | number | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Server-owned (D45)' })
  @NullableNumber()
  sriSchDiscQty?: string | number | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Server-owned (D45)' })
  @NullableNumber()
  sriBillSchPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Server-owned (D45)' })
  @NullableNumber()
  sriBillSchQty?: string | number | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Server-owned (D45)' })
  @NullableNumber()
  sriAddlDisc1Perc?: string | number | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Server-owned (D45)' })
  @NullableNumber()
  sriAddlDisc1Amt?: string | number | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Server-owned (D45)' })
  @NullableNumber()
  sriAddlDisc2Perc?: string | number | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Server-owned (D45)' })
  @NullableNumber()
  sriAddlDisc2Amt?: string | number | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Server-owned (D45)' })
  @NullableNumber()
  sriCashDiscPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Server-owned (D45)' })
  @NullableNumber()
  sriCashDiscAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Server-owned (D45)' })
  @NullableNumber()
  sriNetGross?: string | number | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Server-owned (D45)' })
  @NullableNumber()
  sriAcessPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Server-owned (D45)' })
  @NullableNumber()
  sriAcessPerUnit?: string | number | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Server-owned (D45)' })
  @NullableNumber()
  sriAcessAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Server-owned (D45)' })
  @NullableNumber()
  sriLoyaltyPv?: string | number | null;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    readOnly: true,
    description: 'Server-owned',
  })
  @NullableUuid()
  sriPromoUsageId?: string | null;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    readOnly: true,
    description: 'Server-owned',
  })
  @NullableUuid()
  sriQtyPriceId?: string | null;
  @ApiPropertyOptional({
    nullable: true,
    readOnly: true,
    description: 'Server-owned: the COGS taken back (D54)',
  })
  @NullableNumber()
  sriCogsAmt?: string | number | null;
  @ApiPropertyOptional({
    maxLength: 12,
    nullable: true,
    readOnly: true,
    enum: ['BILL', 'LAST_SALE', 'TODAY_PRICE'],
    description: 'Server-owned: where the rate came from (D56)',
  })
  @NullableStringStrict(12)
  sriRateSource?: string | null;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      "A no-bill line: the customer's bill line (grid 211) whose rate it uses (D56 step 2). Omit to let the server take the last sale in the window.",
  })
  @NullableUuid()
  sriRateSrcItemId?: string | null;
  @ApiPropertyOptional({
    maxLength: 9,
    nullable: true,
    description: 'The year of sriRateSrcItemId',
  })
  @NullableStringStrict(9)
  sriRateSrcAccYear?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableStringStrict(50)
  sriCreatedBy?: string | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableStringStrict(50)
  sriModifiedBy?: string | null;
}

export const SRI_OPTIONAL_FIELDS = [
  'sriCompanyId',
  'sriBranchId',
  'sriTenantId',
  'sriAccYear',
  'sriLineNo',
  'sriSplitNo',
  'sriBillItemId',
  'sriBillAccYear',
  'sriBillLineNo',
  'sriToBaseFactor',
  'sriHsnCode',
  'sriTaxId',
  'sriLotId',
  'sriBatchNo',
  'sriBatchDate',
  'sriExpiryDate',
  'sriSerialNo',
  'sriCondition',
  'sriBucket',
  'sriCaseQty',
  'sriReturnQty',
  'sriFreeQty',
  'sriNetQty',
  'sriWeightQty',
  'sriRate',
  'sriRatePreTax',
  'sriMaxPrice',
  'sriCostPrice',
  'sriGrossAmt',
  'sriDiscAmt',
  'sriTaxableAmt',
  'sriTaxPerc',
  'sriCgstPerc',
  'sriCgstAmt',
  'sriSgstPerc',
  'sriSgstAmt',
  'sriIgstPerc',
  'sriIgstAmt',
  'sriCessPerc',
  'sriCessAmt',
  'sriTaxAmt',
  'sriRoundOff',
  'sriNetAmt',
  'sriPriceLevel',
  'sriEanCode',
  'sriIsTaxIncl',
  'sriIsPromo',
  'sriIsFree',
  'sriFreeType',
  'sriIsService',
  'sriActPrice',
  'sriMinPrice',
  'sriItemDiscPerc',
  'sriItemDiscAmt',
  'sriSplDiscPerc',
  'sriSplDiscAmt',
  'sriSchDiscPerc',
  'sriSchDiscAmt',
  'sriBillSchAmt',
  'sriChrgBeforeTax',
  'sriChrgAfterTax',
  'sriCessPerUnit',
  'sriSalesmanId',
  'sriSchemeId',
  'sriSchemeName',
  'sriLoyaltyPoints',
  'sriSize',
  'sriSizeUom',
  'sriRemarks',
  'sriCreatedBy',
  'sriModifiedBy',
  'sriClaimGoods',
  'sriSupplierClaim',
  'sriItemDiscQty',
  'sriSplDiscQty',
  'sriSchDiscQty',
  'sriBillSchPerc',
  'sriBillSchQty',
  'sriAddlDisc1Perc',
  'sriAddlDisc1Amt',
  'sriAddlDisc2Perc',
  'sriAddlDisc2Amt',
  'sriCashDiscPerc',
  'sriCashDiscAmt',
  'sriNetGross',
  'sriAcessPerc',
  'sriAcessPerUnit',
  'sriAcessAmt',
  'sriLoyaltyPv',
  'sriPromoUsageId',
  'sriQtyPriceId',
  'sriCogsAmt',
  'sriRateSource',
  'sriRateSrcItemId',
  'sriRateSrcAccYear',
] as const;
export const SRI_DATE_FIELDS = ['sriBatchDate', 'sriExpiryDate'] as const;
