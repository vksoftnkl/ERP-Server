import { Prisma } from '@prisma/client';
import type { StickerRefusal } from '../sticker.errors';
import type { BarcodeSource, DesignSource } from '../sticker.rules';

/** Plan §7.1 — one line of the Print list, as every lines route answers it. */
export interface StickerLine {
  key: string;
  itemId: string | null;
  itemName: string | null;
  itemNameTa: string | null;
  itemCode: string | null;
  /** inventory.item_unit_conversion.iuc_id — the label unit. */
  unitId: string | null;
  unitName: string | null;
  isDefaultUnit: boolean;
  barcode: string | null;
  barcodeSource: BarcodeSource | null;
  lotId: string | null;
  batchNo: string | null;
  mfgDate: string | null;
  expiryDate: string | null;
  lotRequired: boolean;
  lotCount: number;
  mrp: number | null;
  price: number | null;
  priceLevel: number;
  costCode: string | null;
  priceCode: string | null;
  templateId: string | null;
  templateName: string | null;
  designSource: DesignSource;
  designHasBarcode: boolean;
  labelWidthMm: number | null;
  labelHeightMm: number | null;
  labelsAcross: number | null;
  labelsDown: number | null;
  paperCode: string | null;
  labels: number;
  /** SALEABLE stock here, in the label unit (3 dp). */
  stockQty: number | null;
  /** dd/MM/yyyy hh:mm AM (IST). */
  lastPrintedOn: string | null;
  lastPrintedLabels: number | null;
  problem: { code: string; message: string } | null;
}

/** Plan §7.1 — the purpose's assignment for this counter (output PRINT). */
export interface StickerAssignment {
  purposeId: string;
  purposeCode: string;
  purposeName: string;
  ptaId: string | null;
  scope: 'COUNTER' | 'BRANCH' | 'COMPANY' | 'GLOBAL' | null;
  templateId: string | null;
  templateName: string | null;
  printerName: string | null;
  printerSource: 'PROFILE' | 'NAME' | 'DEFAULT' | null;
  /** SM6 / decision 31: this counter's last job's price level (1-4), else 2 = RET. */
  lastPriceLevel: number;
}

/** What the builder knows about a line beyond its answer: exact figures and label-only fields. */
export interface StickerLineFacts {
  mrp: Prisma.Decimal | null;
  price: Prisma.Decimal | null;
  cost: Prisma.Decimal | null;
  versionId: string | null;
  brand: string | null;
  groupName: string | null;
  size: string | null;
  colour: string | null;
  model: string | null;
  priceLevelShort: string | null;
  /** The label unit counts in decimals (kg, litre): "stock on hand" gives 1 label. */
  unitHasDecimals: boolean;
  /** S-P2 C8: the lot's supplier's Short name (`supplier_code`); absent / null = blank. */
  supplierCode?: string | null;
}

export interface BuiltStickerLine {
  line: StickerLine;
  facts: StickerLineFacts;
  /** The line's `problem` as a refusal the job routes throw (with its field / rule). */
  refusal?: StickerRefusal;
}

export interface StickerLotPayload {
  lotId: string;
  batchNo: string | null;
  mrp: number | null;
  salePrice: number | null;
  mfgDate: string | null;
  expiryDate: string | null;
  /** In the unit asked for (3 dp). */
  onHandQty: number;
  firstInwardDate: string | null;
}

/** The figures a job line freezes (label_job_line). */
export interface FrozenStickerLine {
  lineNo: number;
  itemId: string;
  unitId: string;
  lotId: string | null;
  barcode: string | null;
  mrp: Prisma.Decimal | null;
  price: Prisma.Decimal | null;
  batchNo: string | null;
  mfgDate: string | null;
  expiryDate: string | null;
  costCode: string | null;
  priceCode: string | null;
  labels: number;
  reprintOfLineId: string | null;
  /** S-P2: the document line (pii_id / psri_id) of a DOCUMENT job; absent / null otherwise. */
  srcLineId?: string | null;
}

/** S-P2: the document a job's lines come from (frozen on label_job.lbj_src_*). */
export interface StickerJobSource {
  docType: string;
  docId: string;
  accYear: string;
  refno: string;
}

/** `inspect: true` on print / reprint / resend (plan §7.2). */
export interface StickerJobInspect {
  jobId: string;
  jobNo: string;
  accYear: string;
  labels: number;
  pages: number;
  /** S-P2: the job's document, null for a MANUAL job. */
  source: StickerJobSource | null;
  lines: Array<{
    lineId: string;
    lineNo: number;
    itemId: string;
    unitId: string;
    lotId: string | null;
    barcode: string | null;
    mrp: number | null;
    price: number | null;
    batchNo: string | null;
    mfgDate: string | null;
    expiryDate: string | null;
    costCode: string | null;
    priceCode: string | null;
    labels: number;
    /** S-P2: the document line, null on a MANUAL job. */
    srcLineId: string | null;
  }>;
  warnings: string[];
}
