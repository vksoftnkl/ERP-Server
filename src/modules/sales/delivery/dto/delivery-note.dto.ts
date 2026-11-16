import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import {
  NullableDateString,
  NullableStringStrict,
  NullableUuid,
  OptionalBoolean,
  OptionalInteger,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { DELIVERY_NOTE_MODES } from '../core/delivery.constants';

/**
 * Plan §8.1 — /delivery-notes/*. Quantities travel as decimal strings or
 * numbers and are read into Prisma.Decimal by the service (never a float sum).
 */

const QTY_PATTERN = /^-?\d{1,11}(\.\d{1,3})?$/;

/** A quantity: string or number, up to 3 decimals. Negative values reach the rules (DN_QTY_NEGATIVE). */
const QtyValue = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : value,
  );

const UpperTrim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  );

export class DeliveryNoteLineDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'The line id. Send your own uuidv7 on a new line so a re-sent save finds it; omit = new line.',
  })
  @OptionalUuid()
  sdniId?: string;

  @ApiProperty({ format: 'uuid', description: 'The bill (sb_id)' })
  @RequiredUuid()
  billId!: string;

  @ApiProperty({ example: '2026-2027' })
  @TrimmedString(9)
  @IsNotEmpty()
  billAccYear!: string;

  @ApiProperty({ format: 'uuid', description: 'The bill line (sbi_id)' })
  @RequiredUuid()
  billItemId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      "The giving godown — must be the note's (one note = one godown). Omitted = the note's. " +
      "A line billed from another godown needs the Override right (DN_GODOWN_RIGHT / DN_OTHER_GODOWN).",
  })
  @OptionalUuid()
  godownId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: "The lot given. Omitted / null = the bill line's lot. Another lot → a lot swap at post (DN_LOT_SWAP).",
  })
  @NullableUuid()
  lotId?: string | null;

  @ApiProperty({
    type: 'string',
    example: '20',
    description: 'Give now, in the bill line\'s unit (≥ 0; 0 keeps the line on a draft). Decimal string or number.',
  })
  @QtyValue()
  @IsString()
  @IsNotEmpty()
  qty!: string;

  @ApiPropertyOptional({ type: 'string', description: 'How many of qty came by scanner' })
  @IsOptional()
  @QtyValue()
  @IsString()
  scannedQty?: string;

  @ApiPropertyOptional({
    description: 'The keeper ticked the other-godown confirmation for this line (logged in sdn_overrides).',
  })
  @OptionalBoolean()
  otherGodownOk?: boolean;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @NullableStringStrict(200)
  remarks?: string | null;
}

export class DeliveryNoteTransportDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  transporterId?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  transporterName?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableStringStrict(50)
  lrNo?: string | null;

  @ApiPropertyOptional({ type: 'string', format: 'date', nullable: true })
  @NullableDateString()
  lrDate?: string | null;
}

