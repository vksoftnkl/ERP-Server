import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  OptionalInteger,
  OptionalQueryBoolean,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredInteger,
  RequiredUuid,
} from 'src/common/dto/dtoDecorators';

/**
 * Sticker Printing (menu 32, plan S-P1 §7.2) — the request keys.
 *
 * Own DTOs, shared with no other URL. Only the SHAPE is checked here (a uuid,
 * an integer); every rule that is a business refusal — a purpose that is not a
 * label purpose, labels outside 1-9,999, no printer, a reason that is not on
 * the list — is the service's coded 422 (STICKER_*), so the DTOs deliberately
 * accept those values.
 */

const ACC_YEAR = /^\d{4}-\d{4}$/;

/** A sane ceiling on a body's lines; the 500-line rule itself is STICKER_TOO_MANY_ITEMS. */
const MAX_BODY_LINES = 5_000;

class StickerScopeDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'A branch of companyId (STICKER_BRANCH_NOT_IN_COMPANY).',
  })
  @RequiredUuid()
  branchId!: string;
}

/** The price level "Our price" is read at: 1-4 = price A-D (2 = RET by default, SM6). */
const PriceLevel = () => RequiredInteger(1, 4);

// ─── GET /stickers/lines/from-items ─────────────────────────────────────────

export class StickerFromItemsQueryDto extends StickerScopeDto {
  @ApiProperty({ example: 'ITEM_LABEL', description: 'ITEM_LABEL | PACK_LABEL | SHELF_LABEL' })
  @IsString()
  @MaxLength(30)
  purposeCode!: string;

  @ApiProperty({ minimum: 1, maximum: 4, example: 2 })
  @PriceLevel()
  priceLevel!: number;

  @ApiPropertyOptional({ format: 'uuid', description: 'Item group (its sub-groups too).' })
  @OptionalUuid()
  groupId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  brandId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'The item card’s supplier.' })
  @OptionalUuid()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Part of the item name, alias or code.' })
  @OptionalTrimmedString(100)
  name?: string;

  @ApiPropertyOptional({ default: true, description: 'Only items ticked "Sticker" (S4).' })
  @OptionalQueryBoolean()
  stickerOnly?: boolean;

  @ApiPropertyOptional({
    enum: ['ONE', 'TYPED', 'STOCK'],
    default: 'ONE',
    description:
      'ONE label each, labelsEach each, or the SALEABLE stock here in the Def unit (rounded down).',
  })
  @IsOptional()
  @IsIn(['ONE', 'TYPED', 'STOCK', 'one', 'typed', 'stock'])
  labelsMode?: string;

  @ApiPropertyOptional({
    description: 'TYPED: labels per item, 1-9,999 (else STICKER_LABELS_INVALID).',
  })
  @OptionalInteger()
  labelsEach?: number;
}

// ─── S-P2: a document (purchase bill / shortage receipt) ────────────────────

/** The document a sticker list / job comes from. docType is checked by the service (coded 422). */
class StickerDocRefFields extends StickerScopeDto {
  @ApiProperty({
    example: 'PURCHASE_BILL',
    description:
      'PURCHASE_BILL (pur_invoice) | SHORTAGE_RECEIPT (pur_shortage_receipt); else STICKER_DOC_TYPE_INVALID.',
  })
  @IsString()
  @MaxLength(30)
  docType!: string;

  @ApiProperty({ format: 'uuid', description: 'pi_id / psr_id.' })
  @RequiredUuid()
  docId!: string;

  @ApiProperty({ example: '2026-2027', description: 'The document’s acc year.' })
  @IsString()
  @Matches(ACC_YEAR)
  accYear!: string;
}

// ─── GET /stickers/lines/from-doc ───────────────────────────────────────────

export class StickerFromDocQueryDto extends StickerDocRefFields {
  @ApiProperty({ example: 'ITEM_LABEL', description: 'ITEM_LABEL | PACK_LABEL | SHELF_LABEL' })
  @IsString()
  @MaxLength(30)
  purposeCode!: string;

  @ApiProperty({ minimum: 1, maximum: 4, example: 2 })
  @PriceLevel()
  priceLevel!: number;

  @ApiPropertyOptional({
    default: true,
    description:
      'Only lines of items ticked "Sticker" (C9: none ticked → STICKER_DOC_NOTHING_TICKED); false loads all.',
  })
  @OptionalQueryBoolean()
  stickerOnly?: boolean;
}

// ─── GET /stickers/docs/state ───────────────────────────────────────────────

export class StickerDocStateQueryDto extends StickerDocRefFields {}

// ─── POST /stickers/lines/resolve ───────────────────────────────────────────

