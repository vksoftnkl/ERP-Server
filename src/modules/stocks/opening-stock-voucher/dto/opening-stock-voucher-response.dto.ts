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

  @ApiPropertyOptional({
    nullable: true,
    description: 'purchase.suppliers.sup_name for supplierId.',
  })
  supplierName!: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'TRANSFER only — null on an opening.',
  })
  toBranchId!: string | null;

  @ApiPropertyOptional({ nullable: true, description: "The other side's own reference." })
  partyRef!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  reasonId!: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'stock_reason_master.srm_name' })
  reasonName!: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'All four, or all null — ck_svh_link.' })
  linkSrcModule!: string | null;

  @ApiPropertyOptional({ nullable: true })
  linkSrcDocType!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  linkSrcDocId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  linkSrcAccYear!: string | null;

  @ApiProperty({ description: 'PHYSICAL only — always false on an opening.' })
  freezeStock!: boolean;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  freezeFrom!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  freezeTo!: string | null;

  @ApiPropertyOptional({
    format: 'date-time',
    nullable: true,
    description: 'When an offline device synced this document up.',
  })
  syncDate!: string | null;

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

  @ApiPropertyOptional({
    nullable: true,
    description:
      'What the scanner read, verbatim. Echoed back as stored; the line is identified by itemId / batchNo / serialNo, not by this.',
  })
  barcode!: string | null;

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

  @ApiPropertyOptional({
    nullable: true,
    description: 'purchase.suppliers.sup_name for supplierId.',
  })
  supplierName!: string | null;

  @ApiProperty()
  qty!: number;

  @ApiProperty({ description: 'qty × toBaseFactor, computed server-side' })
  baseQty!: number;

  @ApiProperty()
  freeQty!: number;

  @ApiProperty()
  freeBaseQty!: number;

  @ApiProperty({
    description:
      'Net weight as keyed. Carried, never derived — a 10kg bag that weighs 9.7kg opens at what the scale said.',
  })
  weightQty!: number;

  @ApiProperty()
  costRate!: number;

  @ApiProperty({ description: 'Derived by the engine from taxPerc at post, then written back.' })
  costRateWot!: number;

  @ApiProperty({ description: 'Cost including freight, duty and handling attributed to the line.' })
  landedRate!: number;

  @ApiProperty()
  taxPerc!: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  reasonId!: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'stock_reason_master.srm_name' })
  reasonName!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  syncDate!: string | null;

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
      'null on a clean line. The wording comes from the preflight query and matches what the engine raises — it is not paraphrased in TypeScript.',
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

export class OpeningStockImportResultDto extends OpeningStockDocumentDto {
  @ApiProperty({ description: 'Data rows found in the file, blank rows excluded.' })
  rowsRead!: number;

  @ApiProperty({
    description: 'Lines written. Equal to rowsRead — a partial import is refused outright.',
  })
  linesImported!: number;

  @ApiProperty({
    type: OpeningStockLineProblemDto,
    isArray: true,
    description:
      'The preflight, run immediately after the write: an import that resolved cleanly can still produce lines the engine will refuse.',
  })
  problems!: OpeningStockLineProblemDto[];
}

export class OpeningStockImportSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: '40 lines imported, all clean' })
  message!: string;

  @ApiProperty({ type: OpeningStockImportResultDto })
  data!: OpeningStockImportResultDto;
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

/**
 * 19q Q6 — what the picker gets back for one item. No cost, deliberately: the
 * engine resolves the rate source only when a line arrives at cost 0, so a
 * seeded cost cell would silently disable it. See OpeningStockItemLookup.
 */
export class OpeningStockItemLookupDto {
  @ApiProperty({ format: 'uuid' })
  itemId!: string;

  @ApiPropertyOptional({ nullable: true })
  itemCode!: string | null;

  @ApiProperty()
  itemName!: string;

  @ApiPropertyOptional({ nullable: true })
  barcode!: string | null;

  @ApiProperty({
    format: 'uuid',
    description: 'The unit the line is keyed in — an iuc_id, never a unit_id.',
  })
  uomId!: string;

  @ApiProperty({ example: 'BOX' })
  unitName!: string;

  @ApiProperty({ example: 12, description: 'How many base units one keyed unit is.' })
  toBaseFactor!: number;

  @ApiProperty({
    format: 'uuid',
    description:
      "The unit the stock is STORED in, as the base unit's own conversion row — the value svi_base_uom_id takes.",
  })
  baseUomId!: string;

  @ApiProperty({ example: 18 })
  taxPerc!: number;

  @ApiProperty({ example: 0, description: 'Cess as a percentage of value.' })
  cessPerc!: number;

  @ApiProperty({
    example: 0,
    description:
      'Cess per UNIT. Returned because the screen derives cost-without-tax, and a per-unit cess is not a percentage the engine can express.',
  })
  cessUnit!: number;

  @ApiProperty({
    example: 'BME',
    description:
      "Which identity columns the line must carry — B batch, M MRP, S sale price, E expiry, R serial, P supplier; 'N' when no policy matches on the document date.",
  })
  trackSignature!: string;

  @ApiProperty({
    example: 0,
    description:
      "A SEED for a signature carrying M: the dearest live bucket at the most specific price scope. 0 when there is none, and 0 wherever stock.stock_mrp_price is not deployed. The line's real bucket is the MRP that ends up typed.",
  })
  mrp!: number;

  @ApiProperty({
    example: 0,
    description: "The seed bucket's sale price, on the same terms as mrp.",
  })
  salePrice!: number;

  @ApiProperty({
    description:
      'A warning, not a refusal: this item has an OPENING ledger row somewhere in this branch. The preflight is the real check.',
  })
  alreadyOpened!: boolean;
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

/**
 * What POST /stock/opening returns. Identical to the document envelope but for
 * `rowsPosted`, which is null when the save left a DRAFT and the ledger row
 * count when `header.status` was 'POSTED' and the same call posted it.
 */
export class OpeningStockSavedDocumentDto extends OpeningStockDocumentDto {
  @ApiProperty({
    type: Number,
    nullable: true,
    example: null,
    description:
      "null when the save left a draft; the number of stock_ledger rows written when header.status was 'POSTED'.",
  })
  rowsPosted!: number | null;
}

export class OpeningStockSaveSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Opening stock created successfully' })
  message!: string;

  @ApiProperty({ type: OpeningStockSavedDocumentDto })
  data!: OpeningStockSavedDocumentDto;
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

export class OpeningReconcileSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Opening reconciliation fetched successfully' })
  message!: string;

  @ApiProperty({ type: OpeningReconcileDto })
  data!: OpeningReconcileDto;
}

export class OpeningStockItemLookupSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Item fetched successfully' })
  message!: string;

  @ApiProperty({ type: OpeningStockItemLookupDto })
  data!: OpeningStockItemLookupDto;
}
