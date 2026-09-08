import { PrismaService } from 'src/database/prisma/prisma.service';
import { readCsvTable, type CsvRow } from './csv.helper';
import type { SaveStockVoucherItemDto } from './dto/save-stock-voucher-item.dto';
import type { StockErrorDetail } from './types/stock-voucher.types';

/**
 * Turning a spreadsheet into stock voucher lines.
 *
 * THE WHOLE RISK THIS FILE MANAGES is silent mis-resolution. A CSV names things
 * the way a human does — an item CODE, a unit NAME, a godown name — and every
 * one of those has to become a uuid. Get one wrong and the import does not fail;
 * it succeeds, against the wrong item, and the operator finds out when a stock
 * report is wrong months later. The plan says as much: a 400-line opening typed
 * by hand is painful but correct, whereas a silent code-resolution mismatch is
 * 400 wrong lines.
 *
 * So the rules here are deliberately unforgiving:
 *
 *   * **Ambiguity is a refusal, never a guess.** Two items with the same code,
 *     or two unit conversions with the same unit name on one item, refuse the
 *     row and name both candidates. "Pick the first" is how an import silently
 *     opens the wrong holding.
 *   * **Every bad row is reported, not the first.** An operator fixing a 400
 *     line file one error per upload will stop trusting the importer before
 *     they finish.
 *   * **The unit is resolved WITHIN the item.** `iuc_id` is per (item, unit) —
 *     a unit name resolved globally and then attached to another item's line is
 *     precisely the `svi_uom_id` / `unit_id` confusion the schema warns about
 *     twice.
 */

/** Header aliases, so a spreadsheet round-trip that renames a column still lands. */
const COLUMN_ALIASES: Readonly<Record<string, readonly string[]>> = {
  lineNo: ['line_no', 'lineno', 'line', 'sl', 'slno', 'sl_no'],
  splitNo: ['split_no', 'splitno', 'split'],
  itemCode: ['item_code', 'itemcode', 'code', 'item'],
  unitName: ['unit_name', 'unitname', 'unit', 'uom', 'uom_name'],
  godown: ['godown', 'godown_name', 'godown_code', 'godownname', 'godowncode'],
  bucket: ['bucket'],
  barcode: ['barcode', 'bar_code', 'ean', 'upc'],
  batchNo: ['batch_no', 'batchno', 'batch'],
  mfgDate: ['mfg_date', 'mfgdate', 'manufacture_date'],
  expiryDate: ['expiry_date', 'expirydate', 'expiry', 'exp_date'],
  mrp: ['mrp'],
  salePrice: ['sale_price', 'saleprice', 'selling_price'],
  serialNo: ['serial_no', 'serialno', 'serial'],
  supplierName: ['supplier', 'supplier_name', 'suppliername', 'supplier_short'],
  qty: ['qty', 'quantity', 'opening_qty', 'openingqty'],
  freeQty: ['free_qty', 'freeqty', 'free'],
  weightQty: ['weight_qty', 'weightqty', 'weight', 'net_weight'],
  costRate: ['cost_rate', 'costrate', 'cost', 'cost_price', 'rate'],
  costRateWot: ['cost_rate_wot', 'costratewot', 'cost_wot'],
  landedRate: ['landed_rate', 'landedrate', 'landed', 'landed_cost'],
  taxPerc: ['tax_perc', 'taxperc', 'tax', 'tax_percent'],
  remarks: ['remarks', 'remark', 'notes'],
};

/** Without these four a line cannot be built at all. */
const REQUIRED_FIELDS = ['itemCode', 'unitName', 'qty', 'costRate'] as const;

export interface ImportScope {
  companyId: string;
  branchId: string;
  /** The header's to-godown, used for any row that does not name one. */
  defaultGodownId: string;
}

export interface ImportResult {
  lines: SaveStockVoucherItemDto[];
  errors: StockErrorDetail[];
  /** Data rows seen in the file, whether or not they resolved. */
  rowsRead: number;
}

