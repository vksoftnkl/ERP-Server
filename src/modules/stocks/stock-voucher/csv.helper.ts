/**
 * A small RFC 4180 CSV reader, written here rather than pulled in as a
 * dependency: one endpoint needs it, and the two things a spreadsheet export
 * actually does to a stock import — quote a field containing a comma, and
 * double a quote inside a quoted field — are the two things a naive
 * `line.split(',')` gets wrong. An item named `SALT, TABLE 1KG` split naively
 * shifts every column after it by one, which is how a quantity lands in the
 * cost-rate column and posts.
 *
 * Deliberately NOT a general CSV library: no streaming, no custom delimiters,
 * no type inference. The caller gets strings and decides what they mean.
 */

/** Excel writes one on every UTF-8 CSV; it would otherwise glue itself to the first header. */
const BOM = '﻿';

export interface CsvTable {
  /** Header cells, trimmed and lower-cased, in file order. */
  headers: string[];
  /** One record per data row, keyed by the header names above. */
  rows: CsvRow[];
}

export interface CsvRow {
  /** 1-based line number in the FILE, header included — what the user sees in their editor. */
  lineNo: number;
  cells: Record<string, string>;
}

/**
 * Splits CSV text into rows of raw cells.
 *
 * Handles quoted fields containing commas, newlines and doubled quotes, and
 * accepts CRLF, LF or CR line endings. A trailing newline does not produce a
 * final empty row.
 */
export function parseCsv(text: string): string[][] {
  const input = text.startsWith(BOM) ? text.slice(BOM.length) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let index = 0;

  const endCell = (): void => {
    row.push(cell);
    cell = '';
  };
  const endRow = (): void => {
    endCell();
    rows.push(row);
    row = [];
  };

  while (index < input.length) {
    const char = input[index];

    if (inQuotes) {
      if (char === '"') {
        // A doubled quote inside a quoted field is one literal quote.
        if (input[index + 1] === '"') {
          cell += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      cell += char;
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      index += 1;
      continue;
    }
    if (char === ',') {
      endCell();
      index += 1;
      continue;
    }
    if (char === '\r' || char === '\n') {
      endRow();
      // CRLF is one line ending, not two.
      index += char === '\r' && input[index + 1] === '\n' ? 2 : 1;
      continue;
    }
    cell += char;
    index += 1;
  }

  // Whatever is still buffered is the last row — unless the file ended on a
  // newline, in which case there is nothing buffered and nothing to add.
  if (cell !== '' || row.length > 0) {
    endRow();
  }
  return rows;
}

/**
 * Reads a CSV with a header row into keyed records.
 *
 * Header names are trimmed and lower-cased so `Item Code`, `item code` and
 * `ITEM CODE` are the same column — a spreadsheet round-trip changes the case
 * of a header often enough that treating them as different columns would reject
 * files that are perfectly correct.
 *
 * Rows that are entirely blank are dropped: a spreadsheet export routinely ends
 * with a few, and they are not an error the user can act on.
 */
export function readCsvTable(text: string): CsvTable {
  const rows = parseCsv(text);
  if (!rows.length) {
    return { headers: [], rows: [] };
  }
  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const records: CsvRow[] = [];

  for (let i = 1; i < rows.length; i += 1) {
    const cells = rows[i];
    if (cells.every((cell) => cell.trim() === '')) {
      continue;
    }
    const record: Record<string, string> = {};
    headers.forEach((header, column) => {
      record[header] = (cells[column] ?? '').trim();
    });
    records.push({ lineNo: i + 1, cells: record });
  }
  return { headers, rows: records };
}
