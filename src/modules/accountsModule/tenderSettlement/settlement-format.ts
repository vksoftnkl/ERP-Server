import { Prisma } from '@prisma/client';
import { readCsvTable } from '../../stocks/stock-voucher/csv.helper';
import { SettlementLineKind, SettlementSource } from './types/tender-settlement-enum';

/**
 * `acc_tender_master.tnd_statement_format` (49 §1) — how ONE provider's
 * statement file reads: which header holds the RRN, the amount, the fee … The
 * import is built for no provider in particular (plan §12.1: no sample file
 * yet); the map is what makes a file readable. CSV only — XLSX waits for a
 * real file (and a library).
 *
 *   {
 *     "version": 1, "source": "CARD", "provider": "HDFC",
 *     "columns": { "txnOn": "Txn Date", "terminalId": "TID", "refNo": "RRN",
 *                  "authCode": "Auth Code", "cardLast4": "Card No",
 *                  "gross": "Amount", "fee": "MDR", "tax": "GST", "net": "Net",
 *                  "kind": "Txn Type", "payoutRef": "UTR", "payoutDate": "Settled On" },
 *     "kindMap": { "SALE": ["Sale"], "REFUND": ["Refund", "Void"], "CHARGEBACK": ["CB"] },
 *     "dateFormat": "DD/MM/YYYY HH:mm:ss",
 *     "negativeIsRefund": true
 *   }
 *
 * Header names are compared trimmed and case-blind (csv.helper lower-cases
 * them). Only `gross` is required; `txnOn` is needed for the amount + time
 * suggestion, `payoutDate` / `payoutRef` to split a file carrying several
 * payouts (else the request names the payout).
 */
export interface StatementFormat {
  version: 1;
  source: SettlementSource;
  provider: string;
  columns: StatementColumns;
  /** Provider words for each kind, case-blind. No kind column → SALE (or REFUND when negative). */
  kindMap?: Partial<Record<SettlementLineKind, string[]>>;
  /** DD MM YYYY YY HH mm ss and any separators; default YYYY-MM-DD[ HH:mm[:ss]]. Read as IST. */
  dateFormat?: string;
  /** A negative gross with no kind column is a REFUND of its absolute value (default true). */
  negativeIsRefund?: boolean;
}

export interface StatementColumns {
  gross: string;
  txnOn?: string;
  kind?: string;
  terminalId?: string;
  vpa?: string;
  refNo?: string;
  authCode?: string;
  cardLast4?: string;
  payer?: string;
  fee?: string;
  tax?: string;
  net?: string;
  payoutRef?: string;
  payoutDate?: string;
}

const COLUMN_KEYS: readonly (keyof StatementColumns)[] = [
  'gross',
  'txnOn',
  'kind',
  'terminalId',
  'vpa',
  'refNo',
  'authCode',
  'cardLast4',
  'payer',
  'fee',
  'tax',
  'net',
  'payoutRef',
  'payoutDate',
];

const IST_OFFSET_MINUTES = 330;

