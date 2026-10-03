import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import {
  NullableDateString,
  NullableInteger,
  NullableNumber,
  NullableStringStrict,
  NullableUuid,
  OptionalBoolean,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { SaveChargeDetailDto } from '../../../master/charge-detail/dto/save-charge-detail.dto';
import { SaveTenderDetailDto } from '../../../accountsModule/tenderDetail/dto/save-tender-detail.dto';
import { TransportBandDto } from '../../bill/dto/bill-lifecycle.dto';
import { SaveDeliveryChallanItemDto } from './save-delivery-challan-item.dto';

// GENERATED from information_schema for sales.sale_dc (2026-09-22) and then
// hand-tuned: every column is accepted so forbidNonWhitelisted never rejects a
// GET echoed back, server-owned columns are ignored on input (see the service),
// and only the keys a new document genuinely needs are required.
const toUuidArray = (value: unknown): string[] | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return [];
  if (Array.isArray(value)) return value.map((e) => (typeof e === 'string' ? e.trim() : String(e)));
  if (typeof value === 'string')
    return value
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
  return value as string[];
};
const NullableUuidArray = () =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }: { value: unknown }) => toUuidArray(value)),
    IsArray(),
    IsUUID('all', { each: true }),
  );

export class SaveDeliveryChallanDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'When provided, updates the existing DRAFT (uuidv7 minted by the client is accepted)',
  })
  @OptionalUuid()
  sdcId?: string;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sdcCompanyId!: string;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sdcBranchId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdcTenantId?: string | null;
  @ApiProperty({ maxLength: 9 })
  @TrimmedString(9)
  @IsNotEmpty()
  sdcAccYear!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdcSessionId?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdcCounterId?: string | null;
  @ApiProperty({ maxLength: 20 })
  @TrimmedString(20)
  @IsNotEmpty()
  sdcDeviceType!: string;
  @ApiProperty({})
  @TrimmedString()
  @IsNotEmpty()
  sdcDeviceId!: string;
  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @NullableStringStrict(30)
  sdcDocType?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  sdcPurpose?: string | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Ignored — server-owned' })
  @NullableInteger()
  sdcDcSlno?: number | null;
  @ApiPropertyOptional({
    maxLength: 100,
    nullable: true,
    readOnly: true,
    description: 'Ignored — server-owned',
  })
  @NullableStringStrict(100)
  sdcDcRefno?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sdcUsrRefno?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableDateString()
  sdcUsrRefdate?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableDateString()
  sdcDcDate?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableDateString()
  sdcDcDatetime?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableInteger()
  sdcPriceLevel?: number | null;
  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @NullableStringStrict(30)
  sdcSrcDocType?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdcSrcDocId?: string | null;
  @ApiPropertyOptional({ maxLength: 9, nullable: true })
  @NullableStringStrict(9)
  sdcSrcDocAccYear?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sdcSrcDocRefno?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableDateString()
  sdcSrcDocDate?: string | null;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sdcCustId!: string;
  @ApiProperty({ maxLength: 200 })
  @TrimmedString(200)
  @IsNotEmpty()
  sdcCustName!: string;
  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @NullableStringStrict(500)
  sdcCustAddr?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sdcCustPlace?: string | null;
  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableStringStrict(10)
  sdcCustPin?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  sdcCustPhone?: string | null;
  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  @NullableStringStrict(15)
  sdcCustGstin?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  sdcCustGstType?: string | null;
  @ApiPropertyOptional({ maxLength: 2, nullable: true })
  @NullableStringStrict(2)
  sdcCustStcd?: string | null;
  @ApiPropertyOptional({ maxLength: 2, nullable: true })
  @NullableStringStrict(2)
  sdcPosStcd?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sdcStateName?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdcDriverId?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdcSupervisorId?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableUuidArray()
  sdcLoadmanId?: string[];
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdcVehicleId?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  sdcVehicleNo?: string | null;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sdcUserId!: string;
  @ApiPropertyOptional({ nullable: true })
  @NullableUuidArray()
  sdcSalesmanId?: string[];
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdcAgentId?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableInteger()
  sdcTotItems?: number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdcTotWeight?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdcTotBags?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdcGrossAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdcDiscAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdcTaxableAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdcCgstAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdcSgstAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdcIgstAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdcCessAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdcTaxAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdcOtherAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdcRoundOff?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdcDcAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdcTotalCost?: string | number | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Ignored — server-owned' })
  @NullableNumber()
  sdcBilledAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Ignored — server-owned' })
  @NullableNumber()
  sdcReturnedAmt?: string | number | null;
  @ApiPropertyOptional({
    maxLength: 20,
    nullable: true,
    readOnly: true,
    description: 'Ignored — server-owned',
  })
  @NullableStringStrict(20)
  sdcFulfilStatus?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @OptionalBoolean()
  sdcHasLoad?: boolean;
  @ApiPropertyOptional({ nullable: true })
  @OptionalBoolean()
  sdcHasUnload?: boolean;
  @ApiPropertyOptional({ nullable: true })
  @OptionalBoolean()
  sdcHasFreight?: boolean;
  @ApiPropertyOptional({ nullable: true })
  @OptionalBoolean()
  sdcHasPromo?: boolean;
  @ApiPropertyOptional({ nullable: true })
  @NullableUuidArray()
  sdcPackedId?: string[];
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdcItemDisc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdcSplDisc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdcSchDisc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdcFreightAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdcLoadAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdcUnloadAmt?: string | number | null;
  @ApiPropertyOptional({ maxLength: 12, nullable: true })
  @NullableStringStrict(12)
  sdcFreightCalcType?: string | null;
  @ApiPropertyOptional({ maxLength: 12, nullable: true })
  @NullableStringStrict(12)
  sdcLoadingCalcType?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @OptionalBoolean()
  sdcDiscAlterBase?: boolean;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdcRoundOffStep?: string | number | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  sdcPaymentTerms?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  sdcDeliveryTerms?: string | null;
  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @NullableStringStrict(500)
  sdcRemarks?: string | null;
  @ApiPropertyOptional({
    maxLength: 20,
    nullable: true,
    readOnly: true,
    description: 'Ignored — server-owned',
  })
  @NullableStringStrict(20)
  sdcStatus?: string | null;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    readOnly: true,
    description: 'Ignored — server-owned',
  })
  @NullableUuid()
  sdcPostedVoucherId?: string | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Ignored — server-owned' })
  @NullableInteger()
  sdcRevisionNo?: number | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Ignored — server-owned' })
  @NullableInteger()
  sdcPrintCount?: number | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableStringStrict(50)
  sdcCreatedBy?: string | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableStringStrict(50)
  sdcModifiedBy?: string | null;

  @ApiPropertyOptional({ type: SaveDeliveryChallanItemDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveDeliveryChallanItemDto)
  items?: SaveDeliveryChallanItemDto[];

  @ApiPropertyOptional({ type: SaveChargeDetailDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveChargeDetailDto)
  charges?: SaveChargeDetailDto[];

  @ApiPropertyOptional({ type: SaveTenderDetailDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveTenderDetailDto)
  tenders?: SaveTenderDetailDto[];

  @ApiPropertyOptional({
    type: TransportBandDto,
    nullable: true,
    description: 'The transport band, written to public.txn_transport_detail',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TransportBandDto)
  transport?: TransportBandDto | null;
}

/** The columns a save copies when present (server-owned ones excluded). */
export const SDC_OPTIONAL_FIELDS = [
  'sdcTenantId',
  'sdcSessionId',
  'sdcCounterId',
  'sdcDocType',
  'sdcPurpose',
  'sdcUsrRefno',
  'sdcUsrRefdate',
  'sdcDcDate',
  'sdcDcDatetime',
  'sdcPriceLevel',
  'sdcSrcDocType',
  'sdcSrcDocId',
  'sdcSrcDocAccYear',
  'sdcSrcDocRefno',
  'sdcSrcDocDate',
  'sdcCustAddr',
  'sdcCustPlace',
  'sdcCustPin',
  'sdcCustPhone',
  'sdcCustGstin',
  'sdcCustGstType',
  'sdcCustStcd',
  'sdcPosStcd',
  'sdcStateName',
  'sdcDriverId',
  'sdcSupervisorId',
  'sdcLoadmanId',
  'sdcVehicleId',
  'sdcVehicleNo',
  'sdcSalesmanId',
  'sdcAgentId',
  'sdcTotItems',
  'sdcTotWeight',
  'sdcTotBags',
  'sdcGrossAmt',
  'sdcDiscAmt',
  'sdcTaxableAmt',
  'sdcCgstAmt',
  'sdcSgstAmt',
  'sdcIgstAmt',
  'sdcCessAmt',
  'sdcTaxAmt',
  'sdcOtherAmt',
  'sdcRoundOff',
  'sdcDcAmt',
  'sdcTotalCost',
  'sdcHasLoad',
  'sdcHasUnload',
  'sdcHasFreight',
  'sdcHasPromo',
  'sdcPackedId',
  'sdcItemDisc',
  'sdcSplDisc',
  'sdcSchDisc',
  'sdcFreightAmt',
  'sdcLoadAmt',
  'sdcUnloadAmt',
  'sdcFreightCalcType',
  'sdcLoadingCalcType',
  'sdcDiscAlterBase',
  'sdcRoundOffStep',
  'sdcPaymentTerms',
  'sdcDeliveryTerms',
  'sdcRemarks',
  'sdcCreatedBy',
  'sdcModifiedBy',
] as const;
export const SDC_DATE_FIELDS = [
  'sdcUsrRefdate',
  'sdcDcDate',
  'sdcDcDatetime',
  'sdcSrcDocDate',
] as const;
export const SDC_SERVER_OWNED = [
  'sdcDcSlno',
  'sdcDcRefno',
  'sdcBilledAmt',
  'sdcReturnedAmt',
  'sdcFulfilStatus',
  'sdcStatus',
  'sdcPostedVoucherId',
  'sdcRevisionNo',
  'sdcPrintCount',
] as const;
