import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  STOCK_BUCKETS,
  STOCK_RATE_SOURCES,
  STOCK_VOUCHER_STATUSES,
} from '../../stock-voucher/types/stock-voucher.types';

export class PhysicalStockErrorFieldDto {
  @ApiProperty({ example: 'lines.0' })
  field!: string;

  @ApiProperty({
    example:
      'Line 1 has not been counted yet. Send countedQty: 0 to record that nothing was found — absent means the counter has not reached this line.',
  })
  message!: string;
}

export class PhysicalStockErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'This physical stock count cannot be saved' })
  message!: string;

  @ApiProperty({ type: PhysicalStockErrorFieldDto, isArray: true })
  errors!: PhysicalStockErrorFieldDto[];
}

export class PhysicalStockHeaderDto {
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

  @ApiProperty({ example: 'PHYSICAL' })
  voucherType!: string;

  @ApiProperty({ example: '1', description: 'bigint, serialized as a string' })
  slno!: string;

  @ApiProperty({ example: 'PHY/2026-2027/TILL-01/1' })
  refno!: string;

  @ApiPropertyOptional({ nullable: true })
  usrRefno!: string | null;

  @ApiProperty({ type: 'string', format: 'date', example: '2026-06-30' })
  docDate!: string;

  @ApiProperty({ format: 'date-time' })
  docDatetime!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Unused by a count.' })
  fromGodownId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  fromGodownName!: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'THE GODOWN BEING COUNTED (svh_to_godown_id). Every line is in it.',
  })
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
    description: 'TRANSFER only — null on a count.',
  })
  toBranchId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  partyRef!: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'The header reason every variance line inherits — a whole count explained as "Shrinkage" without touching a line.',
  })
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

  @ApiProperty({
    description:
      '§11 — whether movements touching this godown are refused while the count is DRAFT. Posting or cancelling the sheet lifts it without waiting for freezeTo.',
  })
  freezeStock!: boolean;

  @ApiPropertyOptional({
    format: 'date-time',
    nullable: true,
    description: 'WALL CLOCK, NOT DOCUMENT DATE — the guard compares the window to now().',
  })
  freezeFrom!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  freezeTo!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  syncDate!: string | null;

  @ApiProperty({ enum: STOCK_VOUCHER_STATUSES })
  status!: string;

  @ApiProperty({ description: 'Trigger-maintained — lines counted, variance or not.' })
  lineCount!: number;

  @ApiProperty({
    description:
      'THE NET VARIANCE, not the sum of anything on the screen: read off the ledger by fn_svh_recompute. Three lines totalling 236 counted units can total +1 here. A DRAFT count truthfully totals 0, because nothing has posted. Label it "Net variance" on the screen, or do not show it.',
  })
  totalQty!: number;

  @ApiProperty({ description: 'The net variance in value — see totalQty.' })
  totalValue!: number;

  @ApiProperty({ description: 'The net variance excluding tax.' })
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

  @ApiPropertyOptional({
    enum: STOCK_RATE_SOURCES,
    nullable: true,
    description:
      'AVG_COST when the payload named none — found stock is worth what the rest of that item is worth. It values the OVERAGE lines only; a shortage is relieved at what the stock cost us.',
  })
  rateSource!: string | null;

  @ApiPropertyOptional({ nullable: true })
  remarks!: string | null;

  @ApiProperty()
  isDeleted!: boolean;
}

export class PhysicalStockLineDto {
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

  @ApiProperty({
    format: 'uuid',
    description: "The holding's base unit, read from stock_balance. A count is taken in it.",
  })
  uomId!: string;

  @ApiProperty({ format: 'uuid' })
  baseUomId!: string;

  @ApiProperty({
    description: 'Always 1 on a count — the book figure is already in the base unit.',
  })
  toBaseFactor!: number;

  @ApiProperty({ format: 'uuid' })
  godownId!: string;

  @ApiPropertyOptional({ nullable: true })
  godownName!: string | null;

  @ApiProperty({ enum: STOCK_BUCKETS })
  bucket!: string;