/** Checks a stored / sent column map; every problem at once. */
export function validateStatementFormat(raw: unknown): {
  format: StatementFormat | null;
  problems: string[];
} {
  const problems: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { format: null, problems: ['The statement format must be an object'] };
  }
  const f = raw as Record<string, unknown>;
  if (f.version !== 1) {
    problems.push('version must be 1');
  }
  const source = typeof f.source === 'string' ? f.source.toUpperCase() : '';
  if (!(Object.values(SettlementSource) as string[]).includes(source)) {
    problems.push(`source must be one of ${Object.values(SettlementSource).join(', ')}`);
  }
  const provider = typeof f.provider === 'string' ? f.provider.trim() : '';
  if (!provider || provider.length > 60) {
    problems.push('provider is required (60 characters at most)');
  }
  const columns: Partial<StatementColumns> = {};
  if (!f.columns || typeof f.columns !== 'object' || Array.isArray(f.columns)) {
    problems.push('columns is required: { gross: "<header>", … }');
  } else {
    for (const [key, value] of Object.entries(f.columns as Record<string, unknown>)) {
      if (!(COLUMN_KEYS as readonly string[]).includes(key)) {
        problems.push(`columns.${key} is not a field the import reads (${COLUMN_KEYS.join(', ')})`);
        continue;
      }
      if (typeof value !== 'string' || !value.trim()) {
        problems.push(`columns.${key} must name a header`);
        continue;
      }
      columns[key as keyof StatementColumns] = value.trim();
    }
    if (!columns.gross) {
      problems.push('columns.gross is required');
    }
  }
  let kindMap: StatementFormat['kindMap'];
  if (f.kindMap !== undefined && f.kindMap !== null) {
    if (typeof f.kindMap !== 'object' || Array.isArray(f.kindMap)) {
      problems.push('kindMap must be an object of kind → words');
    } else {
      kindMap = {};
      for (const [kind, words] of Object.entries(f.kindMap as Record<string, unknown>)) {
        if (!(Object.values(SettlementLineKind) as string[]).includes(kind)) {
          problems.push(`kindMap.${kind} is not a line kind`);
          continue;
        }
        if (!Array.isArray(words) || words.some((w) => typeof w !== 'string' || !w.trim())) {
          problems.push(`kindMap.${kind} must be a list of words`);
          continue;
        }
        kindMap[kind as SettlementLineKind] = words.map((w: string) => w.trim());
      }
    }
  }
  if (columns.kind && !kindMap) {
    problems.push('A kind column needs a kindMap saying which words mean SALE, REFUND …');
  }
  const dateFormat = typeof f.dateFormat === 'string' ? f.dateFormat.trim() : undefined;
  if (dateFormat && !(/D/.test(dateFormat) && /M/.test(dateFormat) && /YY/.test(dateFormat))) {
    problems.push('dateFormat must contain DD, MM and YYYY (or YY)');
  }
  if (f.negativeIsRefund !== undefined && typeof f.negativeIsRefund !== 'boolean') {
    problems.push('negativeIsRefund must be true or false');
  }
  if (problems.length > 0) {
    return { format: null, problems };
  }
  return {
    format: {
      version: 1,
      source: source as SettlementSource,
      provider,
      columns: columns as StatementColumns,
      ...(kindMap ? { kindMap } : {}),
      ...(dateFormat ? { dateFormat } : {}),
      negativeIsRefund: (f.negativeIsRefund as boolean | undefined) ?? true,
    },
    problems,
  };
}

/** One provider line as read — before its tender is resolved or it is matched. */
export interface ParsedStatementLine {
  /** The file's line number (header = 1): what a refusal names. */
  lineNo: number;
  kind: SettlementLineKind;
  txnOn: Date | null;
  terminalId: string | null;
  vpa: string | null;
  refNo: string | null;
  authCode: string | null;
  cardLast4: string | null;
  payer: string | null;
  gross: Prisma.Decimal;
  fee: Prisma.Decimal;
  tax: Prisma.Decimal;
  net: Prisma.Decimal;
  payoutRef: string | null;
  /** YYYY-MM-DD */
  payoutDate: string | null;
  raw: Record<string, string>;
}

export interface ParsedStatement {
  lines: ParsedStatementLine[];
  problems: { lineNo: number; message: string }[];
}

