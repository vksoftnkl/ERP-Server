import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  STOCK_BUCKETS,
  STOCK_RATE_SOURCES,
  STOCK_VOUCHER_STATUSES,
} from '../../stock-voucher/types/stock-voucher.types';

export class OpeningStockErrorFieldDto {
  @ApiProperty({ example: 'toGodownId' })
  field!: string;

  @ApiProperty({ example: 'An opening stock must name the godown the stock arrives in.' })
  message!: string;
}

export class OpeningStockErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'This opening stock cannot be saved' })
  message!: string;

  @ApiProperty({ type: OpeningStockErrorFieldDto, isArray: true })
  errors!: OpeningStockErrorFieldDto[];
}

export class OpeningStockHeaderDto {
  @ApiProperty({ format: 'uuid' })
  svhId!: string;

  @ApiProperty({ example: '2026-2027' })
  accYear!: string;

  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  branchId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  tenantId!: string | null;

  @ApiProperty({ format: 'uuid' })
  deviceId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sessionId!: string | null;

  @ApiProperty({ example: 'OPENING' })
  voucherType!: string;

  @ApiProperty({ example: '1', description: 'bigint, serialized as a string' })
  slno!: string;

  @ApiProperty({ example: 'OPN/2026-2027/TILL-01/1' })
  refno!: string;

  @ApiPropertyOptional({ nullable: true })
  usrRefno!: string | null;

  @ApiProperty({ type: 'string', format: 'date', example: '2026-04-01' })
  docDate!: string;

  @ApiProperty({ format: 'date-time' })
  docDatetime!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  fromGodownId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  fromGodownName!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  godownId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  godownName!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  supplierId!: string | null;

  @ApiProperty({ enum: STOCK_VOUCHER_STATUSES })
  status!: string;

  @ApiProperty({ description: 'Trigger-maintained. The screen never sums its own grid.' })
  lineCount!: number;

  @ApiProperty({ description: 'Trigger-maintained. Free goods are included — they are stock.' })
  totalQty!: number;

  @ApiProperty({ description: 'Trigger-maintained.' })
  totalValue!: number;

  @ApiProperty({ description: 'Trigger-maintained.' })
  totalValueWot!: number;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  postedOn!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  postedBy!: string | null;

  @ApiPropertyOptional({ nullable: true })
  postedByName!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  cancelledOn!: string | null;

  @ApiPropertyOptional({ nullable: true })
  cancelReason!: string | null;

  @ApiPropertyOptional({ enum: STOCK_RATE_SOURCES, nullable: true })
  rateSource!: string | null;

  @ApiPropertyOptional({ nullable: true })
  remarks!: string | null;

  @ApiProperty()
  isDeleted!: boolean;
}

export class OpeningStockLineDto {
  @ApiProperty({ format: 'uuid' })
  sviId!: string;

  @ApiProperty()
  lineNo!: number;

  @ApiProperty()
  splitNo!: number;

  @ApiProperty({ format: 'uuid' })
  itemId!: string;

  @ApiPropertyOptional({ nullable: true })
  itemCode!: string | null;

  @ApiProperty()
  itemName!: string;

  @ApiPropertyOptional({ nullable: true })
  unitName!: string | null;

  @ApiProperty({ format: 'uuid', description: 'item_unit_conversion.iuc_id' })
  uomId!: string;

  @ApiProperty({ format: 'uuid', description: 'item_unit_conversion.iuc_id' })
  baseUomId!: string;

  @ApiProperty({ description: 'Read from item_unit_conversion, never from the payload.' })
  toBaseFactor!: number;

  @ApiProperty({ format: 'uuid' })
  godownId!: string;

  @ApiPropertyOptional({ nullable: true })
  godownName!: string | null;

  @ApiProperty({ enum: STOCK_BUCKETS })
  bucket!: string;

  @ApiPropertyOptional({ nullable: true })
  batchNo!: string | null;

