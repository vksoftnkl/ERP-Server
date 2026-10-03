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
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { SaveChargeDetailDto } from '../../../master/charge-detail/dto/save-charge-detail.dto';
import { SaveTenderDetailDto } from '../../../accountsModule/tenderDetail/dto/save-tender-detail.dto';
import { TransportBandDto } from '../../bill/dto/bill-lifecycle.dto';
import { SaveDcReturnItemDto } from './save-dc-return-item.dto';

// GENERATED from information_schema for sales.sale_dc_return (2026-09-22) and then
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

export class SaveDcReturnDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'When provided, updates the existing DRAFT (uuidv7 minted by the client is accepted)',
  })
  @OptionalUuid()
  sdrId?: string;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sdrCompanyId!: string;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sdrBranchId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdrTenantId?: string | null;
  @ApiProperty({ maxLength: 9 })
  @TrimmedString(9)
  @IsNotEmpty()
  sdrAccYear!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdrSessionId?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdrCounterId?: string | null;
  @ApiProperty({ maxLength: 20 })
  @TrimmedString(20)
  @IsNotEmpty()
  sdrDeviceType!: string;
  @ApiProperty({})
  @TrimmedString()
  @IsNotEmpty()
  sdrDeviceId!: string;
  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @NullableStringStrict(30)
  sdrDocType?: string | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Ignored — server-owned' })
  @NullableInteger()
  sdrReturnSlno?: number | null;
  @ApiPropertyOptional({
    maxLength: 100,
    nullable: true,
    readOnly: true,
    description: 'Ignored — server-owned',
  })
  @NullableStringStrict(100)
  sdrReturnRefno?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sdrUsrRefno?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableDateString()
  sdrUsrRefdate?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableDateString()
  sdrReturnDate?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableDateString()
  sdrReturnDatetime?: string | null;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sdrDcId!: string;
  @ApiProperty({ maxLength: 9 })
  @TrimmedString(9)
  @IsNotEmpty()
  sdrDcAccYear!: string;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  sdrDcRefno?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableDateString()
  sdrDcDate?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdrReasonId?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  sdrReturnReason?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdrCustId?: string | null;
  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableStringStrict(200)
  sdrCustName?: string | null;
  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  @NullableStringStrict(15)
  sdrCustGstin?: string | null;
  @ApiPropertyOptional({ maxLength: 2, nullable: true })
  @NullableStringStrict(2)
  sdrCustStcd?: string | null;
  @ApiPropertyOptional({ maxLength: 2, nullable: true })
  @NullableStringStrict(2)
  sdrPosStcd?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdrDriverId?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdrSupervisorId?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableUuidArray()
  sdrLoadmanId?: string[];
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdrVehicleId?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  sdrVehicleNo?: string | null;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sdrUserId!: string;
  @ApiPropertyOptional({ nullable: true })
  @NullableUuidArray()
  sdrSalesmanId?: string[];
  @ApiPropertyOptional({ nullable: true })
  @NullableInteger()
  sdrTotItems?: number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdrTotWeight?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdrGrossAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdrTaxableAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdrTaxAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdrReturnAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  sdrTotalCost?: string | number | null;
  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @NullableStringStrict(500)
  sdrRemarks?: string | null;
  @ApiPropertyOptional({
    maxLength: 20,
    nullable: true,
    readOnly: true,
    description: 'Ignored — server-owned',
  })
  @NullableStringStrict(20)
  sdrStatus?: string | null;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    readOnly: true,
    description: 'Ignored — server-owned',
  })
  @NullableUuid()
  sdrPostedVoucherId?: string | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Ignored — server-owned' })
  @NullableInteger()
  sdrPrintCount?: number | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableStringStrict(50)
  sdrCreatedBy?: string | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableStringStrict(50)
  sdrModifiedBy?: string | null;

  @ApiPropertyOptional({ type: SaveDcReturnItemDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveDcReturnItemDto)
  items?: SaveDcReturnItemDto[];

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
export const SDR_OPTIONAL_FIELDS = [
  'sdrTenantId',
  'sdrSessionId',
  'sdrCounterId',
  'sdrDocType',
  'sdrUsrRefno',
  'sdrUsrRefdate',
  'sdrReturnDate',
  'sdrReturnDatetime',
  'sdrDcRefno',
  'sdrDcDate',
  'sdrReasonId',
  'sdrReturnReason',
  'sdrCustId',
  'sdrCustName',
  'sdrCustGstin',
  'sdrCustStcd',
  'sdrPosStcd',
  'sdrDriverId',
  'sdrSupervisorId',
  'sdrLoadmanId',
  'sdrVehicleId',
  'sdrVehicleNo',
  'sdrSalesmanId',
  'sdrTotItems',
  'sdrTotWeight',
  'sdrGrossAmt',
  'sdrTaxableAmt',
  'sdrTaxAmt',
  'sdrReturnAmt',
  'sdrTotalCost',
  'sdrRemarks',
  'sdrCreatedBy',
  'sdrModifiedBy',
] as const;
export const SDR_DATE_FIELDS = [
  'sdrUsrRefdate',
  'sdrReturnDate',
  'sdrReturnDatetime',
  'sdrDcDate',
] as const;
export const SDR_SERVER_OWNED = [
  'sdrReturnSlno',
  'sdrReturnRefno',
  'sdrStatus',
  'sdrPostedVoucherId',
  'sdrPrintCount',
] as const;