  @ApiPropertyOptional({ nullable: true, description: 'Unused by a count.' })
  barcode!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Copied from the holding, never from the payload.',
  })
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

  // ── The three numbers a count is about ──────────────────────────────────
  @ApiPropertyOptional({
    nullable: true,
    description:
      'What the system thought was on the shelf — a SNAPSHOT of stock_balance.sbl_on_hand_qty taken at save, read by the server and never taken from the payload. It is not refreshed at post and not recomputed on load: it is what lets a variance be defended a year later.',
  })
  bookQty!: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'What was actually on the shelf.' })
  countedQty!: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'GENERATED ALWAYS — counted − book. SIGNED, where every other quantity in the engine is a magnitude, because it is not a quantity but a difference. abs(diffQty) is what posts; 0 posts nothing and the line is still a line that was counted.',
  })
  diffQty!: number | null;

  @ApiProperty({ description: '0 for the whole document — a count states no quantity to move.' })
  qty!: number;

  @ApiProperty({ description: '0 — see qty.' })
  baseQty!: number;

  @ApiProperty({ description: '0 — see qty.' })
  freeQty!: number;

  @ApiProperty({ description: '0 — see qty.' })
  freeBaseQty!: number;

  @ApiProperty({ description: '0 — see qty.' })
  weightQty!: number;

  @ApiProperty({
    description:
      "0 while DRAFT, in both directions and on purpose. The post writes back what the engine resolved: an overage at the document rate source, a shortage at the rate fn_sml_cost_default stamped from the item's valuation policy.",
  })
  costRate!: number;

  @ApiProperty()
  costRateWot!: number;

  @ApiProperty()
  landedRate!: number;

  @ApiProperty()
  taxPerc!: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  reasonId!: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'stock_reason_master.srm_name' })
  reasonName!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  syncDate!: string | null;

  @ApiProperty({ description: 'GENERATED.' })
  value!: number;

  @ApiProperty({ description: 'GENERATED.' })
  valueWot!: number;

  @ApiProperty({
    format: 'uuid',
    description:
      'FILLED FROM THE MOMENT OF SAVE, unlike every other document type — it is where the book figure came from. So the screen cannot use it as the "reached the ledger" tick; use diffQty <> 0 plus status POSTED, or GET /stock/physical/variance.',
  })
  lotId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  remarks!: string | null;
}

export class PhysicalStockDocumentDto {
  @ApiProperty({ type: PhysicalStockHeaderDto })
  header!: PhysicalStockHeaderDto;

  @ApiProperty({ type: PhysicalStockLineDto, isArray: true })
  lines!: PhysicalStockLineDto[];
}

export class PhysicalStockListItemDto {
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

  @ApiProperty({ description: 'The net variance — see PhysicalStockHeaderDto.totalQty.' })
  totalQty!: number;

  @ApiProperty({ description: 'The net variance in value.' })
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

export class PhysicalStockListDto {
  @ApiProperty({ type: PhysicalStockListItemDto, isArray: true })
  items!: PhysicalStockListItemDto[];

  @ApiProperty({ type: PagedMetaDto })
  meta!: PagedMetaDto;
}

export class PhysicalStockLineProblemDto {
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
    example: 'the book quantity has changed since this sheet was generated',
    description:
      'null on a clean line — INCLUDING a line that agrees, which is still a line that was counted and which the screen ticks. The wording comes from the preflight query and matches what the engine raises; it is not paraphrased in TypeScript.',
  })
  problem!: string | null;
}

export class PhysicalStockPostResultDto extends PhysicalStockDocumentDto {
  @ApiProperty({
    description:
      'Ledger rows written by stock.fn_svh_post — ONE PER VARYING LINE, and legitimately fewer than lineCount. A count where every line agrees returns 0 and still closes POSTED: that is a success, not an empty document.',
  })
  rowsPosted!: number;

  @ApiProperty({ example: 'POSTED' })
  status!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  postedOn!: string | null;
}

export class PhysicalStockCancelResultDto extends PhysicalStockDocumentDto {
  @ApiProperty({ description: 'Reversal rows written by stock.fn_svh_cancel.' })
  rowsReversed!: number;

  @ApiProperty({ example: 'CANCELLED' })
  status!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  cancelledOn!: string | null;
}

/** §4 — one row of the generated sheet. */
export class CountSheetRowDto {
  @ApiProperty({ description: 'Assigned server-side, and continuing across pages.' })
  lineNo!: number;

  @ApiProperty({ example: 1, description: 'Always 1: one row already means one holding.' })
  splitNo!: number;

  @ApiProperty({ format: 'uuid' })
  itemId!: string;

  @ApiPropertyOptional({ nullable: true })
  itemCode!: string | null;