export class StickerResolveLineDto {
  @ApiProperty({
    description:
      'The client’s own key for the row; answered back unchanged. Up to 80 characters (a document ' +
      'line’s key D:<srcLineId>:<lotId> is 75; review F5).',
    example: 'r7',
    maxLength: 80,
  })
  @IsString()
  @MaxLength(80)
  key!: string;

  @ApiPropertyOptional({
    description: 'A scan / typed code: EAN, item barcode, item code or batch no.',
  })
  @OptionalTrimmedString(200)
  code?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  itemId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'item_unit_conversion iuc_id; default = the Def unit.',
  })
  @OptionalUuid()
  unitId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  lotId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'F7 "Design for this job" for this line.' })
  @OptionalUuid()
  templateId?: string;

  @ApiPropertyOptional({
    description: 'Labels, 1-9,999 (else the line’s problem STICKER_LABELS_INVALID).',
  })
  @OptionalInteger()
  labels?: number;
}

export class StickerResolveDto extends StickerScopeDto {
  @ApiProperty({ example: 'ITEM_LABEL' })
  @IsString()
  @MaxLength(30)
  purposeCode!: string;

  @ApiProperty({ minimum: 1, maximum: 4, example: 2 })
  @PriceLevel()
  priceLevel!: number;

  @ApiProperty({
    type: [StickerResolveLineDto],
    description: '1-500 lines; each names code or itemId.',
  })
  @IsArray()
  @ArrayMaxSize(MAX_BODY_LINES)
  @ValidateNested({ each: true })
  @Type(() => StickerResolveLineDto)
  lines!: StickerResolveLineDto[];
}

// ─── GET /stickers/lots ─────────────────────────────────────────────────────

export class StickerLotsQueryDto extends StickerScopeDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  itemId!: string;

  @ApiProperty({ format: 'uuid', description: 'iuc_id: onHandQty is in this unit.' })
  @RequiredUuid()
  unitId!: string;
}

// ─── POST /stickers/preview ─────────────────────────────────────────────────

export class StickerPreviewLineDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  itemId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  unitId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  lotId?: string;
}

/** The printer's own dpi as Qt reports it; else the design's snap dpi. */
const PrinterDpi = () => OptionalInteger(72, 2400);

export class StickerPreviewDto extends StickerScopeDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  templateId!: string;

  @ApiProperty({ minimum: 1, maximum: 4, example: 2 })
  @PriceLevel()
  priceLevel!: number;

  @ApiProperty({ type: StickerPreviewLineDto })
  @ValidateNested()
  @Type(() => StickerPreviewLineDto)
  line!: StickerPreviewLineDto;

  @ApiPropertyOptional({ example: 203 })
  @PrinterDpi()
  printerDpi?: number;
}

// ─── POST /stickers/jobs/print ──────────────────────────────────────────────

export class StickerPrintLineDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  itemId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  unitId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  lotId?: string;

  @ApiProperty({ description: '1-9,999 (else STICKER_LABELS_INVALID).', example: 10 })
  @Type(() => Number)
  @IsInt()
  labels!: number;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'S-P2: the document line (from-doc lines[].srcLineId). Required on every line of a job with a source, ' +
      'refused on a job without one (STICKER_DOC_LINE_NOT_ON_DOC, C6).',
  })
  @OptionalUuid()
  srcLineId?: string;
}

/** S-P2: the posted document a job's lines come from (one per job, C6). */
export class StickerSourceDto {
  @ApiProperty({ example: 'PURCHASE_BILL', description: 'PURCHASE_BILL | SHORTAGE_RECEIPT' })
  @IsString()
  @MaxLength(30)
  docType!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  docId!: string;

  @ApiProperty({ example: '2026-2027' })
  @IsString()
  @Matches(ACC_YEAR)
  accYear!: string;
}

