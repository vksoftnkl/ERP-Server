import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Sticker Printing — the JSON answers, for Swagger only (plan S-P1 §7.1 /
 * §7.2). Money is a number with 2 dp; dates `YYYY-MM-DD`; times
 * dd/MM/yyyy hh:mm AM (IST).
 */

export class StickerProblemDto {
  @ApiProperty({ example: 'STICKER_CODE_NOT_FOUND' }) code!: string;
  @ApiProperty() message!: string;
}

export class StickerLineDto {
  @ApiProperty({ example: '1' }) key!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) itemId!: string | null;
  @ApiPropertyOptional({ nullable: true }) itemName!: string | null;
  @ApiPropertyOptional({ nullable: true }) itemNameTa!: string | null;
  @ApiPropertyOptional({ nullable: true }) itemCode!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'iuc_id of the label unit' })
  unitId!: string | null;
  @ApiPropertyOptional({ nullable: true }) unitName!: string | null;
  @ApiProperty() isDefaultUnit!: boolean;
  @ApiPropertyOptional({ nullable: true, description: 'null = none ("no barcode" pill)' })
  barcode!: string | null;
  @ApiPropertyOptional({ enum: ['LOT', 'UNIT', 'ITEM'], nullable: true }) barcodeSource!:
    | string
    | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) lotId!: string | null;
  @ApiPropertyOptional({ nullable: true }) batchNo!: string | null;
  @ApiPropertyOptional({ nullable: true, example: '2026-11-01' }) mfgDate!: string | null;
  @ApiPropertyOptional({ nullable: true, example: '2027-04-30' }) expiryDate!: string | null;
  @ApiProperty({ description: 'Stocked lots here differ in MRP: Print needs a lot (SM7)' })
  lotRequired!: boolean;
  @ApiProperty({ description: 'Lots with SALEABLE stock here' }) lotCount!: number;
  @ApiPropertyOptional({ nullable: true, example: 52 }) mrp!: number | null;
  @ApiPropertyOptional({ nullable: true, example: 48 }) price!: number | null;
  @ApiProperty({ example: 2 }) priceLevel!: number;
  @ApiPropertyOptional({ nullable: true, example: 'KH' }) costCode!: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'KS' }) priceCode!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) templateId!: string | null;
  @ApiPropertyOptional({ nullable: true }) templateName!: string | null;
  @ApiProperty({ enum: ['JOB', 'ITEM', 'PURPOSE', 'NONE'] }) designSource!: string;
  @ApiProperty() designHasBarcode!: boolean;
  @ApiPropertyOptional({ nullable: true, example: 50 }) labelWidthMm!: number | null;
  @ApiPropertyOptional({ nullable: true, example: 25 }) labelHeightMm!: number | null;
  @ApiPropertyOptional({ nullable: true, example: 2 }) labelsAcross!: number | null;
  @ApiPropertyOptional({ nullable: true, example: 1 }) labelsDown!: number | null;
  @ApiPropertyOptional({ nullable: true, example: 'LABEL' }) paperCode!: string | null;
  @ApiProperty({ example: 1 }) labels!: number;
  @ApiPropertyOptional({ nullable: true, description: 'SALEABLE stock here in the label unit' })
  stockQty!: number | null;
  @ApiPropertyOptional({ nullable: true, example: '25/11/2026 10:30 AM' }) lastPrintedOn!:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true }) lastPrintedLabels!: number | null;
  @ApiPropertyOptional({ type: StickerProblemDto, nullable: true })
  problem!: StickerProblemDto | null;
}

export class StickerAssignmentDto {
  @ApiProperty({ format: 'uuid' }) purposeId!: string;
  @ApiProperty({ example: 'ITEM_LABEL' }) purposeCode!: string;
  @ApiProperty({ example: 'Item label' }) purposeName!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) ptaId!: string | null;
  @ApiPropertyOptional({ enum: ['COUNTER', 'BRANCH', 'COMPANY', 'GLOBAL'], nullable: true })
  scope!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) templateId!: string | null;
  @ApiPropertyOptional({ nullable: true }) templateName!: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'TSC TE244' }) printerName!: string | null;
  @ApiPropertyOptional({ enum: ['PROFILE', 'NAME', 'DEFAULT'], nullable: true }) printerSource!:
    | string
    | null;
  @ApiProperty({
    example: 2,
    description:
      'SM6 / decision 31: the price level of THIS counter\u2019s newest sticker job (any kind or status), ' +
      'else 2 = RET. The Price level box starts on it.',
  })
  lastPriceLevel!: number;
}

