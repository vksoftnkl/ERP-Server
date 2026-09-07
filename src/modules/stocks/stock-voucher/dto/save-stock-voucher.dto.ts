import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, Matches, ValidateNested } from 'class-validator';
import {
  NullableStringStrict,
  NullableUuid,
  OptionalNumberString,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { STOCK_RATE_SOURCES, type StockRateSource } from '../types/stock-voucher.types';
import { SaveStockVoucherItemDto } from './save-stock-voucher-item.dto';

/**
 * `YYYY-YYYY`, second year = first + 1 — ck_svh_acc_year.
 *
 * The column is `character(9)`, NOT varchar. bpchar space-pads anything shorter
 * than nine characters, and the CHECK then rejects the padded value with a
 * message that mentions neither padding nor length. So the full nine characters
 * are demanded here, where the error can say so.
 */
const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;

/**
 * A grid this size is already a data-entry problem rather than a document; the
 * cap exists so a runaway import cannot hold a transaction — and its advisory
 * lock — open across ten thousand lines.
 */
const MAX_LINES = 2000;

/**
 * The shared save payload. One per document type extends it and pins the type
 * with @IsIn — see SaveOpeningStockVoucherDto.
 *
 * THE VOUCHER TYPE IS NEVER TRUSTED FROM HERE. The controller supplies it. A
 * payload carrying `voucherType: 'TRANSFER_OUT'` on the opening route must be
 * REJECTED rather than silently honoured: a transfer posted through this route
 * would leave its stock_transit row uncreated and the receiving branch waiting
 * for a document that never arrives.
 */
export class SaveStockVoucherHeaderDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Present = update the existing DRAFT; absent = create.',
  })
  @OptionalUuid()
  svhId?: string;

  @ApiProperty({
    minLength: 9,
    maxLength: 9,
    example: '2026-2027',
    description: 'character(9). Send all nine characters — bpchar pads, and ck_svh_acc_year rejects the padding.',
  })
  @TrimmedString(9)
  @Matches(ACC_YEAR_PATTERN, {
    message: 'accYear must be YYYY-YYYY, e.g. 2026-2027',
  })
  accYear!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  tenantId?: string | null;

  @ApiProperty({
    format: 'uuid',
    description:
      'fixed.device_master.dev_id. NOT NULL, and the number series — see stock-voucher-numbering.helper.ts.',
  })
  @RequiredUuid()
  deviceId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  sessionId?: string | null;

  @ApiPropertyOptional({
    description:
      'The serial this device already assigned offline. Generated when absent; honoured verbatim when present, because the device has already printed it.',
  })
  @OptionalNumberString()
  slno?: string;

  @ApiPropertyOptional({
    maxLength: 100,
    description: 'The printed number. Generated as {typeCode}/{accYear}/{deviceCode}/{slno} when absent.',
  })
  @OptionalTrimmedString(100)
  refno?: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true, description: "The user's own reference" })
  @NullableStringStrict(100)
  usrRefno?: string | null;

  @ApiProperty({ type: 'string', format: 'date', example: '2026-04-01' })
  @TrimmedString(10)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'docDate must be yyyy-MM-dd' })
  docDate!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Where stock leaves from. Required by ISSUE-shaped documents, unused by OPENING.',
  })
  @NullableUuid()
  fromGodownId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Where stock arrives. REQUIRED for OPENING — ck_svh_godowns will not catch its absence, because an ISSUE satisfies that check with fromGodown alone.',
  })
  @NullableUuid()
  toGodownId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  supplierId?: string | null;

  @ApiPropertyOptional({
    enum: STOCK_RATE_SOURCES,
    nullable: true,
    description:
      'Which rate the lines are valued at. On a go-live day stock_item_cost is empty, so AVG_COST and LAST_PURCHASE have nothing to read — MANUAL is the honest default for an opening.',
  })
  @IsOptional()
  @IsIn(STOCK_RATE_SOURCES as unknown as string[], {
    message: `rateSource must be one of ${STOCK_RATE_SOURCES.join(', ')}`,
  })
  rateSource?: StockRateSource | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  remarks?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Falls back to the authenticated user from the request context.',
  })
  @OptionalUuid()
  userId?: string;
}

export class SaveStockVoucherDto {
  @ApiProperty({ type: SaveStockVoucherHeaderDto })
  @ValidateNested()
  @Type(() => SaveStockVoucherHeaderDto)
  header!: SaveStockVoucherHeaderDto;

  @ApiProperty({
    type: SaveStockVoucherItemDto,
    isArray: true,
    description:
      'A full replace on update. Merging by row number over a grid the user can insert into is where line numbers drift, and a DRAFT has no history worth preserving.',
  })
  @IsArray()
  @ArrayMaxSize(MAX_LINES, {
    message: `lines may not exceed ${MAX_LINES} rows in one document`,
  })
  @ValidateNested({ each: true })
  @Type(() => SaveStockVoucherItemDto)
  lines!: SaveStockVoucherItemDto[];
}
