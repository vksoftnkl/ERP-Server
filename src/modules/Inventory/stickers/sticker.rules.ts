import { Prisma } from '@prisma/client';

/**
 * Sticker Printing (menu 32, plan S-P1) — the pure rules: no Prisma client,
 * no Nest. The line builder and the job service call these; so do the specs.
 */

/** Menu 32 Sticker Printing; menu 248 Print Assignments (Test print, PQ4). */
export const STICKER_MENU_ID = 32;
export const PRINT_ASSIGNMENTS_MENU_ID = 248;

/** One list / one job: at most 500 lines (STICKER_TOO_MANY_ITEMS). */
export const STICKER_MAX_LINES = 500;
/** One line: 1-9,999 labels (ck_lbjl_labels). */
export const STICKER_MAX_LABELS_PER_LINE = 9_999;
/** One design group (one job): at most 5,000 labels (PQ5). */
export const STICKER_MAX_LABELS_PER_JOB = 5_000;

/** The job line's own column sizes: a longer value is a line problem, never a truncation. */
export const STICKER_BARCODE_MAX = 50;
export const STICKER_BATCH_MAX = 60;
/** varchar(12) for the cost / price codes. */
export const STICKER_CODE_MAX = 12;

/** The default price level for "Our price": Retail (SM6). */
export const STICKER_DEFAULT_PRICE_LEVEL = 2;

/** app_setting_def key of the cost-code letters (company scope, S14 / SM4). */
export const LABEL_COST_CODE_SETTING = 'inventory.label_cost_code';

export const LABEL_PURPOSES = ['ITEM_LABEL', 'PACK_LABEL', 'SHELF_LABEL'] as const;
export type LabelPurposeCode = (typeof LABEL_PURPOSES)[number];

export function asLabelPurpose(code: string | null | undefined): LabelPurposeCode | null {
  const upper = (code ?? '').trim().toUpperCase();
  return (LABEL_PURPOSES as readonly string[]).includes(upper) ? (upper as LabelPurposeCode) : null;
}

export const LABELS_MODES = ['ONE', 'TYPED', 'STOCK'] as const;
export type LabelsMode = (typeof LABELS_MODES)[number];

export type DesignSource = 'JOB' | 'ITEM' | 'PURPOSE' | 'NONE';
export type BarcodeSource = 'LOT' | 'UNIT' | 'ITEM';

// ─── Reprint reasons (SM9: a fixed list in the screen) ──────────────────────

export const REPRINT_REASONS = {
  JAMMED: 'Labels jammed / spoiled',
  ROLL_OUT: 'Roll ran out in the middle',
  TORN: 'Label torn / fell off',
  OTHER: 'Other',
} as const;
export type ReprintReason = keyof typeof REPRINT_REASONS;

export function asReprintReason(code: string | null | undefined): ReprintReason | null {
  const upper = (code ?? '').trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(REPRINT_REASONS, upper)
    ? (upper as ReprintReason)
    : null;
}

/** "Label torn / fell off", or "Other: <note>". */
export function reasonText(
  code: string | null | undefined,
  note: string | null | undefined,
): string | null {
  const reason = asReprintReason(code);
  if (!reason) {
    return null;
  }
  const words = REPRINT_REASONS[reason];
  const typed = note?.trim();
  return typed ? `${words}: ${typed}` : words;
}

// ─── The cost-code cipher (S14 / SM4, PQ1) ──────────────────────────────────

/**
 * Whole rupees, rounded half up, each digit spelt with the letter at that
 * digit's place: with BLACKHORSE (B = 0 … E = 9) 96.20 → 96 → "EO",
 * 104 → "LBK". No letters (setting not set or not 10 letters), no amount, a
 * negative amount or a code longer than the column → null (prints blank).
 */
export function cipherCode(
  amount: Prisma.Decimal | number | string | null | undefined,
  letters: string | null | undefined,
): string | null {
  const cipher = (letters ?? '').trim().toUpperCase();
  if (!/^[A-Z]{10}$/.test(cipher) || new Set(cipher).size !== 10) {
    return null;
  }
  if (amount === null || amount === undefined || amount === '') {
    return null;
  }
  let whole: Prisma.Decimal;
  try {
    whole = new Prisma.Decimal(amount).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
  } catch {
    return null;
  }
  if (whole.isNegative()) {
    return null;
  }
  const code = whole
    .toFixed(0)
    .split('')
    .map((digit) => cipher[digit.charCodeAt(0) - 48])
    .join('');
  return code.length > 0 && code.length <= STICKER_CODE_MAX ? code : null;
}

// ─── Labels from stock (decision 37, PQ6) ───────────────────────────────────

/**
 * "Stock on hand here" in the label unit: rounded DOWN; a unit with decimals
 * (kg, litre) gives one label; none / negative gives 0 (the line is not added).
 * Capped at 9,999 (one line's most).
 */