/** Reads a cell by any of its aliases; returns '' when the column is absent. */
function cell(row: CsvRow, field: keyof typeof COLUMN_ALIASES): string {
  for (const alias of COLUMN_ALIASES[field]) {
    const value = row.cells[alias];
    if (value !== undefined && value !== '') {
      return value;
    }
  }
  return '';
}

function hasColumn(headers: readonly string[], field: keyof typeof COLUMN_ALIASES): boolean {
  return COLUMN_ALIASES[field].some((alias) => headers.includes(alias));
}

/**
 * A number, or null when the cell is blank or not a number.
 *
 * Strips thousands separators and a currency symbol, because a spreadsheet
 * exports `1,250.00` and refusing that would be pedantry — but does NOT accept
 * anything else, because a cell reading `approx 12` must not silently become 12.
 */
function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/[\s,₹$]/g, '');
  if (cleaned === '') {
    return null;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** `yyyy-MM-dd`, or `dd/MM/yyyy` and `dd-MM-yyyy` as a spreadsheet writes them. */
function parseDate(raw: string): string | null {
  if (raw === '') {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

/**
 * Resolves an entire CSV into save-ready lines.
 *
 * Every lookup is done ONCE for the whole file, in three queries, rather than
 * per row: a 400-line import is 400 items, and a per-row `findFirst` would be
 * 1,200 round trips against a table this import is already holding a
 * transaction near.
 */
export async function resolveImportedLines(
  prisma: PrismaService,
  csvText: string,
  scope: ImportScope,
): Promise<ImportResult> {
  const table = readCsvTable(csvText);
  const errors: StockErrorDetail[] = [];

  if (!table.rows.length) {
    errors.push({
      field: 'file',
      message: table.headers.length
        ? 'The file has a header row but no data rows.'
        : 'The file is empty.',
    });
    return { lines: [], errors, rowsRead: 0 };
  }

  const missingColumns = REQUIRED_FIELDS.filter((field) => !hasColumn(table.headers, field));
  if (missingColumns.length) {
    // Named against the canonical spelling, plus what was actually found, so a
    // near-miss ("item code" with a space) is obvious rather than mysterious.
    errors.push({
      field: 'file',
      message: `The file is missing required column(s): ${missingColumns
        .map((field) => COLUMN_ALIASES[field][0])
        .join(', ')}. Found: ${table.headers.join(', ') || '(none)'}.`,
    });
    return { lines: [], errors, rowsRead: table.rows.length };
  }

  const itemCodes = [...new Set(table.rows.map((row) => cell(row, 'itemCode')).filter(Boolean))];
  const godownNames = [...new Set(table.rows.map((row) => cell(row, 'godown')).filter(Boolean))];
  const supplierNames = [
    ...new Set(table.rows.map((row) => cell(row, 'supplierName')).filter(Boolean)),
  ];

  const [items, godowns, suppliers] = await Promise.all([
    itemCodes.length
      ? prisma.itemMaster.findMany({
          where: { itemCode: { in: itemCodes, mode: 'insensitive' }, itemIsDeleted: false },
          select: {
            itemId: true,
            itemCode: true,
            itemNameEn: true,
            unitConversions: {
              where: { iucIsDeleted: false },
              select: {
                iucId: true,
                iucIsBaseUnit: true,
                // The save path no longer reads item_unit_conversion — the
                // client sends the factor. A CSV cannot, so the importer, whose
                // whole job is resolving spreadsheet names against the master
                // data, reads it here and puts it on the line it builds.
                iucToBaseFactor: true,
                unit: { select: { unit_name: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    godownNames.length
      ? prisma.godownLocation.findMany({
          where: {
            gdlBranchId: scope.branchId,
            gdlIsDeleted: false,
            OR: [
              { gdlName: { in: godownNames, mode: 'insensitive' } },
              { gdlCode: { in: godownNames, mode: 'insensitive' } },
            ],
          },
          select: { gdlId: true, gdlName: true, gdlCode: true },
        })
      : Promise.resolve([]),
    supplierNames.length
      ? // supplier_master has no code column — supName and supShort are what a
        // storekeeper writes in a spreadsheet, so both are accepted.
        prisma.supplier.findMany({
          where: {
            supIsDeleted: false,
            OR: [
              { supName: { in: supplierNames, mode: 'insensitive' } },
              { supShort: { in: supplierNames, mode: 'insensitive' } },
            ],
          },
          select: { supId: true, supName: true, supShort: true },
        })
      : Promise.resolve([]),
  ]);

  // Multi-maps, because the whole point is to detect the duplicates rather than
  // let a Map silently keep whichever row happened to come back last.
  const itemsByCode = new Map<string, typeof items>();
  for (const item of items) {
    const key = (item.itemCode ?? '').toLowerCase();
    const bucket = itemsByCode.get(key) ?? [];
    bucket.push(item);
    itemsByCode.set(key, bucket);
  }
  const godownsByName = new Map<string, typeof godowns>();
  for (const godown of godowns) {
    for (const key of [godown.gdlName, godown.gdlCode]) {
      if (!key) continue;
      const bucket = godownsByName.get(key.toLowerCase()) ?? [];
      if (!bucket.some((candidate) => candidate.gdlId === godown.gdlId)) {
        bucket.push(godown);
      }
      godownsByName.set(key.toLowerCase(), bucket);
    }
  }
  const suppliersByName = new Map<string, typeof suppliers>();
  for (const supplier of suppliers) {
    for (const key of [supplier.supName, supplier.supShort]) {
      if (!key) continue;
      const bucket = suppliersByName.get(key.toLowerCase()) ?? [];
      if (!bucket.some((candidate) => candidate.supId === supplier.supId)) {
        bucket.push(supplier);
      }
      suppliersByName.set(key.toLowerCase(), bucket);
    }
  }

  const lines: SaveStockVoucherItemDto[] = [];

  table.rows.forEach((row, index) => {
    const field = `file.row.${row.lineNo}`;
    const fail = (message: string): void => {
      errors.push({ field, message: `Row ${row.lineNo}: ${message}` });
    };

    const itemCode = cell(row, 'itemCode');
    const candidates = itemsByCode.get(itemCode.toLowerCase()) ?? [];
    if (!candidates.length) {
      fail(`no item with code "${itemCode}".`);
      return;
    }
    if (candidates.length > 1) {
      fail(
        `item code "${itemCode}" matches ${candidates.length} items (${candidates
          .map((candidate) => candidate.itemNameEn)
          .join(', ')}). Codes must be unique to import by them.`,
      );
      return;
    }
    const item = candidates[0];

    const unitName = cell(row, 'unitName');
    const unitMatches = item.unitConversions.filter(
      (conversion) => (conversion.unit?.unit_name ?? '').toLowerCase() === unitName.toLowerCase(),
    );
    if (!unitMatches.length) {
      fail(
        `"${item.itemNameEn}" has no unit named "${unitName}". Its units are: ${
          item.unitConversions.map((c) => c.unit?.unit_name).filter(Boolean).join(', ') || '(none)'
        }.`,
      );
      return;
    }
    if (unitMatches.length > 1) {
      fail(
        `"${item.itemNameEn}" has ${unitMatches.length} conversions named "${unitName}". Resolve the duplicate on the item before importing.`,
      );
      return;
    }
    const baseUnit = item.unitConversions.find((conversion) => conversion.iucIsBaseUnit);
    if (!baseUnit) {
      fail(`"${item.itemNameEn}" has no base unit in item_unit_conversion.`);
      return;
    }

    let godownId = scope.defaultGodownId;
    const godownName = cell(row, 'godown');
    if (godownName) {
      const godownMatches = godownsByName.get(godownName.toLowerCase()) ?? [];
      if (!godownMatches.length) {
        fail(`no godown named or coded "${godownName}" in this branch.`);
        return;
      }
      if (godownMatches.length > 1) {
        fail(`"${godownName}" matches ${godownMatches.length} godowns in this branch.`);
        return;
      }
      godownId = godownMatches[0].gdlId;
    }

    let supplierId: string | null = null;
    const supplierName = cell(row, 'supplierName');
    if (supplierName) {
      const supplierMatches = suppliersByName.get(supplierName.toLowerCase()) ?? [];
      if (!supplierMatches.length) {
        fail(`no supplier named "${supplierName}".`);
        return;
      }
      if (supplierMatches.length > 1) {
        fail(`"${supplierName}" matches ${supplierMatches.length} suppliers.`);
        return;
      }
      supplierId = supplierMatches[0].supId;
    }

    const qty = parseNumber(cell(row, 'qty'));
    if (qty === null) {
      fail(`"${cell(row, 'qty')}" is not a quantity.`);
      return;
    }
    const freeQty = parseNumber(cell(row, 'freeQty')) ?? 0;
    // The line the importer builds must now be complete: the service writes
    // svi_to_base_factor / svi_base_qty / svi_free_base_qty straight through and
    // multiplies nothing, so the importer does the conversion the grid would
    // have done.
    const factor = Number(unitMatches[0].iucToBaseFactor);
    if (!Number.isFinite(factor) || factor <= 0) {
      fail(`unit "${cell(row, 'unitName')}" has no usable conversion factor on this item.`);
      return;
    }
    const costRate = parseNumber(cell(row, 'costRate'));
    if (costRate === null) {
      fail(`"${cell(row, 'costRate')}" is not a cost rate.`);
      return;
    }

    const rawMfg = cell(row, 'mfgDate');
    const mfgDate = rawMfg ? parseDate(rawMfg) : null;
    if (rawMfg && mfgDate === null) {
      fail(`"${rawMfg}" is not a date the importer recognises (yyyy-MM-dd or dd/MM/yyyy).`);
      return;
    }
    const rawExpiry = cell(row, 'expiryDate');
    const expiryDate = rawExpiry ? parseDate(rawExpiry) : null;
    if (rawExpiry && expiryDate === null) {
      fail(`"${rawExpiry}" is not a date the importer recognises (yyyy-MM-dd or dd/MM/yyyy).`);
      return;
    }

    const explicitLineNo = parseNumber(cell(row, 'lineNo'));
    const explicitSplitNo = parseNumber(cell(row, 'splitNo'));

    lines.push({
      // File order is the default, so a file with no line_no column still gets
      // stable, gap-free numbering that matches what the operator sees.
      lineNo: explicitLineNo !== null ? Math.trunc(explicitLineNo) : index + 1,
      splitNo: explicitSplitNo !== null ? Math.trunc(explicitSplitNo) : 1,
      itemId: item.itemId,
      uomId: unitMatches[0].iucId,
      baseUomId: baseUnit.iucId,
      toBaseFactor: factor,
      godownId,
      bucket: (cell(row, 'bucket') || undefined) as SaveStockVoucherItemDto['bucket'],
      barcode: cell(row, 'barcode') || null,
      batchNo: cell(row, 'batchNo') || null,
      mfgDate,
      expiryDate,
      mrp: parseNumber(cell(row, 'mrp')),
      salePrice: parseNumber(cell(row, 'salePrice')),
      serialNo: cell(row, 'serialNo') || null,
      supplierId,
      qty,
      baseQty: qty * factor,
      freeQty: freeQty,
      freeBaseQty: freeQty * factor,
      weightQty: parseNumber(cell(row, 'weightQty')) ?? 0,
      costRate,
      costRateWot: parseNumber(cell(row, 'costRateWot')) ?? 0,
      landedRate: parseNumber(cell(row, 'landedRate')) ?? 0,
      taxPerc: parseNumber(cell(row, 'taxPerc')) ?? 0,
      remarks: cell(row, 'remarks') || null,
    });
  });

  return { lines, errors, rowsRead: table.rows.length };
}