class StickerSkippedDto {
  @ApiProperty({ description: 'STOCK mode: items with no SALEABLE stock here, not added' })
  noStock!: number;
}

export class StickerFromItemsDataDto {
  @ApiProperty({ type: [StickerLineDto] }) lines!: StickerLineDto[];
  @ApiProperty({ type: StickerSkippedDto }) skipped!: StickerSkippedDto;
  @ApiProperty({ type: StickerAssignmentDto }) assignment!: StickerAssignmentDto;
}

export class StickerResolveDataDto {
  @ApiProperty({ type: [StickerLineDto] }) lines!: StickerLineDto[];
  @ApiProperty({ type: StickerAssignmentDto }) assignment!: StickerAssignmentDto;
}

export class StickerLotDto {
  @ApiProperty({ format: 'uuid' }) lotId!: string;
  @ApiPropertyOptional({ nullable: true }) batchNo!: string | null;
  @ApiPropertyOptional({ nullable: true }) mrp!: number | null;
  @ApiPropertyOptional({ nullable: true }) salePrice!: number | null;
  @ApiPropertyOptional({ nullable: true }) mfgDate!: string | null;
  @ApiPropertyOptional({ nullable: true }) expiryDate!: string | null;
  @ApiProperty({ description: 'In the unit asked for' }) onHandQty!: number;
  @ApiPropertyOptional({ nullable: true }) firstInwardDate!: string | null;
}

export class StickerLotsDataDto {
  @ApiProperty({ type: [StickerLotDto] }) lots!: StickerLotDto[];
}

class StickerInspectLineDto {
  @ApiProperty({ format: 'uuid' }) lineId!: string;
  @ApiProperty() lineNo!: number;
  @ApiProperty({ format: 'uuid' }) itemId!: string;
  @ApiProperty({ format: 'uuid' }) unitId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) lotId!: string | null;
  @ApiPropertyOptional({ nullable: true }) barcode!: string | null;
  @ApiPropertyOptional({ nullable: true }) mrp!: number | null;
  @ApiPropertyOptional({ nullable: true }) price!: number | null;
  @ApiPropertyOptional({ nullable: true }) batchNo!: string | null;
  @ApiPropertyOptional({ nullable: true }) mfgDate!: string | null;
  @ApiPropertyOptional({ nullable: true }) expiryDate!: string | null;
  @ApiPropertyOptional({ nullable: true }) costCode!: string | null;
  @ApiPropertyOptional({ nullable: true }) priceCode!: string | null;
  @ApiProperty() labels!: number;
  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'S-P2: the document line' })
  srcLineId!: string | null;
}

/** S-P2: the document a job's lines come from. */
export class StickerJobSourceDto {
  @ApiProperty({ enum: ['PURCHASE_BILL', 'SHORTAGE_RECEIPT'] }) docType!: string;
  @ApiProperty({ format: 'uuid' }) docId!: string;
  @ApiProperty({ example: '2026-2027' }) accYear!: string;
  @ApiProperty({ example: 'PUR/2026-2027/D8/01177' }) refno!: string;
}

export class StickerJobInspectDto {
  @ApiProperty({ format: 'uuid' }) jobId!: string;
  @ApiProperty({ example: 'D8-000127' }) jobNo!: string;
  @ApiProperty({ example: '2026-2027' }) accYear!: string;
  @ApiProperty() labels!: number;
  @ApiProperty() pages!: number;
  @ApiPropertyOptional({ type: StickerJobSourceDto, nullable: true, description: 'S-P2; null = manual' })
  source!: StickerJobSourceDto | null;
  @ApiProperty({ type: [StickerInspectLineDto] }) lines!: StickerInspectLineDto[];
  @ApiProperty({ type: [String] }) warnings!: string[];
}