export class StickerPrintDto extends StickerScopeDto {
  @ApiProperty({ example: 'ITEM_LABEL' })
  @IsString()
  @MaxLength(30)
  purposeCode!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'The group’s design (absent → STICKER_NO_DESIGN).',
  })
  @OptionalUuid()
  templateId?: string;

  @ApiPropertyOptional({
    description: 'The Windows / CUPS queue (blank → STICKER_NO_PRINTER).',
    example: 'TSC TE244',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  printerName?: string;

  @ApiPropertyOptional({ example: 203 })
  @PrinterDpi()
  printerDpi?: number;

  @ApiPropertyOptional({
    default: 1,
    description: 'First cell, sheets only (labels down > 1); a roll starts at 1.',
  })
  @OptionalInteger(1, 1000)
  startAt?: number;

  @ApiProperty({ minimum: 1, maximum: 4, example: 2 })
  @PriceLevel()
  priceLevel!: number;

  @ApiPropertyOptional({
    type: StickerSourceDto,
    description:
      'S-P2: the document the lines come from. Then every line names its srcLineId, its lot and the ' +
      'item’s Def unit, and the labels per item + lot must be ≤ what is left (checked under a lock).',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StickerSourceDto)
  source?: StickerSourceDto;

  @ApiProperty({ type: [StickerPrintLineDto] })
  @IsArray()
  @ArrayMaxSize(MAX_BODY_LINES)
  @ValidateNested({ each: true })
  @Type(() => StickerPrintLineDto)
  lines!: StickerPrintLineDto[];

  @ApiPropertyOptional({
    default: false,
    description: 'true → JSON instead of the PDF (the job is still made).',
  })
  @IsOptional()
  @IsBoolean()
  inspect?: boolean;
}

// ─── POST /stickers/jobs/status ─────────────────────────────────────────────

class StickerJobRefDto extends StickerScopeDto {
  @ApiProperty({ example: '2026-2027' })
  @IsString()
  @Matches(ACC_YEAR)
  accYear!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  jobId!: string;
}

export class StickerJobStatusDto extends StickerJobRefDto {
  @ApiProperty({ enum: ['PRINTED', 'FAILED'] })
  @IsIn(['PRINTED', 'FAILED'])
  status!: 'PRINTED' | 'FAILED';

  @ApiPropertyOptional({ description: 'The printer’s message on FAILED (kept to 250 characters).' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  printerMessage?: string;
}

// ─── POST /stickers/jobs/reprint ────────────────────────────────────────────

export class StickerReprintLineDto {
  @ApiProperty({
    format: 'uuid',
    description: 'A line of the job (of its original, for a reprint job).',
  })
  @RequiredUuid()
  lineId!: string;

  @ApiProperty({ description: 'Reprint now: 0 = skip the line; up to 9,999.', example: 2 })
  @Type(() => Number)
  @IsInt()
  labels!: number;
}

export class StickerReprintDto extends StickerJobRefDto {
  @ApiPropertyOptional({
    enum: ['JAMMED', 'ROLL_OUT', 'TORN', 'OTHER'],
    description: 'Required (STICKER_REASON_REQUIRED); not on the list → STICKER_REASON_INVALID.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  reasonCode?: string;

  @ApiPropertyOptional({ description: 'Required for OTHER (STICKER_NOTE_REQUIRED); kept to 250.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reasonNote?: string;

  @ApiPropertyOptional({ example: 'TSC TE244' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  printerName?: string;

  @ApiPropertyOptional({ example: 203 })
  @PrinterDpi()
  printerDpi?: number;

  @ApiPropertyOptional({ default: 1 })
  @OptionalInteger(1, 1000)
  startAt?: number;

  @ApiProperty({ type: [StickerReprintLineDto] })
  @IsArray()
  @ArrayMaxSize(MAX_BODY_LINES)
  @ValidateNested({ each: true })
  @Type(() => StickerReprintLineDto)
  lines!: StickerReprintLineDto[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  inspect?: boolean;
}

// ─── POST /stickers/jobs/resend ─────────────────────────────────────────────

export class StickerResendDto extends StickerJobRefDto {
  @ApiPropertyOptional({ example: 'TSC TE244' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  printerName?: string;

  @ApiPropertyOptional({ example: 203 })
  @PrinterDpi()
  printerDpi?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  inspect?: boolean;
}

// ─── GET /stickers/jobs/get ─────────────────────────────────────────────────

export class StickerJobGetQueryDto extends StickerScopeDto {
  @ApiProperty({ example: '2026-2027' })
  @IsString()
  @Matches(ACC_YEAR)
  accYear!: string;

  @ApiProperty({ format: 'uuid', description: 'lbj_id' })
  @RequiredUuid()
  id!: string;
}

// ─── POST /stickers/test-print ──────────────────────────────────────────────

export class StickerTestPrintDto extends StickerScopeDto {
  @ApiProperty({
    format: 'uuid',
    description: 'A label design; its published revision, else the newest.',
  })
  @RequiredUuid()
  templateId!: string;

  @ApiProperty({ example: 'TSC TE244' })
  @IsString()
  @MaxLength(150)
  printerName!: string;

  @ApiPropertyOptional({ example: 203 })
  @PrinterDpi()
  printerDpi?: number;

  @ApiPropertyOptional({ example: 'Counter 8', description: 'Printed on the test label.' })
  @OptionalTrimmedString(60)
  counterName?: string;
}