  @ApiPropertyOptional({ type: 'string', format: 'date', nullable: true })
  mfgDate!: string | null;

  @ApiPropertyOptional({ type: 'string', format: 'date', nullable: true })
  expiryDate!: string | null;

  @ApiPropertyOptional({ nullable: true })
  mrp!: number | null;

  @ApiPropertyOptional({ nullable: true })
  salePrice!: number | null;

  @ApiPropertyOptional({ nullable: true })
  serialNo!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  supplierId!: string | null;

  @ApiProperty()
  qty!: number;

  @ApiProperty({ description: 'qty × toBaseFactor, computed server-side' })
  baseQty!: number;

  @ApiProperty()
  freeQty!: number;

  @ApiProperty()
  freeBaseQty!: number;

  @ApiProperty()
  costRate!: number;

  @ApiProperty({ description: 'Derived by the engine from taxPerc at post, then written back.' })
  costRateWot!: number;

  @ApiProperty()
  taxPerc!: number;

  @ApiProperty({ description: 'GENERATED — (baseQty + freeBaseQty) × costRate, rounded to 2.' })
  value!: number;

  @ApiProperty({ description: 'GENERATED.' })
  valueWot!: number;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'NULL while DRAFT and filled by the post. Not missing data — it means this line has not reached the ledger yet, and the screen may render it as the tick that says it has.',
  })
  lotId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  remarks!: string | null;
}

export class OpeningStockDocumentDto {
  @ApiProperty({ type: OpeningStockHeaderDto })
  header!: OpeningStockHeaderDto;

  @ApiProperty({ type: OpeningStockLineDto, isArray: true })
  lines!: OpeningStockLineDto[];
}

export class OpeningStockListItemDto {
  @ApiProperty({ format: 'uuid' })
  svhId!: string;

  @ApiProperty()
  accYear!: string;

  @ApiProperty()
  refno!: string;

  @ApiPropertyOptional({ nullable: true })
  usrRefno!: string | null;

  @ApiProperty({ type: 'string', format: 'date' })
  docDate!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  godownId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  godownName!: string | null;

  @ApiProperty({ enum: STOCK_VOUCHER_STATUSES })
  status!: string;

  @ApiProperty()
  lineCount!: number;

  @ApiProperty()
  totalQty!: number;

  @ApiProperty()
  totalValue!: number;

  @ApiProperty()
  totalValueWot!: number;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  postedOn!: string | null;

  @ApiPropertyOptional({ enum: STOCK_RATE_SOURCES, nullable: true })
  rateSource!: string | null;

  @ApiPropertyOptional({ nullable: true })
  remarks!: string | null;
}

export class PagedMetaDto {
  @ApiProperty()
  limit!: number;

  @ApiProperty()
  offset!: number;

  @ApiProperty()
  count!: number;
}

export class OpeningStockListDto {
  @ApiProperty({ type: OpeningStockListItemDto, isArray: true })
  items!: OpeningStockListItemDto[];

  @ApiProperty({ type: PagedMetaDto })
  meta!: PagedMetaDto;
}

export class OpeningStockLineProblemDto {
  @ApiProperty({ format: 'uuid' })
  sviId!: string;

  @ApiProperty()
  lineNo!: number;

  @ApiProperty()
  splitNo!: number;

  @ApiProperty({ format: 'uuid' })
  itemId!: string;

  @ApiPropertyOptional({ nullable: true })
  itemCode!: string | null;

  @ApiProperty()
  itemName!: string;

  @ApiPropertyOptional({
    nullable: true,
    example: 'this holding already has an opening in this year',
    description:
      "null on a clean line. The wording comes from the preflight query and matches what the engine raises — it is not paraphrased in TypeScript.",
  })
  problem!: string | null;
}

export class OpeningStockPostResultDto extends OpeningStockDocumentDto {
  @ApiProperty({ description: 'Ledger rows written by stock.fn_svh_post.' })
  rowsPosted!: number;

