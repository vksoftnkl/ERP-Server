import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  STOCK_BUCKETS,
  STOCK_RATE_SOURCES,
  STOCK_VOUCHER_STATUSES,
} from '../../stock-voucher/types/stock-voucher.types';

/**
 * The response contracts for both transfer screens.
 *
 * Self-contained, as the opening's and the count's are: each screen documents
 * the shape it actually returns, and the same column means different things on
 * different screens. `svi_godown_id` is the whole argument for that — it is the
 * SOURCE on a despatch line and the DESTINATION on a receipt line, and a shared
 * DTO could only describe one of them.
 */

export class StockTransferErrorFieldDto {
  @ApiProperty({ example: 'lines.0' })
  field!: string;

  @ApiProperty({
    example:
      'Line 1 sends 20 but this godown holds 15 of that lot in the SALEABLE bucket. A transfer moves stock that exists; the engine will not stop this one under an ALLOW policy.',
  })
  message!: string;
}

export class StockTransferErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'This transfer cannot be saved' })
  message!: string;

  @ApiProperty({ type: StockTransferErrorFieldDto, isArray: true })
  errors!: StockTransferErrorFieldDto[];
}

// ── The document ───────────────────────────────────────────────────────────

export class StockTransferHeaderDto {
  @ApiProperty({ format: 'uuid' })
  svhId!: string;

  @ApiProperty({ example: '2026-2027' })
  accYear!: string;

  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'The SENDING branch on a despatch, the RECEIVING branch on a receipt.',
  })
  branchId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  tenantId!: string | null;

  @ApiProperty({ format: 'uuid' })
  deviceId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sessionId!: string | null;

  @ApiProperty({ enum: ['TRANSFER_OUT', 'TRANSFER_IN'] })
  voucherType!: string;

  @ApiProperty({ example: '2', description: 'bigint, serialized as a string' })
  slno!: string;

  @ApiProperty({
    example: 'TRF/2026-2027/TILL-01/2',
    description:
      'TRF on a despatch, TRI on a receipt. svh_slno is unique per (company, branch, year, type, device), so the two number independently and the receiving branch numbers its own receipts offline.',
  })
  refno!: string;

  @ApiPropertyOptional({ nullable: true })
  usrRefno!: string | null;

  @ApiProperty({ type: 'string', format: 'date', example: '2026-04-02' })
  docDate!: string;

  @ApiProperty({ format: 'date-time' })
  docDatetime!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Where the stock leaves from. Mandatory on both halves — ck_svh_transfer_godowns.',
  })
  fromGodownId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  fromGodownName!: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'THE DESTINATION GODOWN (svh_to_godown_id). One despatch carries ONE of these — a lorry serving three shops is three vouchers.',
  })
  godownId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  godownName!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  supplierId!: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'THE FIELD THAT DECIDES THE SHAPE. Null, or equal to branchId, is a godown-to-godown move that posts both halves at once and ends POSTED. Another branch is a despatch that ends IN_TRANSIT. Null on a TRANSFER_IN.',
  })
  toBranchId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  partyRef!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  reasonId!: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'stock_reason_master.srm_name' })
  reasonName!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: "'STOCK' on a receipt, stamped server-side. All four, or all null — ck_svh_link.",
  })
  linkSrcModule!: string | null;

  @ApiPropertyOptional({ nullable: true, description: "'STOCK_VOUCHER' on a receipt." })
  linkSrcDocType!: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'THE DESPATCH THIS RECEIPT IS AGAINST. Mandatory on a TRANSFER_IN — ck_svh_transfer_in_link — and null on a despatch.',
  })
  linkSrcDocId!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      "The DESPATCH's year, which is not always the receipt's: a lorry that leaves on 29 March arrives in the next year.",
  })
  linkSrcAccYear!: string | null;

  @ApiProperty({ description: 'Always false — only a physical count freezes stock.' })
  freezeStock!: boolean;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  freezeFrom!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  freezeTo!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  syncDate!: string | null;

  @ApiProperty({
    enum: STOCK_VOUCHER_STATUSES,
    description:
      'AN INTER-BRANCH DESPATCH IS NEVER POSTED: DRAFT → IN_TRANSIT → RECEIVED. A list filtered to POSTED loses every transfer in flight. (PARTIAL is a transit-row status, never a voucher status.)',
  })
  status!: string;

  @ApiProperty({ description: 'Trigger-maintained.' })
  lineCount!: number;

  @ApiProperty({ description: 'Trigger-maintained. Never written by this API.' })
  totalQty!: number;

  @ApiProperty()
  totalValue!: number;

  @ApiProperty()
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
      'Unused by a transfer: the cost is stamped by the engine from the item valuation policy and travels with the stock. Nobody enters a rate on either half.',
  })
  rateSource!: string | null;

  @ApiPropertyOptional({ nullable: true })
  remarks!: string | null;

  @ApiProperty()
  isDeleted!: boolean;
}

