import { plainToInstance } from 'class-transformer';
import { ValidationError, validateSync } from 'class-validator';
import { SaveStockVoucherDto, SaveStockVoucherHeaderDto } from './save-stock-voucher.dto';
import { SaveStockVoucherItemDto } from './save-stock-voucher-item.dto';

const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '01000000-0000-7000-8000-0000000000b1';
const DEVICE_ID = '01000000-0000-7000-8000-0000000000d1';
const GODOWN_ID = '01000000-0000-7000-8000-0000000000e1';
const ITEM_ID = '01000000-0000-7000-8000-000000000001';
const UOM_ID = '01000000-0000-7000-8000-000000000011';
const BASE_UOM_ID = '01000000-0000-7000-8000-000000000012';

const header = (overrides: Record<string, unknown> = {}) => ({
  accYear: '2026-2027',
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  deviceId: DEVICE_ID,
  docDate: '2026-04-01',
  toGodownId: GODOWN_ID,
  ...overrides,
});

const line = (overrides: Record<string, unknown> = {}) => ({
  lineNo: 1,
  itemId: ITEM_ID,
  uomId: UOM_ID,
  baseUomId: BASE_UOM_ID,
  toBaseFactor: 12,
  godownId: GODOWN_ID,
  qty: 10,
  baseQty: 120,
  costRate: 20,
  ...overrides,
});

const body = (overrides: { header?: object; lines?: object[] } = {}) => ({
  header: header(overrides.header as Record<string, unknown>),
  lines: overrides.lines ?? [line()],
});

/** Every failing property as a dotted path — `lines.0.toBaseFactor`. */
function failedPaths(errors: ValidationError[], prefix = ''): string[] {
  return errors.flatMap((error) => {
    const path = prefix ? `${prefix}.${error.property}` : error.property;
    return error.children?.length ? failedPaths(error.children, path) : [path];
  });
}

const failuresOf = (plain: object) =>
  failedPaths(validateSync(plainToInstance(SaveStockVoucherDto, plain)));

describe('SaveStockVoucherDto', () => {
  it('accepts the smallest whole document', () => {
    expect(failuresOf(body())).toEqual([]);
  });

  it('turns header and lines into their own DTO classes', () => {
    const dto = plainToInstance(SaveStockVoucherDto, body());

    expect(dto.header).toBeInstanceOf(SaveStockVoucherHeaderDto);
    expect(dto.lines[0]).toBeInstanceOf(SaveStockVoucherItemDto);
  });

  it('requires a lines array', () => {
    expect(failuresOf({ header: header() })).toEqual(['lines']);
    expect(failuresOf(body({ lines: 'none' as never }))).toEqual(['lines']);
  });

  it('accepts an empty lines array — the SERVICE refuses it, with a code the grid can show', () => {
    expect(failuresOf(body({ lines: [] }))).toEqual([]);
  });

  it('caps a document at 2000 lines', () => {
    const lines = Array.from({ length: 2001 }, (_, index) => line({ lineNo: index + 1 }));

    const errors = validateSync(plainToInstance(SaveStockVoucherDto, body({ lines })));

    expect(errors).toEqual([
      expect.objectContaining({
        property: 'lines',
        constraints: expect.objectContaining({
          arrayMaxSize: 'lines may not exceed 2000 rows in one document',
        }),
      }),
    ]);
  });

  // ── the header ────────────────────────────────────────────────────────────
  describe('header', () => {
    it.each([
      ['an accYear that is not yyyy-yyyy', { accYear: '2026-27' }, 'header.accYear'],
      ['a docDate that is not yyyy-MM-dd', { docDate: '01/04/2026' }, 'header.docDate'],
      ['a company id that is not a uuid', { companyId: 'company-1' }, 'header.companyId'],
      ['a missing device', { deviceId: undefined }, 'header.deviceId'],
      ['a rate source outside the five', { rateSource: 'GUESS' }, 'header.rateSource'],
      ['a status of CANCELLED', { status: 'CANCELLED' }, 'header.status'],
      ['an expectedOn that is not yyyy-MM-dd', { expectedOn: 'next week' }, 'header.expectedOn'],
      ['a negative total quantity', { totalQty: -1 }, 'header.totalQty'],
      ['a slno that is not a number', { slno: 'twelve' }, 'header.slno'],
    ])('refuses %s', (_label, overrides, path) => {
      expect(failuresOf(body({ header: overrides }))).toEqual([path]);
    });

    it.each(['DRAFT', 'POSTED'])('accepts status %s', (status) => {
      expect(failuresOf(body({ header: { status } }))).toEqual([]);
    });

    it('accepts every rate source and a null one', () => {
      for (const rateSource of ['AVG_COST', 'LAST_PURCHASE', 'LOT_COST', 'MRP', 'MANUAL', null]) {
        expect(failuresOf(body({ header: { rateSource } }))).toEqual([]);
      }
    });
  });

  // ── the lines ─────────────────────────────────────────────────────────────
  describe('lines', () => {
    it.each([
      ['a factor of 0', { toBaseFactor: 0 }, 'lines.0.toBaseFactor'],
      ['an item id that is not a uuid', { itemId: 'salt' }, 'lines.0.itemId'],
      ['a bucket outside the five', { bucket: 'LOST' }, 'lines.0.bucket'],
      ['a destination bucket outside the five', { toBucket: 'LOST' }, 'lines.0.toBucket'],
      ['a direction of 2', { direction: 2 }, 'lines.0.direction'],
      ['a missing base quantity', { baseQty: undefined }, 'lines.0.baseQty'],
    ])('refuses %s', (_label, overrides, path) => {
      expect(failuresOf(body({ lines: [line(overrides)] }))).toEqual([path]);
    });

    it('names the row a failing line sits on', () => {
      expect(failuresOf(body({ lines: [line(), line({ lineNo: 2, toBaseFactor: -3 })] }))).toEqual([
        'lines.1.toBaseFactor',
      ]);
    });

    it('lets toBucket and direction be null', () => {
      expect(failuresOf(body({ lines: [line({ toBucket: null, direction: null })] }))).toEqual([]);
    });

    it.each([1, -1])('accepts direction %i', (direction) => {
      expect(failuresOf(body({ lines: [line({ direction })] }))).toEqual([]);
    });
  });
});
