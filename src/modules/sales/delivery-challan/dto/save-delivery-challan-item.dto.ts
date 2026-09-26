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

// GENERATED from information_schema for sales.sale_dc_item (2026-09-22), hand-tuned.
export class SaveDeliveryChallanItemDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'When provided, updates the existing line' })
  @OptionalUuid()
  sdiId?: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdiCompanyId?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdiBranchId?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdiTenantId?: string | null;
  @ApiPropertyOptional({ maxLength: 9, nullable: true })
  @NullableStringStrict(9)
  sdiAccYear?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableInteger()
  sdiLineNo?: number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableInteger()
  sdiSplitNo?: number | null;
  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @NullableStringStrict(30)
  sdiSrcDocType?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdiSrcDocId?: string | null;
  @ApiPropertyOptional({ maxLength: 9, nullable: true })
  @NullableStringStrict(9)
  sdiSrcDocAccYear?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sdiSrcDocRefno?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableInteger()
  sdiSrcLineNo?: number | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdiSrcItemId?: string | null;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sdiItemId!: string;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sdiItemUnitId!: string;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiToBaseFactor?: string | number | null;
  @ApiPropertyOptional({ maxLength: 8, nullable: true })
  @NullableStringStrict(8)
  sdiHsnCode?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdiTaxId?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableInteger()
  sdiPriceLevel?: number | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sdiEanCode?: string | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableStringStrict(50)
  sdiSize?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  sdiSizeUom?: string | null;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sdiGodownId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdiLotId?: string | null;
  @OptionalStockBucket()
  sdiBucket?: string;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sdiBatchNo?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableDateString()
  sdiBatchDate?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableDateString()
  sdiExpiryDate?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sdiSerialNo?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @OptionalBoolean()
  sdiIsFree?: boolean;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  sdiFreeType?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @OptionalBoolean()
  sdiIsService?: boolean;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiCaseQty?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiDcQty?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiFreeQty?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiNetQty?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiWeightQty?: string | number | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Ignored — server-owned' })
  @NullableNumber()
  sdiBilledQty?: string | number | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Ignored — server-owned' })
  @NullableNumber()
  sdiReturnedQty?: string | number | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Ignored — server-owned' })
  @NullableNumber()
  sdiOpenQty?: string | number | null;
  @ApiPropertyOptional({
    maxLength: 20,
    nullable: true,
    readOnly: true,
    description: 'Ignored — server-owned',
  })
  @NullableStringStrict(20)
  sdiLineStatus?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiRate?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiRatePreTax?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiMaxPrice?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiCostPrice?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @OptionalBoolean()
  sdiIsTaxIncl?: boolean;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiDiscPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiDiscAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiGrossAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiTaxableAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiTaxPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiCgstPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiCgstAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiSgstPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiSgstAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiIgstPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiIgstAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiCessPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiCessAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiTaxAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiNetAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @OptionalBoolean()
  sdiIsPromo?: boolean;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiActPrice?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiMinPrice?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiItemDiscPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiItemDiscAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiSplDiscPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiSplDiscAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiSchDiscPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiSchDiscAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiChrgBeforeTax?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiChrgAfterTax?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdiCessPerUnit?: string | number | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdiSalesmanId?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdiSchemeId?: string | null;
  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableStringStrict(150)
  sdiSchemeName?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  sdiRemarks?: string | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableStringStrict(50)
  sdiCreatedBy?: string | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableStringStrict(50)
  sdiModifiedBy?: string | null;
}

export const SDI_OPTIONAL_FIELDS = [
  'sdiCompanyId',
  'sdiBranchId',
  'sdiTenantId',
  'sdiAccYear',
  'sdiLineNo',
  'sdiSplitNo',
  'sdiSrcDocType',
  'sdiSrcDocId',
  'sdiSrcDocAccYear',
  'sdiSrcDocRefno',
  'sdiSrcLineNo',
  'sdiSrcItemId',
  'sdiToBaseFactor',
  'sdiHsnCode',
  'sdiTaxId',
  'sdiPriceLevel',
  'sdiEanCode',
  'sdiSize',
  'sdiSizeUom',
  'sdiLotId',
  'sdiBucket',
  'sdiBatchNo',
  'sdiBatchDate',
  'sdiExpiryDate',
  'sdiSerialNo',
  'sdiIsFree',
  'sdiFreeType',
  'sdiIsService',
  'sdiCaseQty',
  'sdiDcQty',
  'sdiFreeQty',
  'sdiNetQty',
  'sdiWeightQty',
  'sdiRate',
  'sdiRatePreTax',
  'sdiMaxPrice',
  'sdiCostPrice',
  'sdiIsTaxIncl',
  'sdiDiscPerc',
  'sdiDiscAmt',
  'sdiGrossAmt',
  'sdiTaxableAmt',
  'sdiTaxPerc',
  'sdiCgstPerc',
  'sdiCgstAmt',
  'sdiSgstPerc',
  'sdiSgstAmt',
  'sdiIgstPerc',
  'sdiIgstAmt',
  'sdiCessPerc',
  'sdiCessAmt',
  'sdiTaxAmt',
  'sdiNetAmt',
  'sdiIsPromo',
  'sdiActPrice',
  'sdiMinPrice',
  'sdiItemDiscPerc',
  'sdiItemDiscAmt',
  'sdiSplDiscPerc',
  'sdiSplDiscAmt',
  'sdiSchDiscPerc',
  'sdiSchDiscAmt',
  'sdiChrgBeforeTax',
  'sdiChrgAfterTax',
  'sdiCessPerUnit',
  'sdiSalesmanId',
  'sdiSchemeId',
  'sdiSchemeName',
  'sdiRemarks',
  'sdiCreatedBy',
  'sdiModifiedBy',
] as const;
export const SDI_DATE_FIELDS = ['sdiBatchDate', 'sdiExpiryDate'] as const;