export class StockTransferLineDto {
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

  @ApiProperty({ format: 'uuid', description: 'iuc_id, not unit_id.' })
  uomId!: string;

  @ApiProperty({ format: 'uuid' })
  baseUomId!: string;

  @ApiProperty({ description: 'Read from item_unit_conversion, never from the payload.' })
  toBaseFactor!: number;

  @ApiProperty({
    format: 'uuid',
    description:
      'THE SOURCE GODOWN ON A DESPATCH AND THE DESTINATION ON A RECEIPT. Same column, two meanings, one screen apart — do not let the two grids share a field label.',
  })
  godownId!: string;

  @ApiPropertyOptional({ nullable: true })
  godownName!: string | null;

  @ApiProperty({
    enum: STOCK_BUCKETS,
    description:
      'On a receipt: SALEABLE for what arrived good, DAMAGED for what arrived broken. Damaged units still post IN — they exist, broken.',
  })
  bucket!: string;

  @ApiPropertyOptional({ nullable: true })
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

  @ApiProperty()
  qty!: number;

  @ApiProperty()
  baseQty!: number;

  @ApiProperty()
  freeQty!: number;

  @ApiProperty()
  freeBaseQty!: number;

  @ApiProperty()
  weightQty!: number;

  @ApiProperty({
    description:
      'ALWAYS 0 ON A DRAFT, and stripped if the payload sends one. fn_sml_cost_default stamps the policy cost at post and the post writes it back here. A typed rate makes that trigger bail and the ledger row lands at that rate with value 0.',
  })
  costRate!: number;

  @ApiProperty()
  costRateWot!: number;

  @ApiProperty()
  landedRate!: number;

  @ApiProperty()
  taxPerc!: number;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  syncDate!: string | null;

  @ApiProperty({ description: 'GENERATED ALWAYS — never written.' })
  value!: number;

  @ApiProperty({ description: 'GENERATED ALWAYS — never written.' })
  valueWot!: number;

  @ApiProperty({
    format: 'uuid',
    description:
      'THE HOLDING BEING MOVED, and mandatory on both halves — unlike every other document type, where the engine resolves it at post. A transfer moves existing stock, so the destination receives the SAME slt_id and ageing does not reset.',
  })
  lotId!: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Null on a transfer — count columns.' })
  bookQty!: number | null;

  @ApiPropertyOptional({ nullable: true })
  countedQty!: number | null;

  @ApiPropertyOptional({ nullable: true })
  diffQty!: number | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  reasonId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  reasonName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  remarks!: string | null;
}

export class StockTransferDocumentDto {
  @ApiProperty({ type: StockTransferHeaderDto })
  header!: StockTransferHeaderDto;

  @ApiProperty({ type: StockTransferLineDto, isArray: true })
  lines!: StockTransferLineDto[];
}

// ── stock_transit ──────────────────────────────────────────────────────────

/**
 * What left and has not arrived. Empty on a same-branch transfer — there is no
 * lorry, so there is nothing to be in transit.
 */
export class StockTransitRowDto {
  @ApiProperty({ format: 'uuid' })
  sttId!: string;

  @ApiProperty({
    enum: ['IN_TRANSIT', 'PARTIAL', 'RECEIVED', 'CANCELLED'],
    description: 'PARTIAL is a TRANSIT status and never a voucher status.',
  })
  status!: string;

  @ApiProperty({ format: 'uuid' })
  itemId!: string;

  @ApiPropertyOptional({ nullable: true })
  itemCode!: string | null;

  @ApiProperty()
  itemName!: string;

  @ApiProperty({ format: 'uuid' })
  lotId!: string;

  @ApiPropertyOptional({ nullable: true, example: 'B-2604' })
  batchNo!: string | null;

  @ApiPropertyOptional({ type: 'string', format: 'date', nullable: true })
  expiryDate!: string | null;

  @ApiProperty({
    format: 'uuid',
    description: "The receipt line's godownId comes from HERE, never from a picker.",
  })
  toGodownId!: string;

  @ApiPropertyOptional({ nullable: true })
  toGodownName!: string | null;

  @ApiProperty({ enum: STOCK_BUCKETS })
  bucket!: string;

  @ApiProperty({ format: 'uuid' })
  baseUomId!: string;

  @ApiPropertyOptional({ nullable: true })
  unitName!: string | null;

  @ApiProperty({ example: 30 })
  sentQty!: number;

  @ApiProperty({ example: 25 })
  receivedQty!: number;

  @ApiProperty({
    example: 3,
    description:
      'Tracked separately from short — a different failure with different people to talk to.',
  })
  damageQty!: number;