/** Reads a CSV with the map. Every bad row is reported, none is guessed. */
export function parseStatementCsv(text: string, format: StatementFormat): ParsedStatement {
  const table = readCsvTable(text);
  const problems: ParsedStatement['problems'] = [];
  const col = (key: keyof StatementColumns): string | null =>
    format.columns[key] ? format.columns[key].trim().toLowerCase() : null;
  for (const key of COLUMN_KEYS) {
    const header = col(key);
    if (header && !table.headers.includes(header)) {
      problems.push({
        lineNo: 1,
        message: `The file has no "${format.columns[key]}" column (columns.${key}); its headers are: ${table.headers.join(', ')}`,
      });
    }
  }
  if (problems.length > 0) {
    return { lines: [], problems };
  }
  const lines: ParsedStatementLine[] = [];
  const cell = (cells: Record<string, string>, key: keyof StatementColumns): string | null => {
    const header = col(key);
    if (!header) return null;
    const value = (cells[header] ?? '').trim();
    return value === '' ? null : value;
  };
  for (const row of table.rows) {
    const bad = (message: string) => problems.push({ lineNo: row.lineNo, message });
    const grossRaw = parseAmount(cell(row.cells, 'gross'));
    if (grossRaw === null) {
      bad(`gross "${cell(row.cells, 'gross') ?? ''}" is not an amount`);
      continue;
    }
    let kind: SettlementLineKind | null = null;
    const kindCell = cell(row.cells, 'kind');
    if (col('kind')) {
      kind = kindOf(kindCell, format.kindMap ?? {});
      if (!kind) {
        bad(`kind "${kindCell ?? ''}" is in no kindMap list`);
        continue;
      }
    } else {
      kind =
        grossRaw.isNegative() && format.negativeIsRefund !== false
          ? SettlementLineKind.REFUND
          : SettlementLineKind.SALE;
    }
    const fee = parseAmount(cell(row.cells, 'fee')) ?? new Prisma.Decimal(0);
    const tax = parseAmount(cell(row.cells, 'tax')) ?? new Prisma.Decimal(0);
    if (col('fee') && cell(row.cells, 'fee') && parseAmount(cell(row.cells, 'fee')) === null) {
      bad(`fee "${cell(row.cells, 'fee')}" is not an amount`);
      continue;
    }
    if (col('tax') && cell(row.cells, 'tax') && parseAmount(cell(row.cells, 'tax')) === null) {
      bad(`tax "${cell(row.cells, 'tax')}" is not an amount`);
      continue;
    }
    const gross = grossRaw.abs();
    const feeAbs = fee.abs();
    const taxAbs = tax.abs();
    const net = gross.minus(feeAbs).minus(taxAbs);
    const netCell = cell(row.cells, 'net');
    if (netCell !== null) {
      const stated = parseAmount(netCell);
      // A refund / chargeback line states its net negative (money taken back);
      // compare magnitudes, the kind carries the direction.
      if (stated === null || !stated.abs().minus(net.abs()).abs().lessThan('0.005')) {
        bad(
          `net ${netCell} ≠ gross ${gross.toFixed(2)} − fee ${feeAbs.toFixed(2)} − tax ${taxAbs.toFixed(2)}`,
        );
        continue;
      }
    }
    const txnCell = cell(row.cells, 'txnOn');
    const txnOn = txnCell ? parseDateTime(txnCell, format.dateFormat) : null;
    if (txnCell && !txnOn) {
      bad(`txnOn "${txnCell}" does not read as ${format.dateFormat ?? 'YYYY-MM-DD HH:mm'}`);
      continue;
    }
    const payoutCell = cell(row.cells, 'payoutDate');
    const payoutOn = payoutCell ? parseDateTime(payoutCell, format.dateFormat) : null;
    if (payoutCell && !payoutOn) {
      bad(`payoutDate "${payoutCell}" does not read as ${format.dateFormat ?? 'YYYY-MM-DD'}`);
      continue;
    }
    const last4Cell = cell(row.cells, 'cardLast4');
    const last4 = last4Cell ? last4Cell.replace(/\D/g, '').slice(-4) || null : null;
    if (last4Cell && (!last4 || last4.length !== 4)) {
      bad(`cardLast4 "${last4Cell}" has no four digits at its end`);
      continue;
    }
    lines.push({
      lineNo: row.lineNo,
      kind,
      txnOn,
      terminalId: trimTo(cell(row.cells, 'terminalId'), 40),
      vpa: trimTo(cell(row.cells, 'vpa'), 100),
      refNo: trimTo(cell(row.cells, 'refNo'), 60),
      authCode: trimTo(cell(row.cells, 'authCode'), 20),
      cardLast4: last4,
      payer: trimTo(cell(row.cells, 'payer'), 150),
      gross: round2(gross),
      fee: round2(feeAbs),
      tax: round2(taxAbs),
      net: round2(gross).minus(round2(feeAbs)).minus(round2(taxAbs)),
      payoutRef: trimTo(cell(row.cells, 'payoutRef'), 60),
      payoutDate: payoutOn ? istDate(payoutOn) : null,
      raw: row.cells,
    });
  }
  return { lines, problems };
}

/** "1,234.50", "₹ 1234.5", "(160.00)", "160.00 DR" → Decimal (DR and brackets negative); '' → null. */
export function parseAmount(value: string | null): Prisma.Decimal | null {
  if (value === null) {
    return null;
  }
  let token = value.replace(/₹|rs\.?|inr/gi, '').replace(/[,\s]/g, '');
  let negative = false;
  if (/^\(.*\)$/.test(token)) {
    negative = true;
    token = token.slice(1, -1);
  }
  const side = /(cr|dr)$/i.exec(token);
  if (side) {
    negative = negative || side[1].toLowerCase() === 'dr';
    token = token.slice(0, -2);
  }
  if (!/^[-+]?\d+(\.\d+)?$/.test(token)) {
    return null;
  }
  const parsed = new Prisma.Decimal(token);
  return negative ? parsed.negated() : parsed;
}

