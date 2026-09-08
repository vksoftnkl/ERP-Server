import { PrismaService } from '../../../database/prisma/prisma.service';
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
          { iucId: PIECE_IUC, iucIsBaseUnit: false, iucToBaseFactor: 12, unit: { unit_name: 'BOX' } },
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

    const result = await resolve(
      'item_code,unit_name,supplier,qty,cost_rate\nSALT,BOX,ACME,10,20',
    );

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

  it('never resolves a lot id — that is still the save path\'s, at post time', async () => {
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