export class StickerJobStatusDataDto {
  @ApiProperty({ format: 'uuid' }) jobId!: string;
  @ApiProperty({ example: 'D8-000127' }) jobNo!: string;
  @ApiProperty({ enum: ['PRINTED', 'FAILED'] }) status!: string;
  @ApiPropertyOptional({ nullable: true, example: '25/11/2026 10:31 AM' }) statusOn!: string | null;
}

export class StickerJobGetDataDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'jobId, jobNo, accYear, kind, reprintOfJobId, reprintOfJobNo, reprintOfAccYear, resendOfJobId, ' +
      'resendOfJobNo, resendOfAccYear (the year of the job in reprint_of / resend_of; null when none), ' +
      'reasonCode, reasonText, ' +
      'reasonNote, status, statusOn, printerMessage, purposeCode, templateId, templateName, versionId, revNo, ' +
      'labelWidthMm, labelHeightMm, labelsAcross, labelsDown, paperCode, printerName, printerDpi, priceLevel, ' +
      'startAt, lineCount, labelCount, pageCount, printedOn, printedBy, printedByName, deviceId, deviceCode, deviceName, ' +
      'srcKind (MANUAL | DOCUMENT), srcDocType, srcDocId, srcAccYear, srcRefno (S-P2; null on a manual job)',
  })
  job!: Record<string, unknown>;

  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description:
      'lineId, lineNo, itemId, itemName, unitId, unitName, lotId, barcode, batchNo, mrp, price, mfgDate, ' +
      'expiryDate, labels, reprintedLabels, reprintOfLineId, srcLineId (S-P2)',
  })
  lines!: Array<Record<string, unknown>>;

  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description:
      'The jobs that printed lines of this job again (the reprintedLabels source): jobId, jobNo, accYear, ' +
      'kind (REPRINT, or PRINT for a resend of a failed reprint), printedOn, labels (of this job\'s lines), ' +
      'reasonText (a resend: the reason of the reprint it sends again), status (SENT / PRINTED / FAILED; a ' +
      'FAILED one is not counted in reprintedLabels), resendOfJobId, resendOfJobNo (set on a resend)',
  })
  reprints!: Array<Record<string, unknown>>;
}

// ─── S-P2: stickers of a document ───────────────────────────────────────────

export class StickerFromGrnDto {
  @ApiProperty({ format: 'uuid' }) grnId!: string;
  @ApiProperty({ example: '2026-2027' }) accYear!: string;
  @ApiPropertyOptional({ nullable: true, example: 'GRN/2026-2027/D8/00041' }) refno!: string | null;
}

export class StickerDocHeadDto {
  @ApiProperty({ enum: ['PURCHASE_BILL', 'SHORTAGE_RECEIPT'] }) docType!: string;
  @ApiProperty({ format: 'uuid' }) docId!: string;
  @ApiProperty({ example: '2026-2027' }) accYear!: string;
  @ApiProperty({ example: 'PUR/2026-2027/D8/01177' }) refno!: string;
  @ApiPropertyOptional({ nullable: true, example: '26/11/2026' }) docDate!: string | null;
  @ApiProperty({ example: 'POSTED' }) status!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) supplierId!: string | null;
  @ApiPropertyOptional({ nullable: true }) supplierName!: string | null;
  @ApiPropertyOptional({
    enum: ['DIRECT', 'GRN', 'SISTER_SALE'],
    nullable: true,
    description: 'null on a shortage receipt',
  })
  sourceKind!: string | null;
  @ApiProperty({ type: [StickerFromGrnDto] }) fromGrns!: StickerFromGrnDto[];
  @ApiProperty() linesAll!: number;
  @ApiProperty() linesTicked!: number;
}