type DateParts = { y: number; m: number; d: number; hh: number; mi: number; ss: number };

/**
 * A provider's local date / time (no zone: India) → the instant. Tokens DD,
 * D, MM, M, YYYY, YY, HH, mm, ss; anything else in the pattern is a
 * separator. A bare date in a column whose format has a time reads as
 * midnight. No format: 'YYYY-MM-DD[ HH:mm[:ss]]' (or with a T).
 */
export function parseDateTime(value: string, format?: string): Date | null {
  const text = value.trim();
  let parts: DateParts | null;
  if (!format) {
    const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(text);
    parts = iso
      ? {
          y: +iso[1],
          m: +iso[2],
          d: +iso[3],
          hh: +(iso[4] ?? 0),
          mi: +(iso[5] ?? 0),
          ss: +(iso[6] ?? 0),
        }
      : null;
  } else {
    const datePart = format.split(/\s+/)[0];
    parts =
      readWithPattern(text, format) ??
      (datePart !== format ? readWithPattern(text, datePart) : null);
  }
  if (!parts) {
    return null;
  }
  const { y, m, d, hh, mi, ss } = parts;
  if (![y, m, d, hh, mi, ss].every(Number.isFinite) || m < 1 || m > 12 || d < 1 || d > 31) {
    return null;
  }
  if (hh > 23 || mi > 59 || ss > 59) {
    return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d, hh, mi, ss) - IST_OFFSET_MINUTES * 60_000);
  // 31/02 rolls into March in Date.UTC: refuse it rather than move the money a day.
  return istDate(date) === `${y}-${pad(m)}-${pad(d)}` ? date : null;
}

function readWithPattern(text: string, format: string): DateParts | null {
  const order: string[] = [];
  const pattern = format.replace(/YYYY|YY|MM|M|DD|D|HH|mm|ss|[^A-Za-z]+/g, (token): string => {
    if (/^[^A-Za-z]+$/.test(token)) {
      return '[^0-9]+';
    }
    order.push(token);
    return token === 'YYYY' ? '(\\d{4})' : token.length === 1 ? '(\\d{1,2})' : '(\\d{2})';
  });
  const match = new RegExp(`^${pattern}$`).exec(text);
  if (!match) {
    return null;
  }
  const got: Record<string, number> = {};
  order.forEach((token, i) => {
    got[token] = Number(match[i + 1]);
  });
  return {
    y: got.YYYY ?? (got.YY !== undefined ? 2000 + got.YY : NaN),
    m: got.MM ?? got.M,
    d: got.DD ?? got.D,
    hh: got.HH ?? 0,
    mi: got.mm ?? 0,
    ss: got.ss ?? 0,
  };
}

/** The calendar day in India of an instant: YYYY-MM-DD. */
export function istDate(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

/** A payout's lines: one import per payout ref (or date). */
export function groupByPayout(
  lines: readonly ParsedStatementLine[],
  fallback: { payoutRef: string | null; payoutDate: string | null },
): { payoutRef: string | null; payoutDate: string | null; lines: ParsedStatementLine[] }[] {
  const groups = new Map<
    string,
    { payoutRef: string | null; payoutDate: string | null; lines: ParsedStatementLine[] }
  >();
  for (const line of lines) {
    const payoutRef = line.payoutRef ?? fallback.payoutRef;
    const payoutDate = line.payoutDate ?? fallback.payoutDate;
    const key = `${payoutRef ?? ''}|${payoutRef ? '' : (payoutDate ?? '')}`;
    const group = groups.get(key) ?? { payoutRef, payoutDate, lines: [] };
    // One payout is one bank credit: the latest date its lines name is its date.
    if (payoutDate && (!group.payoutDate || payoutDate > group.payoutDate)) {
      group.payoutDate = payoutDate;
    }
    group.lines.push(line);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function kindOf(
  value: string | null,
  kindMap: Partial<Record<SettlementLineKind, string[]>>,
): SettlementLineKind | null {
  if (!value) {
    return null;
  }
  const token = value.trim().toLowerCase();
  for (const [kind, words] of Object.entries(kindMap)) {
    if ((words ?? []).some((w) => w.toLowerCase() === token)) {
      return kind as SettlementLineKind;
    }
  }
  return null;
}

function trimTo(value: string | null, max: number): string | null {
  return value === null ? null : value.slice(0, max);
}

function round2(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