  @ApiProperty({
    example: 2,
    description:
      'sent − received − damage, and the same figure the GENERATED stt_short_qty holds. While the transfer is open it is what is still owed; once it closes it is what was lost. A second receipt opens with THIS, not with the original quantity.',
  })
  remainingQty!: number;

  @ApiProperty({
    example: 28,
    description: 'What the stock LEFT with. The receiving branch cannot revalue by receiving.',
  })
  costRate!: number;

  @ApiProperty({ example: 840 })
  transitValue!: number;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Written by this API after the post — the engine never sets it.',
  })
  lrNo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  vehicleNo!: string | null;

  @ApiPropertyOptional({ type: 'string', format: 'date', nullable: true })
  expectedOn!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  sentOn!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  receivedOn!: string | null;
}

export class StockTransferDocumentWithTransitDto extends StockTransferDocumentDto {
  @ApiProperty({
    type: StockTransitRowDto,
    isArray: true,
    description:
      "The despatch's transit rows, so the sender can see what has been received against each line. Empty on a same-branch transfer and on a DRAFT.",
  })
  transit!: StockTransitRowDto[];
}

// ── Lists ──────────────────────────────────────────────────────────────────

export class StockTransferListItemDto {
  @ApiProperty({ format: 'uuid' })
  svhId!: string;

  @ApiProperty({ example: '2026-2027' })
  accYear!: string;

  @ApiProperty({ example: 'TRF/2026-2027/TILL-01/2' })
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

export class StockTransferListMetaDto {
  @ApiProperty({ example: 50 })
  limit!: number;

  @ApiProperty({ example: 0 })
  offset!: number;

  @ApiProperty({ example: 12 })
  count!: number;
}

export class StockTransferListDto {
  @ApiProperty({ type: StockTransferListItemDto, isArray: true })
  items!: StockTransferListItemDto[];

  @ApiProperty({ type: StockTransferListMetaDto })
  meta!: StockTransferListMetaDto;
}

/** One row of the inbound worklist — a transit row plus who sent it and when. */
export class StockTransferInboundRowDto extends StockTransitRowDto {
  @ApiPropertyOptional({ nullable: true, example: 'TRF/2026-2027/TILL-01/2' })
  outRefno!: string | null;

  @ApiProperty({ format: 'uuid' })
  fromBranchId!: string;

  @ApiProperty({
    example: 8,
    description: 'Whole days since despatch — the ageing of transit itself, where losses show up.',
  })
  daysInFlight!: number;
}

export class StockTransferInboundDto {
  @ApiProperty({ type: StockTransferInboundRowDto, isArray: true })
  items!: StockTransferInboundRowDto[];

  @ApiProperty({ type: StockTransferListMetaDto })
  meta!: StockTransferListMetaDto;
}

export class StockTransferLineProblemDto {
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

  @ApiPropertyOptional({ nullable: true, description: 'null means the line is clean.' })
  problem!: string | null;
}

// ── The despatch ───────────────────────────────────────────────────────────

export class StockTransferDespatchDataDto extends StockTransferDocumentDto {
  @ApiProperty({
    example: false,
    description:
      'WHICH SHAPE HAPPENED, read off the posted row and never from the request. true = godown to godown: both ledger rows written as a pair, status POSTED, no transit. false = a lorry left: one ledger row per line plus a transit row, status IN_TRANSIT.',
  })
  sameBranch!: boolean;

  @ApiProperty({ enum: STOCK_VOUCHER_STATUSES, example: 'IN_TRANSIT' })
  status!: string;

  @ApiProperty({
    example: 1,
    description: 'What the engine returned: 2 per line same-branch, 1 per line on a despatch.',
  })
  ledgerRows!: number;

  @ApiProperty({ example: 1, description: '0 on a same-branch transfer.' })
  transitRows!: number;

  @ApiProperty({ type: StockTransitRowDto, isArray: true })
  transit!: StockTransitRowDto[];
}

// ── The receipt ────────────────────────────────────────────────────────────

export class StockTransferPrefillOutDto {
  @ApiProperty({ format: 'uuid' })
  svhId!: string;

  @ApiProperty({ example: '2026-2027' })
  accYear!: string;

  @ApiProperty({ example: 'TRF/2026-2027/TILL-01/2' })
  refno!: string;

  @ApiProperty({ type: 'string', format: 'date' })
  docDate!: string;

  @ApiProperty({ enum: STOCK_VOUCHER_STATUSES, example: 'IN_TRANSIT' })
  status!: string;

  @ApiProperty({ format: 'uuid' })
  fromBranchId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  fromGodownId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  toBranchId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  toGodownId!: string | null;
}

export class StockTransferPrefillRowDto extends StockTransitRowDto {
  @ApiProperty({
    description:
      'Assigned server-side so the grid and the transit rows agree from the first render.',
  })
  lineNo!: number;
}

export class StockTransferPrefillDto {
  @ApiProperty({ type: StockTransferPrefillOutDto })
  outVoucher!: StockTransferPrefillOutDto;