export class SaveDeliveryNoteDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({ example: '2026-2027' })
  @TrimmedString(9)
  @IsNotEmpty()
  accYear!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'A registered device (fixed.device_master): the note is numbered per device, DN/<year>/<device>/00001.',
  })
  @RequiredUuid()
  deviceId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Omit on a new note, or send your own uuidv7 so a re-sent first save finds the same note.',
  })
  @OptionalUuid()
  sdnId?: string;

  @ApiPropertyOptional({
    description: 'The sdnRevisionNo you loaded. A newer draft → 409 DN_REVISION_STALE. Omit on a new note.',
  })
  @OptionalInteger(1)
  baseRevision?: number;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'The godown the goods leave from (422 DN_GODOWN_REQUIRED when missing).',
  })
  @OptionalUuid()
  sdnGodownId?: string;

  @ApiProperty({ enum: DELIVERY_NOTE_MODES, default: 'SELF' })
  @UpperTrim()
  @IsIn(DELIVERY_NOTE_MODES)
  sdnMode!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdnVehicleId?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  sdnVehicleNo?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdnDriverId?: string | null;

  @ApiPropertyOptional({ type: [String], description: 'Loadmen (employee ids)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  sdnLoadmanIds?: string[];

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sdnSupervisorId?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true, description: 'Self pickup: who took the goods' })
  @NullableStringStrict(100)
  sdnCollectedBy?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  sdnCollectorPhone?: string | null;

  @ApiPropertyOptional({ type: DeliveryNoteTransportDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeliveryNoteTransportDto)
  transport?: DeliveryNoteTransportDto | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  sdnRemarks?: string | null;

  @ApiProperty({ type: [DeliveryNoteLineDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => DeliveryNoteLineDto)
  lines!: DeliveryNoteLineDto[];
}

/** /validate takes the save body. */
export class ValidateDeliveryNoteDto extends SaveDeliveryNoteDto {
  @ApiPropertyOptional({ type: [String], description: 'WARN codes already ticked (affects nothing on validate)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  overrideWarnings?: string[];
}

/** /post: the save body + the WARN codes the keeper ticked. */
export class PostDeliveryNoteDto extends SaveDeliveryNoteDto {
  @ApiPropertyOptional({
    type: [String],
    description:
      'WARN codes ticked: DN_OTHER_GODOWN, DN_OVER_SHELF, DN_VEHICLE_OVERLOAD. A raised WARN missing here → 409 DN_WARN_NOT_CONFIRMED.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  overrideWarnings?: string[];
}

export class DeliveryNoteKeysDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({ example: '2026-2027' })
  @TrimmedString(9)
  @IsNotEmpty()
  accYear!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sdnId!: string;
}

export class CancelDeliveryNoteDto extends DeliveryNoteKeysDto {
  @ApiProperty({ maxLength: 200, description: 'Why (422 DN_CANCEL_REASON_REQUIRED when blank)' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  reason?: string;
}

export class GoodsBackLineDto {
  @ApiProperty({ format: 'uuid', description: 'The note line (sdniId)' })
  @RequiredUuid()
  sdniId!: string;

  @ApiProperty({ type: 'string', example: '5', description: 'Came back, in the line unit (> 0)' })
  @QtyValue()
  @IsString()
  @IsNotEmpty()
  qty!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Your uuidv7 for this event (decision 69): a re-sent request whose id exists writes nothing.',
  })
  @OptionalUuid()
  sdeId?: string;
}

export class GoodsBackDto extends DeliveryNoteKeysDto {
  @ApiProperty({ maxLength: 200, description: 'Why the goods came back (422 DN_GOODS_BACK_REASON_REQUIRED)' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ type: [GoodsBackLineDto] })
  @IsArray()
  @IsNotEmpty()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => GoodsBackLineDto)
  lines!: GoodsBackLineDto[];
}

export class DeliveryNoteGetQueryDto extends DeliveryNoteKeysDto {}

export class DeliveryScanQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({ format: 'uuid', description: "The note's godown (whose open lines come in)" })
  @RequiredUuid()
  godownId!: string;

  @ApiProperty({ description: 'A bill QR (NXB1-…), a gate-pass QR (NXD1-…), or a typed bill no' })
  @TrimmedString(60)
  @IsNotEmpty()
  code!: string;
}

export class OpenLinesBillDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  billId!: string;

  @ApiProperty({ example: '2026-2027' })
  @TrimmedString(9)
  @IsNotEmpty()
  billAccYear!: string;
}

export class OpenLinesDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  godownId!: string;

  @ApiProperty({ type: [OpenLinesBillDto] })
  @IsArray()
  @IsNotEmpty()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => OpenLinesBillDto)
  bills!: OpenLinesBillDto[];
}

export class DeliveryLotsQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  godownId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  itemId!: string;

  @ApiPropertyOptional({ default: 'SALEABLE' })
  @IsOptional()
  @UpperTrim()
  @IsIn(['SALEABLE', 'DAMAGED', 'QUARANTINE', 'EXPIRED', 'SAMPLE'])
  bucket?: string;
}

/** POST /deliveries/mode (menu 12 EDIT). */
export class DeliveryModeDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({ example: '2026-2027' })
  @TrimmedString(9)
  @IsNotEmpty()
  accYear!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sbId!: string;

  @ApiProperty({ enum: ['PICKUP', 'DISPATCH'], description: '422 DELIVERY_MODE_INVALID for anything else' })
  @UpperTrim()
  @IsString()
  sbDeliveryMode!: string;

  @ApiProperty({ maxLength: 200, description: '422 DELIVERY_MODE_REASON_REQUIRED when blank' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  reason?: string;
}

export class DeliveryExceptionsQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;
}

/** The pattern quantities must match (checked by the service so the refusal is coded). */
export const DELIVERY_QTY_PATTERN = QTY_PATTERN;