export function labelsFromStock(
  stockInUnit: Prisma.Decimal | number | null | undefined,
  unitHasDecimals: boolean,
): number {
  if (stockInUnit === null || stockInUnit === undefined) {
    return 0;
  }
  const stock = new Prisma.Decimal(stockInUnit);
  if (!stock.greaterThan(0)) {
    return 0;
  }
  if (unitHasDecimals) {
    return 1;
  }
  const whole = stock.floor().toNumber();
  return Math.min(STICKER_MAX_LABELS_PER_LINE, Math.max(0, whole));
}

// ─── Lots (SM7) ─────────────────────────────────────────────────────────────

export interface LotChoice {
  readonly lotId: string;
  readonly mrp: Prisma.Decimal | null;
}

/**
 * Lots are the item's lots with SALEABLE stock here, NEWEST FIRST. None → no
 * lot; one, or several sharing ONE MRP → the newest is picked; several MRPs
 * → no lot and `lotRequired` (Print refuses STICKER_LOT_REQUIRED).
 */
export function pickLot(lots: readonly LotChoice[]): {
  lotId: string | null;
  lotRequired: boolean;
} {
  if (lots.length === 0) {
    return { lotId: null, lotRequired: false };
  }
  const mrps = new Set(lots.map((lot) => (lot.mrp === null ? '' : lot.mrp.toFixed(2))));
  if (mrps.size <= 1) {
    return { lotId: lots[0].lotId, lotRequired: false };
  }
  return { lotId: null, lotRequired: true };
}

// ─── Sizes (SM15, decision 33) ──────────────────────────────────────────────

const trimNumber = (value: number): string => {
  const fixed = value.toFixed(2);
  return fixed.replace(/\.?0+$/, '');
};

/** "Same size" = same label width × height × labels across (one roll). */
export function sizeKey(widthMm: number, heightMm: number, across: number): string {
  return `${trimNumber(widthMm)}x${trimNumber(heightMm)}x${across}`;
}

/** "50 × 25 mm · 2 across". */
export function sizeText(widthMm: number, heightMm: number, across: number): string {
  return `${trimNumber(widthMm)} × ${trimNumber(heightMm)} mm · ${across} across`;
}

// ─── Numbers (per counter, PQ3) ─────────────────────────────────────────────

/** D8-000127: the counter's dev_code, a hyphen, the 6-digit serial of the year. */
export function jobRefno(deviceCode: string, slno: number | bigint): string {
  return `${deviceCode.trim()}-${slno.toString().padStart(6, '0')}`;
}

// ─── Display ────────────────────────────────────────────────────────────────

const IST_OFFSET_MS = 330 * 60 * 1000;

/** dd/MM/yyyy hh:mm AM in IST, whatever the server's own zone. */
export function istDateTimeText(value: Date | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const ist = new Date(value.getTime() + IST_OFFSET_MS);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const hours = ist.getUTCHours();
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return (
    `${pad(ist.getUTCDate())}/${pad(ist.getUTCMonth() + 1)}/${ist.getUTCFullYear()} ` +
    `${pad(twelve)}:${pad(ist.getUTCMinutes())} ${hours < 12 ? 'AM' : 'PM'}`
  );
}

/** A @db.Date (UTC midnight) or a 'YYYY-MM-DD' text, as 'YYYY-MM-DD'. */
export function isoDay(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

/** A @db.Date or 'YYYY-MM-DD' as dd/MM/yyyy (S-P2 `doc_date`, `docDate`), or null. */
export function dmyText(value: Date | string | null | undefined): string | null {
  const day = isoDay(value);
  return day && /^\d{4}-\d{2}-\d{2}$/.test(day)
    ? `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`
    : null;
}

/** 'YYYY-MM-DD' → the Date Prisma writes to a @db.Date column. */
export function dayToDate(day: string | null): Date | null {
  return day ? new Date(`${day}T00:00:00.000Z`) : null;
}

/** Money for the JSON answer: a number with 2 dp, or null. */
export function money(value: Prisma.Decimal | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value.toFixed(2));
}

/** A money figure as the job stores it (numeric(14,2)). */
export function money2(value: Prisma.Decimal | null | undefined): Prisma.Decimal | null {
  return value === null || value === undefined
    ? null
    : value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/** saving = MRP − price when > 0, else blank. */
export function savingOf(
  mrp: Prisma.Decimal | null | undefined,
  price: Prisma.Decimal | null | undefined,
): Prisma.Decimal | null {
  if (!mrp || !price) {
    return null;
  }
  const saving = mrp.minus(price);
  return saving.greaterThan(0) ? saving : null;
}

/**
 * Does a stored design body print a barcode? (any BARCODE element in any band)
 * A body that does not parse prints nothing, so it does not.
 */
export function bodyHasBarcode(body: string | null | undefined): boolean {
  if (!body) {
    return false;
  }
  try {
    const parsed = JSON.parse(body) as { bands?: Array<{ elements?: Array<{ kind?: unknown }> }> };
    return (parsed.bands ?? []).some((band) =>
      (band?.elements ?? []).some((element) => element?.kind === 'BARCODE'),
    );
  } catch {
    return false;
  }
}