  @ApiProperty()
  itemName!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'stock.stock_lot.slt_id — send it back verbatim on save.',
  })
  lotId!: string;

  @ApiProperty({ format: 'uuid' })
  godownId!: string;

  @ApiPropertyOptional({ nullable: true })
  godownName!: string | null;

  @ApiProperty({ enum: STOCK_BUCKETS })
  bucket!: string;

  @ApiProperty({ format: 'uuid' })
  baseUomId!: string;

  @ApiPropertyOptional({ nullable: true })
  unitName!: string | null;

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

  @ApiProperty({
    description:
      'sbl_on_hand_qty. Withhold it from the counter on a blind count — the whole point of a count is that the shelf is measured, not confirmed.',
  })
  bookQty!: number;

  @ApiProperty()
  avgCostRate!: number;

  @ApiProperty()
  stockValue!: number;

  /**
   * `type` is stated EXPLICITLY because the TypeScript type is the literal
   * `null`, and Swagger's reflection cannot read a design-time type from that —
   * it falls back to the declaring class and reports a circular dependency in
   * CountSheetRowDto, which fails document generation for the whole module.
   */
  @ApiPropertyOptional({
    type: 'number',
    nullable: true,
    description: 'Always null — this is the one column the screen fills.',
  })
  countedQty!: null;
}

export class CountSheetDto {
  @ApiProperty({ type: CountSheetRowDto, isArray: true })
  items!: CountSheetRowDto[];

  @ApiProperty({ type: PagedMetaDto })
  meta!: PagedMetaDto;
}

/** §12 — one ledger row of the variance report. */
export class StockVarianceRowDto {
  @ApiProperty({ description: "The COUNT SHEET's own line number, kept by the engine." })
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
  batchNo!: string | null;

  @ApiProperty({
    example: 'PHYSICAL_MINUS',
    description: 'PHYSICAL_PLUS or PHYSICAL_MINUS — one document writes both.',
  })
  txnType!: string;

  @ApiProperty({ example: -1, description: '+1 inward, −1 outward.' })
  direction!: number;

  @ApiProperty({ example: 2, description: 'A MAGNITUDE — the sign lives in direction alone.' })
  qty!: number;

  @ApiProperty({ example: -2 })
  signedBaseQty!: number;

  @ApiProperty({
    example: 20,
    description:
      "The shortage rate the engine stamped from the item's valuation policy, or the overage rate it derived from the document's rate source. This report is the only place the two sit side by side.",
  })
  costRate!: number;

  @ApiProperty({ example: 40 })
  costValue!: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  reasonId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  reasonName!: string | null;
}

export class StockVarianceDto {
  @ApiProperty({ type: StockVarianceRowDto, isArray: true })
  items!: StockVarianceRowDto[];

  @ApiProperty({ type: PagedMetaDto })
  meta!: PagedMetaDto;
}

// ── The success envelopes ─────────────────────────────────────────────────

export class PhysicalStockDocumentSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Physical stock count created successfully' })
  message!: string;

  @ApiProperty({ type: PhysicalStockDocumentDto })
  data!: PhysicalStockDocumentDto;
}

export class PhysicalStockListSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Physical stock count list fetched successfully' })
  message!: string;

  @ApiProperty({ type: PhysicalStockListDto })
  data!: PhysicalStockListDto;
}

export class PhysicalStockValidateSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'All 3 lines are clean' })
  message!: string;

  @ApiProperty({ type: PhysicalStockLineProblemDto, isArray: true })
  data!: PhysicalStockLineProblemDto[];
}

export class PhysicalStockPostSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Physical stock count posted — 2 of 3 lines had a variance' })
  message!: string;

  @ApiProperty({ type: PhysicalStockPostResultDto })
  data!: PhysicalStockPostResultDto;
}

export class PhysicalStockCancelSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Physical stock count cancelled successfully — 2 reversal rows' })
  message!: string;

  @ApiProperty({ type: PhysicalStockCancelResultDto })
  data!: PhysicalStockCancelResultDto;
}

export class CountSheetSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: '3 holdings to count' })
  message!: string;

  @ApiProperty({ type: CountSheetDto })
  data!: CountSheetDto;
}

export class StockVarianceSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: '2 variance rows' })
  message!: string;

  @ApiProperty({ type: StockVarianceDto })
  data!: StockVarianceDto;
}
