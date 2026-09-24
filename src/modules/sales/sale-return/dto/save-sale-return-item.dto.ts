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
] as const;
export const SRI_DATE_FIELDS = ['sriBatchDate', 'sriExpiryDate'] as const;
