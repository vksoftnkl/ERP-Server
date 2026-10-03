import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import {
  NullableDateString,
  NullableInteger,
  NullableStringStrict,
  NullableUuid,
  OptionalBoolean,
  RequiredInteger,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { SaveTenderDetailDto } from '../../../accountsModule/tenderDetail/dto/save-tender-detail.dto';
import { SaveBillAdjustmentDto } from './save-bill-adjustment.dto';
import { SaveBillDto } from './save-bill.dto';

/**
 * HANDOVER §1.1 — the four keys every verb that acts on an existing bill takes.
 *
 * `(sbId, sbAccYear)` is the primary key — `sale_bill` is partitioned on the
 * year. The company and the branch are not redundant with it: a uuid is a
 * bearer token, and without them anyone holding one could read or cancel a
 * bill of a company they have no business in.
 */
export class BillKeysDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sbId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sbCompanyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sbBranchId!: string;

  @ApiProperty({ minLength: 9, maxLength: 9, example: '2026-2027' })
  @TrimmedString(9)
  @IsNotEmpty()
  sbAccYear!: string;
}

const OverridesList = () =>
  [IsOptional(), IsArray(), ArrayMaxSize(50), IsString({ each: true })] as const;

/** §2.2 — `/bills/validate`: the create body plus the codes the operator overrides. */
export class ValidateBillDto extends SaveBillDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'WARN codes the operator overrides (needs um_can_override)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  overrides?: string[];
}

/** §2.3 — `/bills/post`. */
export class PostBillDto extends BillKeysDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  overrides?: string[];

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  printAfter?: boolean;

  @ApiPropertyOptional({
    type: SaveBillAdjustmentDto,
    isArray: true,
    description:
      'The credits to set off against this bill. Omitted → the server applies the party’s open ' +
      'advances (the bill’s own order first) and credit notes FIFO up to sbAdvanceAmt.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveBillAdjustmentDto)
  adjustments?: SaveBillAdjustmentDto[];
}

/** §2.4 — `/bills/cancel`. The reason is mandatory (`ck_tsl_reason_required`). */
export class CancelBillDto extends BillKeysDto {
  @ApiProperty({ maxLength: 250 })
  @TrimmedString(250)
  @IsNotEmpty()
  reason!: string;
}

/** §2.5 — `/bills/amend`: R20 on the bill. */
export class AmendBillDto extends ValidateBillDto {
  @ApiProperty({ format: 'uuid', description: 'Required on amend — the POSTED bill' })
  @RequiredUuid()
  declare sbId: string;

  @ApiProperty({ description: 'The sbRevisionNo the client loaded — the optimistic lock' })
  @RequiredInteger(1)
  baseRevision!: number;

  @ApiProperty({ maxLength: 250 })
  @TrimmedString(250)
  @IsNotEmpty()
  editRemark!: string;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  printAfter?: boolean;
}

/** §2.6 — `/bills/delete`, DRAFT only. */
export class DeleteBillDto extends BillKeysDto {}

export const DELIVERY_EVENTS = ['VERIFIED', 'PACKED', 'DISPATCHED', 'DELIVERED'] as const;
export type DeliveryEvent = (typeof DELIVERY_EVENTS)[number];

/** §2.10 — `PUT /bills/delivery-status`. */
export class DeliveryStatusDto extends BillKeysDto {
  @ApiProperty({ enum: DELIVERY_EVENTS })
  @IsIn(DELIVERY_EVENTS)
  event!: DeliveryEvent;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  remarks?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  vehicleNo?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableStringStrict(50)
  lrNo?: string | null;
}

/** §2.11 — `PUT /bills/update-remarks`. */
export class UpdateRemarksDto extends BillKeysDto {
  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @NullableStringStrict(500)
  sbRemarks?: string | null;

  @ApiProperty({ maxLength: 250 })
  @TrimmedString(250)
  @IsNotEmpty()
  editRemark!: string;
}

/** One end of the transport band — the dispatch (from) or the ship-to (to). */
export class TransportEndDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  godownId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  branchId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'accounts.acc_ship_addrs.saa_id',
  })
  @NullableUuid()
  addrId?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableStringStrict(200)
  name?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @NullableStringStrict(500)
  addr?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  place?: string | null;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableStringStrict(10)
  pin?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  phone?: string | null;

  @ApiPropertyOptional({ minLength: 2, maxLength: 2, nullable: true })
  @NullableStringStrict(2)
  stcd?: string | null;

  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  @NullableStringStrict(15)
  gstin?: string | null;
}

export const TRANSPORT_DIRECTIONS = ['OUTWARD', 'INWARD'] as const;

/** §2.12 — the band body, shared by bills, challans and both returns. */
export class TransportBandDto {
  @ApiProperty({ enum: TRANSPORT_DIRECTIONS })
  @IsIn(TRANSPORT_DIRECTIONS)
  direction!: 'OUTWARD' | 'INWARD';

  @ApiPropertyOptional({ type: TransportEndDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => TransportEndDto)
  from?: TransportEndDto | null;

  @ApiPropertyOptional({ type: TransportEndDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => TransportEndDto)
  to?: TransportEndDto | null;

  @ApiPropertyOptional({ maxLength: 10, nullable: true, description: 'ROAD | RAIL | AIR | SHIP' })
  @NullableStringStrict(10)
  mode?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  transporterId?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableStringStrict(200)
  transporterName?: string | null;

  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  @NullableStringStrict(15)
  transporterGstin?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableStringStrict(50)
  lrNo?: string | null;

  @ApiPropertyOptional({ type: 'string', format: 'date', nullable: true })
  @NullableDateString()
  lrDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableInteger(0)
  distanceKm?: number | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  remarks?: string | null;
}

export class BillTransportDto extends BillKeysDto {
  @ApiProperty({ type: TransportBandDto })
  @ValidateNested()
  @Type(() => TransportBandDto)
  transport!: TransportBandDto;
}

export const VOID_REASONS = [
  'UPI_FAILED',
  'CARD_DECLINED',
  'CHEQUE_REFUSED',
  'KEYED_WRONG',
  'CUSTOMER_CHANGED',
  'OTHER',
] as const;

export class RetenderVoidDto {
  @ApiProperty({ format: 'uuid', description: 'The acc_tender_detail row that did not happen' })
  @RequiredUuid()
  tdId!: string;

  @ApiProperty({ enum: VOID_REASONS })
  @IsIn(VOID_REASONS)
  reason!: (typeof VOID_REASONS)[number];
}

/** §2.13 — `/bills/retender`: change how it was paid, not what was sold. */
export class RetenderBillDto extends BillKeysDto {
  @ApiProperty({ type: RetenderVoidDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RetenderVoidDto)
  voids!: RetenderVoidDto[];

  @ApiProperty({ type: SaveTenderDetailDto, isArray: true, description: 'What really happened' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveTenderDetailDto)
  tenders!: SaveTenderDetailDto[];

  @ApiProperty({ maxLength: 250 })
  @TrimmedString(250)
  @IsNotEmpty()
  remark!: string;
}

void OverridesList;
