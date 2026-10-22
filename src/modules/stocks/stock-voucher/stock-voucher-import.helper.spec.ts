import { PrismaService } from '../../../database/prisma/prisma.service';
import { StockErrorCode } from '../types/stock-error-codes';
import { parseCsv, readCsvTable } from './csv.helper';
import { resolveImportedLines } from './stock-voucher-import.helper';

const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '01000000-0000-7000-8000-0000000000b1';
const GODOWN_ID = '01000000-0000-7000-8000-0000000000e1';
const OTHER_GODOWN_ID = '01000000-0000-7000-8000-0000000000e2';
const SALT_ID = '01000000-0000-7000-8000-000000000001';
const BOX_IUC = '01000000-0000-7000-8000-000000000011';
const PIECE_IUC = '01000000-0000-7000-8000-000000000012';
const SUPPLIER_ID = '01000000-0000-7000-8000-0000000000a9';

describe('parseCsv', () => {
  it('keeps a comma inside a quoted field with the field', () => {
    // The failure this guards: `SALT, TABLE 1KG` split naively shifts every
    // column after it by one, and a quantity lands in the cost-rate column.
    expect(parseCsv('a,"SALT, TABLE 1KG",3')).toEqual([['a', 'SALT, TABLE 1KG', '3']]);
  });

  it('reads a doubled quote as one literal quote', () => {
    expect(parseCsv('"say ""hi""",2')).toEqual([['say "hi"', '2']]);
  });

  it('keeps a newline inside a quoted field', () => {
    expect(parseCsv('"line one\nline two",2')).toEqual([['line one\nline two', '2']]);
  });

  it.each([
    ['CRLF', 'a,b\r\nc,d'],
    ['LF', 'a,b\nc,d'],
    ['CR', 'a,b\rc,d'],
  ])('accepts %s line endings', (_name, text) => {
    expect(parseCsv(text)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('does not invent a final empty row for a trailing newline', () => {
    expect(parseCsv('a,b\nc,d\n')).toHaveLength(2);
  });

  it('strips the BOM Excel writes on every UTF-8 CSV', () => {
    // Left in place it glues itself to the first header, and `item_code`
    // silently becomes a column nothing matches.
    expect(readCsvTable('﻿item_code,qty\nSALT,10').headers).toEqual(['item_code', 'qty']);
  });

  it('lower-cases and trims headers, and drops entirely blank rows', () => {
    const table = readCsvTable(' Item Code , QTY \nSALT,10\n,\n');

    expect(table.headers).toEqual(['item code', 'qty']);
    expect(table.rows).toHaveLength(1);
    // 1-based FILE line number, header included — what the user sees.
    expect(table.rows[0].lineNo).toBe(2);
  });
});

describe('resolveImportedLines', () => {
  const saltRow = (overrides: Record<string, unknown> = {}) => ({
    itemId: SALT_ID,
    itemCode: 'SALT',
    itemNameEn: 'Salt 1kg',
    unitConversions: [
      { iucId: BOX_IUC, iucIsBaseUnit: false, iucToBaseFactor: 12, unit: { unit_name: 'BOX' } },
      { iucId: PIECE_IUC, iucIsBaseUnit: true, iucToBaseFactor: 1, unit: { unit_name: 'PIECE' } },
    ],
    ...overrides,
  });

  let prisma: {
    itemMaster: { findMany: jest.Mock };
    godownLocation: { findMany: jest.Mock };
    supplier: { findMany: jest.Mock };
  };

  const resolve = (csv: string) =>
    resolveImportedLines(prisma as unknown as PrismaService, csv, {
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      defaultGodownId: GODOWN_ID,
    });

  beforeEach(() => {
    prisma = {
      itemMaster: { findMany: jest.fn().mockResolvedValue([saltRow()]) },
      godownLocation: { findMany: jest.fn().mockResolvedValue([]) },
      supplier: { findMany: jest.fn().mockResolvedValue([]) },
    };
  });

  it('resolves item code and unit name to ids, and the base unit alongside', async () => {
    const result = await resolve('item_code,unit_name,qty,cost_rate\nSALT,BOX,10,20');

    expect(result.errors).toEqual([]);
    expect(result.lines).toEqual([
      expect.objectContaining({
        lineNo: 1,
        splitNo: 1,
        itemId: SALT_ID,
        // The unit resolved WITHIN the item — iuc_id is per (item, unit).
        uomId: BOX_IUC,
        baseUomId: PIECE_IUC,
        godownId: GODOWN_ID,
        qty: 10,
        costRate: 20,
      }),
    ]);
  });

  it('numbers by file order when there is no line_no column', async () => {
    const result = await resolve(
      'item_code,unit_name,qty,cost_rate\nSALT,BOX,10,20\nSALT,PIECE,5,3',
    );

    expect(result.lines.map((line) => line.lineNo)).toEqual([1, 2]);
  });

  it('honours an explicit line_no and split_no', async () => {
    const result = await resolve(
      'line_no,split_no,item_code,unit_name,qty,cost_rate\n7,2,SALT,BOX,10,20',
    );

    expect(result.lines[0]).toMatchObject({ lineNo: 7, splitNo: 2 });
  });

  it('accepts header aliases and any case', async () => {
    const result = await resolve('Code,UOM,Quantity,Rate\nSALT,BOX,10,20');

    expect(result.errors).toEqual([]);
    expect(result.lines).toHaveLength(1);
  });

  // The single most dangerous failure mode: a wrong resolution does not fail,
  // it succeeds against the wrong item.
  it('refuses an ambiguous item code rather than picking one', async () => {
    prisma.itemMaster.findMany.mockResolvedValue([
      saltRow(),
      saltRow({ itemId: 'other', itemNameEn: 'Salt 5kg' }),
    ]);

    const result = await resolve('item_code,unit_name,qty,cost_rate\nSALT,BOX,10,20');

    expect(result.lines).toEqual([]);
    expect(result.errors[0].message).toContain('matches 2 items');
    expect(result.errors[0].message).toContain('Salt 5kg');
  });

  it('refuses a unit that is not on the item, and lists the ones that are', async () => {
    const result = await resolve('item_code,unit_name,qty,cost_rate\nSALT,CRATE,10,20');

    expect(result.lines).toEqual([]);
    expect(result.errors[0].message).toContain('no unit named "CRATE"');
    expect(result.errors[0].message).toContain('BOX, PIECE');
  });

  it('refuses an item whose unit name is duplicated on the item itself', async () => {
    prisma.itemMaster.findMany.mockResolvedValue([
      saltRow({
        unitConversions: [
          { iucId: BOX_IUC, iucIsBaseUnit: true, iucToBaseFactor: 1, unit: { unit_name: 'BOX' } },
          {
            iucId: PIECE_IUC,
            iucIsBaseUnit: false,
            iucToBaseFactor: 12,
            unit: { unit_name: 'BOX' },
          },
        ],
      }),
    ]);

    const result = await resolve('item_code,unit_name,qty,cost_rate\nSALT,BOX,10,20');

    expect(result.errors[0].message).toContain('2 conversions named "BOX"');
  });

  it('refuses an item with no base unit', async () => {
    prisma.itemMaster.findMany.mockResolvedValue([
      saltRow({
        unitConversions: [
          { iucId: BOX_IUC, iucIsBaseUnit: false, iucToBaseFactor: 12, unit: { unit_name: 'BOX' } },
        ],
      }),
    ]);

    const result = await resolve('item_code,unit_name,qty,cost_rate\nSALT,BOX,10,20');

    expect(result.errors[0].message).toContain('no base unit');
  });

  it('reports EVERY bad row, not just the first', async () => {
    const result = await resolve(
      'item_code,unit_name,qty,cost_rate\nGHOST,BOX,10,20\nSALT,CRATE,1,2\nSALT,BOX,x,2',
    );

    expect(result.errors).toHaveLength(3);
    expect(result.errors.map((error) => error.message)).toEqual([
      expect.stringContaining('Row 2'),
      expect.stringContaining('Row 3'),
      expect.stringContaining('Row 4'),
    ]);
  });

  it('resolves a named godown within the branch, and defaults to the header godown', async () => {
    prisma.godownLocation.findMany.mockResolvedValue([
      { gdlId: OTHER_GODOWN_ID, gdlName: 'COLD ROOM', gdlCode: 'CR' },
    ]);

    const result = await resolve(
      'item_code,unit_name,godown,qty,cost_rate\nSALT,BOX,COLD ROOM,10,20\nSALT,BOX,,5,20',
    );

    expect(result.lines[0].godownId).toBe(OTHER_GODOWN_ID);
    expect(result.lines[1].godownId).toBe(GODOWN_ID);
  });

  it('refuses a godown name that matches nothing in the branch', async () => {
    const result = await resolve(
      'item_code,unit_name,godown,qty,cost_rate\nSALT,BOX,NOWHERE,10,20',
    );

    expect(result.errors[0].message).toContain('no godown named or coded "NOWHERE"');
  });

  it('resolves a supplier by name or short name', async () => {
    prisma.supplier.findMany.mockResolvedValue([
      { supId: SUPPLIER_ID, supName: 'Acme Traders', supShort: 'ACME' },
    ]);

    const result = await resolve('item_code,unit_name,supplier,qty,cost_rate\nSALT,BOX,ACME,10,20');

    expect(result.lines[0].supplierId).toBe(SUPPLIER_ID);
  });

  it('accepts a spreadsheet-formatted number but not a hand-written one', async () => {
    const good = await resolve('item_code,unit_name,qty,cost_rate\nSALT,BOX,"1,250.00",20');
    expect(good.lines[0].qty).toBe(1250);

    const bad = await resolve('item_code,unit_name,qty,cost_rate\nSALT,BOX,approx 12,20');
    expect(bad.errors[0].message).toContain('is not a quantity');
  });

  it.each([
    ['2026-06-30', '2026-06-30'],
    ['30/06/2026', '2026-06-30'],
    ['1-7-2026', '2026-07-01'],
  ])('reads the date %s as %s', async (input, expected) => {
    const result = await resolve(
      `item_code,unit_name,qty,cost_rate,expiry_date\nSALT,BOX,10,20,${input}`,
    );

    expect(result.lines[0].expiryDate).toBe(expected);
  });

  it('refuses a date it does not recognise rather than guessing', async () => {
    const result = await resolve(
      'item_code,unit_name,qty,cost_rate,expiry_date\nSALT,BOX,10,20,next June',
    );

    expect(result.errors[0].message).toContain('is not a date the importer recognises');
  });

  it('names the missing required columns, and what it found instead', async () => {
    const result = await resolve('item code,unit,qty\nSALT,BOX,10');

    expect(result.lines).toEqual([]);
    expect(result.errors[0].message).toContain('cost_rate');
    expect(result.errors[0].message).toContain('Found: item code, unit, qty');
  });

  it('reports an empty file as such', async () => {
    expect((await resolve('')).errors[0].message).toBe('The file is empty.');
    expect((await resolve('item_code,unit_name,qty,cost_rate\n')).errors[0].message).toBe(
      'The file has a header row but no data rows.',
    );
  });

  it('carries weight and landed rate through', async () => {
    const result = await resolve(
      'item_code,unit_name,qty,cost_rate,weight,landed_rate\nSALT,BOX,10,20,9.7,22.5',
    );

    expect(result.lines[0]).toMatchObject({ weightQty: 9.7, landedRate: 22.5 });
  });

  it("never resolves a lot id — that is still the save path's, at post time", async () => {
    const result = await resolve('item_code,unit_name,qty,cost_rate\nSALT,BOX,10,20');

    expect(result.lines[0]).not.toHaveProperty('lotId');
  });

  // The save path no longer reads item_unit_conversion: the client sends the
  // factor and the base quantities. A CSV cannot, so the importer — whose whole
  // job is resolving spreadsheet names against the master data — does the
  // conversion the grid would have done and puts it on the line it builds.
  it('resolves the conversion factor and the base quantities the save path no longer computes', async () => {
    const result = await resolve('item_code,unit_name,qty,free_qty,cost_rate\nSALT,BOX,10,5,20');

    // 1 BOX = 12 PIECE.
    expect(result.lines[0]).toMatchObject({
      toBaseFactor: 12,
      baseQty: 120,
      freeQty: 5,
      freeBaseQty: 60,
    });
  });
});

// ── what every refusal is coded as, and the lookups behind it ───────────────
describe('resolveImportedLines — codes, lookups and the rest of the columns', () => {
  const OTHER_SUPPLIER_ID = '01000000-0000-7000-8000-0000000000aa';
  const HEADER = 'item_code,unit_name,qty,cost_rate';

  const saltRow = (overrides: Record<string, unknown> = {}) => ({
    itemId: SALT_ID,
    itemCode: 'SALT',
    itemNameEn: 'Salt 1kg',
    unitConversions: [
      { iucId: BOX_IUC, iucIsBaseUnit: false, iucToBaseFactor: 12, unit: { unit_name: 'BOX' } },
      { iucId: PIECE_IUC, iucIsBaseUnit: true, iucToBaseFactor: 1, unit: { unit_name: 'PIECE' } },
    ],
    ...overrides,
  });

  let prisma: {
    itemMaster: { findMany: jest.Mock };
    godownLocation: { findMany: jest.Mock };
    supplier: { findMany: jest.Mock };
  };

  const resolve = (csv: string) =>
    resolveImportedLines(prisma as unknown as PrismaService, csv, {
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      defaultGodownId: GODOWN_ID,
    });

  beforeEach(() => {
    prisma = {
      itemMaster: { findMany: jest.fn().mockResolvedValue([saltRow()]) },
      godownLocation: { findMany: jest.fn().mockResolvedValue([]) },
      supplier: { findMany: jest.fn().mockResolvedValue([]) },
    };
  });

  it('looks every item code up once, case-insensitively, and live items only', async () => {
    await resolve(`${HEADER}\nSALT,BOX,1,2\nsalt,BOX,3,4\nSUGAR,BOX,5,6`);

    expect(prisma.itemMaster.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.itemMaster.findMany.mock.calls[0][0].where).toEqual({
      itemCode: { in: ['SALT', 'salt', 'SUGAR'], mode: 'insensitive' },
      itemIsDeleted: false,
    });
  });

  it('asks for no godown or supplier when the file names none', async () => {
    await resolve(`${HEADER}\nSALT,BOX,1,2`);

    expect(prisma.godownLocation.findMany).not.toHaveBeenCalled();
    expect(prisma.supplier.findMany).not.toHaveBeenCalled();
  });

  it('looks godowns up within the branch by name or code, and suppliers by name or short name', async () => {
    await resolve('item_code,unit_name,godown,supplier,qty,cost_rate\nSALT,BOX,CR,ACME,1,2');

    expect(prisma.godownLocation.findMany.mock.calls[0][0].where).toEqual({
      gdlBranchId: BRANCH_ID,
      gdlIsDeleted: false,
      OR: [
        { gdlName: { in: ['CR'], mode: 'insensitive' } },
        { gdlCode: { in: ['CR'], mode: 'insensitive' } },
      ],
    });
    expect(prisma.supplier.findMany.mock.calls[0][0].where).toEqual({
      supIsDeleted: false,
      OR: [
        { supName: { in: ['ACME'], mode: 'insensitive' } },
        { supShort: { in: ['ACME'], mode: 'insensitive' } },
      ],
    });
  });

  it.each([
    ['an unknown item', `${HEADER}\nGHOST,BOX,1,2`, StockErrorCode.IMPORT_ITEM_NOT_FOUND],
    ['an unknown unit', `${HEADER}\nSALT,CRATE,1,2`, StockErrorCode.IMPORT_UNIT_NOT_FOUND],
    [
      'a quantity that is not a number',
      `${HEADER}\nSALT,BOX,lots,2`,
      StockErrorCode.IMPORT_QTY_INVALID,
    ],
    [
      'a cost that is not a number',
      `${HEADER}\nSALT,BOX,1,cheap`,
      StockErrorCode.IMPORT_COST_INVALID,
    ],
    ['a blank cost', `${HEADER}\nSALT,BOX,1,`, StockErrorCode.IMPORT_COST_INVALID],
  ])('codes %s on the row it came from', async (_label, csv, code) => {
    const result = await resolve(csv);

    expect(result.lines).toEqual([]);
    expect(result.errors).toEqual([
      expect.objectContaining({
        field: 'file.row.2',
        code,
        message: expect.stringMatching(/^Row 2: /),
      }),
    ]);
  });

  it('codes an empty file and missing columns against the file', async () => {
    const empty = await resolve('');
    const missing = await resolve('item_code\nSALT');

    expect(empty.errors).toEqual([
      { field: 'file', code: StockErrorCode.IMPORT_FILE_EMPTY, message: 'The file is empty.' },
    ]);
    expect(missing).toMatchObject({
      rowsRead: 1,
      errors: [
        {
          field: 'file',
          code: StockErrorCode.IMPORT_COLUMNS_MISSING,
          message:
            'The file is missing required column(s): unit_name, qty, cost_rate. Found: item_code.',
        },
      ],
    });
    // Nothing is looked up for a file that cannot be read at all.
    expect(prisma.itemMaster.findMany).not.toHaveBeenCalled();
  });

  it('refuses a godown name that matches two godowns, and counts one godown named and coded alike once', async () => {
    prisma.godownLocation.findMany.mockResolvedValue([
      { gdlId: GODOWN_ID, gdlName: 'MAIN', gdlCode: 'MAIN' },
      { gdlId: OTHER_GODOWN_ID, gdlName: 'COLD', gdlCode: 'main' },
    ]);

    const ambiguous = await resolve('item_code,unit_name,godown,qty,cost_rate\nSALT,BOX,Main,1,2');

    expect(ambiguous.errors).toEqual([
      expect.objectContaining({
        code: StockErrorCode.IMPORT_GODOWN_AMBIGUOUS,
        message: 'Row 2: "Main" matches 2 godowns in this branch.',
      }),
    ]);

    prisma.godownLocation.findMany.mockResolvedValue([
      { gdlId: OTHER_GODOWN_ID, gdlName: 'COLD', gdlCode: 'cold' },
    ]);
    const single = await resolve('item_code,unit_name,godown,qty,cost_rate\nSALT,BOX,COLD,1,2');

    expect(single.errors).toEqual([]);
    expect(single.lines[0].godownId).toBe(OTHER_GODOWN_ID);
  });

  it('refuses a supplier name that matches nothing, or two suppliers', async () => {
    const missing = await resolve(
      'item_code,unit_name,supplier,qty,cost_rate\nSALT,BOX,NOBODY,1,2',
    );

    prisma.supplier.findMany.mockResolvedValue([
      { supId: SUPPLIER_ID, supName: 'Acme Traders', supShort: 'ACME' },
      { supId: OTHER_SUPPLIER_ID, supName: 'Acme', supShort: null },
    ]);
    const ambiguous = await resolve(
      'item_code,unit_name,supplier,qty,cost_rate\nSALT,BOX,acme,1,2',
    );

    expect(missing.errors).toEqual([
      expect.objectContaining({
        code: StockErrorCode.IMPORT_SUPPLIER_NOT_FOUND,
        message: 'Row 2: no supplier named "NOBODY".',
      }),
    ]);
    expect(ambiguous.errors).toEqual([
      expect.objectContaining({
        code: StockErrorCode.IMPORT_SUPPLIER_AMBIGUOUS,
        message: 'Row 2: "acme" matches 2 suppliers.',
      }),
    ]);
  });

  it.each([
    ['0', 0],
    ['a negative factor', -12],
    ['an unreadable factor', 'twelve'],
  ])('refuses a unit whose conversion factor is %s', async (_label, factor) => {
    prisma.itemMaster.findMany.mockResolvedValue([
      saltRow({
        unitConversions: [
          {
            iucId: BOX_IUC,
            iucIsBaseUnit: false,
            iucToBaseFactor: factor,
            unit: { unit_name: 'BOX' },
          },
          {
            iucId: PIECE_IUC,
            iucIsBaseUnit: true,
            iucToBaseFactor: 1,
            unit: { unit_name: 'PIECE' },
          },
        ],
      }),
    ]);

    const result = await resolve(`${HEADER}\nSALT,BOX,1,2`);

    expect(result.errors).toEqual([
      expect.objectContaining({
        code: StockErrorCode.IMPORT_UNIT_FACTOR_INVALID,
        message: 'Row 2: unit "BOX" has no usable conversion factor on this item.',
      }),
    ]);
  });

  it('refuses a manufacture date it does not recognise, coded as a date error', async () => {
    const result = await resolve(`${HEADER},mfg_date\nSALT,BOX,1,2,last spring`);

    expect(result.errors).toEqual([
      expect.objectContaining({
        code: StockErrorCode.IMPORT_DATE_INVALID,
        message:
          'Row 2: "last spring" is not a date the importer recognises (yyyy-MM-dd or dd/MM/yyyy).',
      }),
    ]);
  });

  it('codes the item, ambiguity, duplicate-unit and no-base-unit refusals', async () => {
    prisma.itemMaster.findMany.mockResolvedValue([
      saltRow(),
      saltRow({ itemId: 'other', itemCode: 'salt', itemNameEn: 'Salt 5kg' }),
      saltRow({
        itemId: 'dup',
        itemCode: 'DUP',
        unitConversions: [
          { iucId: BOX_IUC, iucIsBaseUnit: true, iucToBaseFactor: 1, unit: { unit_name: 'BOX' } },
          {
            iucId: PIECE_IUC,
            iucIsBaseUnit: false,
            iucToBaseFactor: 12,
            unit: { unit_name: 'box' },
          },
        ],
      }),
      saltRow({
        itemId: 'nobase',
        itemCode: 'NOBASE',
        unitConversions: [
          { iucId: BOX_IUC, iucIsBaseUnit: false, iucToBaseFactor: 12, unit: { unit_name: 'BOX' } },
        ],
      }),
    ]);

    const result = await resolve(`${HEADER}\nSALT,BOX,1,2\nDUP,BOX,1,2\nNOBASE,BOX,1,2`);

    expect(result.errors.map((error) => error.code)).toEqual([
      StockErrorCode.IMPORT_ITEM_AMBIGUOUS,
      StockErrorCode.IMPORT_UNIT_AMBIGUOUS,
      StockErrorCode.IMPORT_NO_BASE_UNIT,
    ]);
  });

  it('treats an item with no code as matching nothing', async () => {
    prisma.itemMaster.findMany.mockResolvedValue([saltRow({ itemCode: null })]);

    const result = await resolve(`${HEADER}\nSALT,BOX,1,2`);

    expect(result.errors[0].code).toBe(StockErrorCode.IMPORT_ITEM_NOT_FOUND);
  });

  it('carries every optional column through, and defaults the rest', async () => {
    const result = await resolve(
      'item_code,unit_name,qty,cost_rate,bucket,barcode,batch_no,mfg_date,mrp,sale_price,serial_no,cost_rate_wot,tax_perc,remarks\n' +
        'SALT,BOX,2,20,DAMAGED,8901234,B-7,01/03/2026,"₹ 1,200.50",99,SN-1,18.5,5,shelf 4',
    );

    expect(result.errors).toEqual([]);
    expect(result.lines[0]).toEqual({
      lineNo: 1,
      splitNo: 1,
      itemId: SALT_ID,
      uomId: BOX_IUC,
      baseUomId: PIECE_IUC,
      toBaseFactor: 12,
      godownId: GODOWN_ID,
      bucket: 'DAMAGED',
      barcode: '8901234',
      batchNo: 'B-7',
      mfgDate: '2026-03-01',
      expiryDate: null,
      mrp: 1200.5,
      salePrice: 99,
      serialNo: 'SN-1',
      supplierId: null,
      qty: 2,
      baseQty: 24,
      freeQty: 0,
      freeBaseQty: 0,
      weightQty: 0,
      costRate: 20,
      costRateWot: 18.5,
      landedRate: 0,
      taxPerc: 5,
      remarks: 'shelf 4',
    });
  });

  it('leaves blank optional cells null or undefined rather than empty strings', async () => {
    const result = await resolve(
      'item_code,unit_name,qty,cost_rate,bucket,barcode,mrp,remarks\nSALT,BOX,1,2,,,,',
    );

    expect(result.lines[0]).toMatchObject({
      bucket: undefined,
      barcode: null,
      mrp: null,
      remarks: null,
    });
  });

  it('truncates a fractional line or split number rather than refusing it', async () => {
    const result = await resolve(`line_no,split_no,${HEADER}\n3.9,2.2,SALT,BOX,1,2`);

    expect(result.lines[0]).toMatchObject({ lineNo: 3, splitNo: 2 });
  });

  it('reports rowsRead as every data row seen, good or bad', async () => {
    const result = await resolve(`${HEADER}\nSALT,BOX,1,2\nGHOST,BOX,1,2\nSALT,BOX,3,4`);

    expect(result).toMatchObject({ rowsRead: 3 });
    expect(result.lines).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
  });
});
