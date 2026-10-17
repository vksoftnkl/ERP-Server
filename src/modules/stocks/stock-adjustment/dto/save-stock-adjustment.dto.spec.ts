import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { SaveStockAdjustmentDto } from './save-stock-adjustment.dto';
import { PickStockQueryDto } from './stock-adjustment-query.dto';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fe01';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46fe02';
const DEVICE_ID = '019c6f6c-be87-7a11-8905-36092c46fe03';
const GODOWN_ID = '019c6f6c-be87-7a11-8905-36092c46fe04';
const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46fe05';
const IUC_ID = '019c6f6c-be87-7a11-8905-36092c46fe06';
const REASON_ID = '019c6f6c-be87-7a11-8905-36092c46fe08';

const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

const line = (extra: Record<string, unknown> = {}) => ({
  lineNo: 1,
  itemId: ITEM_ID,
  uomId: IUC_ID,
  baseUomId: IUC_ID,
  toBaseFactor: 1,
  qty: 2,
  baseQty: 2,
  godownId: GODOWN_ID,
  reasonId: REASON_ID,
  ...extra,
});

const transform = (header: Record<string, unknown> = {}, lines?: unknown[]) =>
  validationPipe.transform(
    {
      header: {
        accYear: '2026-2027',
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        deviceId: DEVICE_ID,
        docDate: '2026-09-30',
        voucherType: 'ADJUSTMENT',
        fromGodownId: GODOWN_ID,
        ...header,
      },
      lines: lines ?? [line()],
    },
    { type: 'body', metatype: SaveStockAdjustmentDto },
  ) as Promise<SaveStockAdjustmentDto>;

const pick = (query: Record<string, unknown>) =>
  validationPipe.transform(
    { companyId: COMPANY_ID, branchId: BRANCH_ID, godownId: GODOWN_ID, ...query },
    { type: 'query', metatype: PickStockQueryDto },
  ) as Promise<PickStockQueryDto>;

describe('SaveStockAdjustmentDto', () => {
  // Notes 65 §2: the header totals are the NET of the lines, and an adjustment
  // that takes out more than it brings in nets below zero. The shared header
  // floors them at 0; this one redeclares them, and the base's Min(0) goes.
  describe('the header totals', () => {
    it.each([
      ['totalQty', -2],
      ['totalValue', -40.5],
      ['totalValueWot', -38.57],
    ] as const)('accepts a NEGATIVE %s — a net-out adjustment', async (field, value) => {
      const dto = await transform({ [field]: value });

      expect(dto.header[field]).toBe(value);
    });

    it('still accepts a positive net', async () => {
      const dto = await transform({ totalQty: 5, totalValue: 150, totalValueWot: 142.86 });

      expect([dto.header.totalQty, dto.header.totalValue, dto.header.totalValueWot]).toEqual([5, 150, 142.86]);
    });

    it('refuses a total that is not a number', async () => {
      await expect(transform({ totalQty: 'lots' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('still refuses a negative lineCount — a document cannot have fewer than no lines', async () => {
      await expect(transform({ lineCount: -1 })).rejects.toBeInstanceOf(BadRequestException);
    });

    // Optional against a NOT NULL DEFAULT 0 column: omitted stays omitted, so
    // the shared save leaves the stored value alone rather than zeroing it.
    it('leaves the three undefined when the payload sends none', async () => {
      const { header } = await transform();

      expect([header.totalQty, header.totalValue, header.totalValueWot]).toEqual([undefined, undefined, undefined]);
    });
  });

  // The header is OmitType(shared header, the three totals): every other
  // property must keep the shared validators.
  it.each([
    ['no companyId', { companyId: undefined }],
    ['a docDate that is not a date', { docDate: 'yesterday' }],
    ['a field the shared header does not have', { surprise: 1 }],
  ])('still refuses %s', async (_label, header) => {
    await expect(transform(header)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a line with no bucket — the service reads it as SALEABLE', async () => {
    const dto = await transform({}, [line()]);

    expect(dto.lines[0].bucket).toBeUndefined();
  });

  it('refuses a bucket that is not one of the five', async () => {
    await expect(transform({}, [line({ bucket: 'LOST' })])).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('PickStockQueryDto', () => {
  // Notes 65 §4: documented optional, was required.
  it('accepts a query with no bucket — every bucket', async () => {
    const query = await pick({});

    expect(query.bucket).toBeUndefined();
  });

  it('accepts one bucket', async () => {
    expect((await pick({ bucket: 'DAMAGED' })).bucket).toBe('DAMAGED');
  });

  it('refuses a bucket that is not one of the five', async () => {
    await expect(pick({ bucket: 'LOST' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
