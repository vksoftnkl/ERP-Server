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

// GENERATED from information_schema for sales.sale_dc_return_item (2026-09-22), hand-tuned.
export class SaveDcReturnItemDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'When provided, updates the existing line' })
  @OptionalUuid()
  sdriId?: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdriCompanyId?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdriBranchId?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdriTenantId?: string | null;
  @ApiPropertyOptional({ maxLength: 9, nullable: true })
  @NullableStringStrict(9)
  sdriAccYear?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableInteger()
  sdriLineNo?: number | null;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sdriDcItemId!: string;
  @ApiPropertyOptional({ maxLength: 9, nullable: true })
  @NullableStringStrict(9)
  sdriDcAccYear?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableInteger()
  sdriDcLineNo?: number | null;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sdriItemId!: string;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sdriItemUnitId!: string;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdriToBaseFactor?: string | number | null;
  @ApiPropertyOptional({ maxLength: 8, nullable: true })
  @NullableStringStrict(8)
  sdriHsnCode?: string | null;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sdriGodownId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdriLotId?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  sdriCondition?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  sdriBucket?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sdriBatchNo?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableDateString()
  sdriExpiryDate?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sdriSerialNo?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdriReturnQty?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdriFreeQty?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdriNetQty?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdriWeightQty?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdriRate?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdriCostPrice?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdriTaxableAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdriTaxPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdriTaxAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdriNetAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableInteger()
  sdriPriceLevel?: number | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sdriEanCode?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @OptionalBoolean()
  sdriIsTaxIncl?: boolean;
  @ApiPropertyOptional({ nullable: true })
  @OptionalBoolean()
  sdriIsService?: boolean;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdriRatePreTax?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdriMaxPrice?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdriItemDiscPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdriItemDiscAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdriSchDiscAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdriGrossAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdriCgstPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdriCgstAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdriSgstPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdriSgstAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdriIgstPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdriIgstAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdriCessPerc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdriCessPerUnit?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdriCessAmt?: string | number | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableStringStrict(50)
  sdriSize?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  sdriSizeUom?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdriTaxId?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  sdriRemarks?: string | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableStringStrict(50)
  sdriCreatedBy?: string | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableStringStrict(50)
  sdriModifiedBy?: string | null;
}

export const SDRI_OPTIONAL_FIELDS = [
  'sdriCompanyId',
  'sdriBranchId',
  'sdriTenantId',
  'sdriAccYear',
  'sdriLineNo',
  'sdriDcAccYear',
  'sdriDcLineNo',
  'sdriToBaseFactor',
  'sdriHsnCode',
  'sdriLotId',
  'sdriCondition',
  'sdriBucket',
  'sdriBatchNo',
  'sdriExpiryDate',
  'sdriSerialNo',
  'sdriReturnQty',
  'sdriFreeQty',
  'sdriNetQty',
  'sdriWeightQty',
  'sdriRate',
  'sdriCostPrice',
  'sdriTaxableAmt',
  'sdriTaxPerc',
  'sdriTaxAmt',
  'sdriNetAmt',
  'sdriPriceLevel',
  'sdriEanCode',
  'sdriIsTaxIncl',
  'sdriIsService',
  'sdriRatePreTax',
  'sdriMaxPrice',
  'sdriItemDiscPerc',
  'sdriItemDiscAmt',
  'sdriSchDiscAmt',
  'sdriGrossAmt',
  'sdriCgstPerc',
  'sdriCgstAmt',
  'sdriSgstPerc',
  'sdriSgstAmt',
  'sdriIgstPerc',
  'sdriIgstAmt',
  'sdriCessPerc',
  'sdriCessPerUnit',
  'sdriCessAmt',
  'sdriSize',
  'sdriSizeUom',
  'sdriTaxId',
  'sdriRemarks',
  'sdriCreatedBy',
  'sdriModifiedBy',
] as const;
export const SDRI_DATE_FIELDS = ['sdriExpiryDate'] as const;
