import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { SavePhysicalStockVoucherDto } from './save-physical-stock-voucher.dto';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fe01';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46fe02';
const DEVICE_ID = '019c6f6c-be87-7a11-8905-36092c46fe03';
const GODOWN_ID = '019c6f6c-be87-7a11-8905-36092c46fe04';
const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46fe05';
const LOT_ID = '019c6f6c-be87-7a11-8905-36092c46fe07';

const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

const transform = (header: Record<string, unknown> = {}, lines?: unknown[]) =>
  validationPipe.transform(
    {
      header: {
        accYear: '2026-2027',
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        deviceId: DEVICE_ID,
        docDate: '2026-06-30',
        toGodownId: GODOWN_ID,
        ...header,
      },
      lines: lines ?? [
        { lineNo: 1, itemId: ITEM_ID, godownId: GODOWN_ID, lotId: LOT_ID, countedQty: 118 },
      ],
    },
    { type: 'body', metatype: SavePhysicalStockVoucherDto },
  ) as Promise<SavePhysicalStockVoucherDto>;

describe('SavePhysicalStockVoucherDto', () => {
  it('accepts a count line — one holding, one number', async () => {
    const result = await transform();

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].lotId).toBe(LOT_ID);
    expect(result.lines[0].countedQty).toBe(118);
  });

  it('refuses a voucherType other than PHYSICAL', async () => {
    await expect(transform({ voucherType: 'OPENING' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires the lot — a count line comes from the sheet, it is not typed', async () => {
    await expect(
      transform({}, [{ lineNo: 1, itemId: ITEM_ID, godownId: GODOWN_ID, countedQty: 118 }]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  /**
   * countedQty is OPTIONAL at this boundary on purpose. Absent is not "0
   * found", it is NOT COUNTED YET, and the refusal is worth a sentence that
   * says so — which it gets from assertPayloadRules as a 422 naming the line,
   * not from a bare field error here.
   */
  it('lets an uncounted line through the DTO, so the service can name it', async () => {
    const result = await transform({}, [
      { lineNo: 7, itemId: ITEM_ID, godownId: GODOWN_ID, lotId: LOT_ID },
    ]);

    expect(result.lines[0].countedQty).toBeUndefined();
  });

  it('refuses a negative count at the boundary — only the difference is signed', async () => {
    await expect(
      transform({}, [
        { lineNo: 1, itemId: ITEM_ID, godownId: GODOWN_ID, lotId: LOT_ID, countedQty: -2 },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  /**
   * THE NARROW DTO EARNING ITS KEEP. Every one of these is a property of the
   * holding the line already names by lotId, and the server reads all of them
   * from stock_balance / stock_lot. Sending one is a 400 naming the property,
   * rather than eleven fields on the Swagger page that the API refuses.
   */
  it.each([
    ['qty', 5],
    ['freeQty', 1],
    ['weightQty', 3],
    ['costRate', 20],
    ['costRateWot', 19],
    ['landedRate', 21],
    ['taxPerc', 5],
    ['uomId', '019c6f6c-be87-7a11-8905-36092c46fe06'],
    ['baseUomId', '019c6f6c-be87-7a11-8905-36092c46fe06'],
    ['bookQty', 120],
    ['diffQty', -2],
    ['batchNo', 'B-2604'],
    ['mrp', 25],
    ['salePrice', 24],
    ['expiryDate', '2027-04-01'],
    ['mfgDate', '2026-04-01'],
    ['serialNo', 'SN-1'],
    ['supplierId', '019c6f6c-be87-7a11-8905-36092c46fe08'],
    ['barcode', '8901234567890'],
    ['value', 2400],
  ])(
    'refuses %s on a count line — it belongs to the holding, not the payload',
    async (field, value) => {
      await expect(
        transform({}, [
          {
            lineNo: 1,
            itemId: ITEM_ID,
            godownId: GODOWN_ID,
            lotId: LOT_ID,
            countedQty: 118,
            [field]: value,
          },
        ]),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('accepts the freeze window as instants with an offset — the guard reads now()', async () => {
    const result = await transform({
      freezeStock: true,
      freezeFrom: '2026-06-30T20:00:00+05:30',
      freezeTo: '2026-06-30T23:00:00+05:30',
    });

    expect(result.header.freezeStock).toBe(true);
  });

  it('refuses an unknown bucket on a line', async () => {
    await expect(
      transform({}, [
        {
          lineNo: 1,
          itemId: ITEM_ID,
          godownId: GODOWN_ID,
          lotId: LOT_ID,
          countedQty: 118,
          bucket: 'SHELF',
        },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a payload that tries to set a header total', async () => {
    await expect(transform({ totalQty: 1 })).rejects.toBeInstanceOf(BadRequestException);
  });
});