  @ApiProperty({
    type: StockTransferPrefillRowDto,
    isArray: true,
    description:
      "Only rows with something still owed. Read from stock_transit, NOT from the despatch's lines — a posted document does not change, so prefilling from the lines is what lets a clerk receive the same 30 twice.",
  })
  rows!: StockTransferPrefillRowDto[];
}

export class StockTransferReceiveInDto extends StockTransferDocumentDto {
  @ApiProperty({ example: 2 })
  ledgerRows!: number;

  @ApiProperty({ enum: STOCK_VOUCHER_STATUSES, example: 'POSTED' })
  status!: string;
}

export class StockTransferReceiveOutDto {
  @ApiProperty({ format: 'uuid' })
  svhId!: string;

  @ApiProperty({ example: '2026-2027' })
  accYear!: string;

  @ApiProperty({ example: 'TRF/2026-2027/TILL-01/2' })
  refno!: string;

  @ApiProperty({
    enum: STOCK_VOUCHER_STATUSES,
    example: 'IN_TRANSIT',
    description:
      'RECEIVED only when no transit row of it has anything left. A short keeps it IN_TRANSIT on purpose.',
  })
  status!: string;

  @ApiProperty({
    example: false,
    description:
      'THE RECEIPT CLOSING DOES NOT MEAN THE TRANSFER CLOSED. false with a posted receipt means stock is still outstanding — that is the loss report, and the write-off is a separate DAMAGE or ADJUSTMENT voucher the engine deliberately will not raise for you.',
  })
  closed!: boolean;
}

export class StockTransferReceiveDataDto {
  @ApiProperty({ type: StockTransferReceiveInDto })
  inVoucher!: StockTransferReceiveInDto;

  @ApiProperty({ type: StockTransferReceiveOutDto })
  outVoucher!: StockTransferReceiveOutDto;

  @ApiProperty({ type: StockTransitRowDto, isArray: true })
  transit!: StockTransitRowDto[];
}

export class StockTransferCancelDataDto extends StockTransferDocumentDto {
  @ApiProperty({ example: 2 })
  rowsReversed!: number;

  @ApiProperty({ enum: STOCK_VOUCHER_STATUSES, example: 'CANCELLED' })
  status!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  cancelledOn!: string | null;
}

export class StockTransferDeleteDataDto {
  @ApiProperty({ format: 'uuid' })
  svhId!: string;

  @ApiProperty({ example: '2026-2027' })
  accYear!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

// ── Success envelopes ──────────────────────────────────────────────────────

export class StockTransferDocumentSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Stock transfer created successfully' })
  message!: string;

  @ApiProperty({ type: StockTransferDocumentDto })
  data!: StockTransferDocumentDto;
}

export class StockTransferLoadSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Stock transfer fetched successfully' })
  message!: string;

  @ApiProperty({ type: StockTransferDocumentWithTransitDto })
  data!: StockTransferDocumentWithTransitDto;
}

export class StockTransferListSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Stock transfer list fetched successfully' })
  message!: string;

  @ApiProperty({ type: StockTransferListDto })
  data!: StockTransferListDto;
}

export class StockTransferValidateSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'All 3 lines are clean' })
  message!: string;

  @ApiProperty({ type: StockTransferLineProblemDto, isArray: true })
  data!: StockTransferLineProblemDto[];
}

export class StockTransferDespatchSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Transfer despatched — 1 lines in transit' })
  message!: string;

  @ApiProperty({ type: StockTransferDespatchDataDto })
  data!: StockTransferDespatchDataDto;
}

export class StockTransferInboundSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: '3 consignments in transit to this branch' })
  message!: string;

  @ApiProperty({ type: StockTransferInboundDto })
  data!: StockTransferInboundDto;
}

export class StockTransferPrefillSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: '1 lines still to receive against TRF/2026-2027/TILL-01/2' })
  message!: string;

  @ApiProperty({ type: StockTransferPrefillDto })
  data!: StockTransferPrefillDto;
}

export class StockTransferReceiveSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({
    example:
      'Receipt posted — 2 ledger rows, transfer TRF/2026-2027/TILL-01/2 still open with stock outstanding',
  })
  message!: string;

  @ApiProperty({ type: StockTransferReceiveDataDto })
  data!: StockTransferReceiveDataDto;
}

export class StockTransferCancelSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Stock transfer cancelled — 2 reversal rows' })
  message!: string;

  @ApiProperty({ type: StockTransferCancelDataDto })
  data!: StockTransferCancelDataDto;
}

export class StockTransferDeleteSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Stock transfer deleted successfully' })
  message!: string;

  @ApiProperty({ type: StockTransferDeleteDataDto })
  data!: StockTransferDeleteDataDto;
}