export class StickerDocLineDto extends StickerLineDto {
  @ApiProperty({ enum: ['PURCHASE_BILL', 'SHORTAGE_RECEIPT'] }) srcDocType!: string;
  @ApiProperty({ format: 'uuid' }) srcDocId!: string;
  @ApiProperty({ example: '2026-2027' }) srcAccYear!: string;
  @ApiProperty({ example: 'PUR/2026-2027/D8/01177' }) srcRefno!: string;
  @ApiProperty({ format: 'uuid', description: 'pii_id / psri_id (the lowest line number when merged)' })
  srcLineId!: string;
  @ApiProperty({ example: 2 }) srcLineNo!: number;
  @ApiProperty({ type: [Number], example: [1, 7] }) srcLineNos!: number[];
  @ApiPropertyOptional({ nullable: true, description: 'the GRN of a line made from one' })
  srcGrnRefno!: string | null;
  @ApiProperty({ example: 60 }) needed!: number;
  @ApiProperty({
    example: 40,
    description: 'min(PRINT jobs not FAILED, needed), a reprint’s copies left out (F2)',
  })
  printed!: number;
  @ApiProperty({ example: 0, description: 'from a cancelled bill of the same GRN lines (Q20)' })
  carried!: number;
  @ApiProperty({ example: 20 }) left!: number;
  @ApiProperty({
    example: 0,
    description:
      'REPRINT jobs and resends of a failed reprint, not FAILED (never counted in printed, F2)',
  })
  reprinted!: number;
}

class StickerDocSkippedDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description: 'stickerOnly: lines whose item is not ticked Sticker: lineNo, itemName',
  })
  notTicked!: Array<{ lineNo: number; itemName: string | null }>;
}

export class StickerFromDocDataDto {
  @ApiProperty({ type: StickerDocHeadDto }) doc!: StickerDocHeadDto;
  @ApiProperty({ type: [StickerDocLineDto] }) lines!: StickerDocLineDto[];
  @ApiProperty({ type: StickerDocSkippedDto }) skipped!: StickerDocSkippedDto;
  @ApiProperty({ type: StickerAssignmentDto }) assignment!: StickerAssignmentDto;
}

class StickerDocJobDto {
  @ApiProperty({ format: 'uuid' }) jobId!: string;
  @ApiProperty({ example: 'D8-000127' }) jobNo!: string;
  @ApiProperty({ example: '2026-2027' }) accYear!: string;
  @ApiProperty() labels!: number;
  @ApiProperty({ enum: ['PRINT', 'REPRINT'] }) kind!: string;
  @ApiProperty({
    description:
      'F2: true = the job prints labels again (a REPRINT, or a resend of a failed reprint, which is kind ' +
      'PRINT); it never counts in printed. false = a real print or a resend of one.',
  })
  reprint!: boolean;
  @ApiProperty({ enum: ['SENT', 'PRINTED', 'FAILED'] }) status!: string;
  @ApiPropertyOptional({ nullable: true, example: '26/11/2026 10:30 AM' }) printedOn!: string | null;
}

class StickerCarriedFromDto {
  @ApiProperty({ format: 'uuid' }) docId!: string;
  @ApiProperty({ example: '2026-2027' }) accYear!: string;
  @ApiPropertyOptional({ nullable: true }) refno!: string | null;
  @ApiProperty() labels!: number;
}

export class StickerDocStateDataDto {
  @ApiProperty({ enum: ['PURCHASE_BILL', 'SHORTAGE_RECEIPT'] }) docType!: string;
  @ApiProperty({ format: 'uuid' }) docId!: string;
  @ApiProperty({ example: '2026-2027' }) accYear!: string;
  @ApiProperty() refno!: string;
  @ApiProperty({ example: 'POSTED' }) status!: string;
  @ApiPropertyOptional({ nullable: true }) sourceKind!: string | null;
  @ApiProperty({ type: [StickerFromGrnDto] }) fromGrns!: StickerFromGrnDto[];
  @ApiProperty() linesAll!: number;
  @ApiProperty() linesTicked!: number;
  @ApiProperty() needed!: number;
  @ApiProperty() printed!: number;
  @ApiProperty() carried!: number;
  @ApiProperty() left!: number;
  @ApiProperty({ enum: ['NONE', 'NOT', 'PART', 'DONE'] }) state!: string;
  @ApiProperty({ type: [StickerDocJobDto] }) jobs!: StickerDocJobDto[];
  @ApiProperty({ type: [StickerCarriedFromDto] }) carriedFrom!: StickerCarriedFromDto[];
  @ApiProperty({ enum: ['ASK', 'ALWAYS', 'NEVER'], description: 'this counter’s "Stickers after post"' })
  afterPost!: string;
}