  @ApiProperty({ example: 'POSTED' })
  status!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  postedOn!: string | null;
}

export class OpeningStockCancelResultDto extends OpeningStockDocumentDto {
  @ApiProperty({ description: 'Reversal rows written by stock.fn_svh_cancel.' })
  rowsReversed!: number;

  @ApiProperty({ example: 'CANCELLED' })
  status!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  cancelledOn!: string | null;
}

export class OpeningStockDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  svhId!: string;

  @ApiProperty()
  accYear!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class PendingOpeningItemDto {
  @ApiProperty({ format: 'uuid' })
  itemId!: string;

  @ApiPropertyOptional({ nullable: true })
  itemCode!: string | null;

  @ApiProperty()
  itemName!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  baseUomId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  unitName!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'BE' })
  trackSignature!: string | null;
}

export class PendingOpeningItemsDto {
  @ApiProperty({ type: PendingOpeningItemDto, isArray: true })
  items!: PendingOpeningItemDto[];

  @ApiProperty({ type: PagedMetaDto })
  meta!: PagedMetaDto;
}

export class OpeningReconcileRowDto {
  @ApiProperty({ format: 'uuid' })
  itemId!: string;

  @ApiPropertyOptional({ nullable: true })
  itemCode!: string | null;

  @ApiProperty()
  itemName!: string;

  @ApiPropertyOptional({ nullable: true })
  unitName!: string | null;

  @ApiProperty({
    description:
      'From the LEDGER, not the document — so a cancelled opening correctly reads as zero.',
  })
  openingQty!: number;

  @ApiProperty()
  openingValue!: number;

  @ApiProperty()
  currentQty!: number;

  @ApiProperty()
  currentValue!: number;

  @ApiProperty()
  diffQty!: number;

  @ApiProperty()
  diffValue!: number;
}

export class OpeningReconcileDto {
  @ApiProperty({ type: OpeningReconcileRowDto, isArray: true })
  items!: OpeningReconcileRowDto[];

  @ApiProperty({ type: PagedMetaDto })
  meta!: PagedMetaDto;
}

// ── Envelopes ─────────────────────────────────────────────────────────────

export class OpeningStockDocumentSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Opening stock fetched successfully' })
  message!: string;

  @ApiProperty({ type: OpeningStockDocumentDto })
  data!: OpeningStockDocumentDto;
}

export class OpeningStockListSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Opening stock list fetched successfully' })
  message!: string;

  @ApiProperty({ type: OpeningStockListDto })
  data!: OpeningStockListDto;
}

export class OpeningStockValidateSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: '2 of 40 lines have problems' })
  message!: string;

  @ApiProperty({ type: OpeningStockLineProblemDto, isArray: true })
  data!: OpeningStockLineProblemDto[];
}

export class OpeningStockPostSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Opening stock posted successfully' })
  message!: string;

  @ApiProperty({ type: OpeningStockPostResultDto })
  data!: OpeningStockPostResultDto;
}

export class OpeningStockCancelSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Opening stock cancelled successfully' })
  message!: string;

  @ApiProperty({ type: OpeningStockCancelResultDto })
  data!: OpeningStockCancelResultDto;
}

export class OpeningStockDeleteSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Opening stock deleted successfully' })
  message!: string;

  @ApiProperty({ type: OpeningStockDeleteResultDto })
  data!: OpeningStockDeleteResultDto;
}

export class PendingOpeningItemsSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Pending opening items fetched successfully' })
  message!: string;

  @ApiProperty({ type: PendingOpeningItemsDto })
  data!: PendingOpeningItemsDto;
}

export class OpeningReconcileSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Opening reconciliation fetched successfully' })
  message!: string;

  @ApiProperty({ type: OpeningReconcileDto })
  data!: OpeningReconcileDto;
}
