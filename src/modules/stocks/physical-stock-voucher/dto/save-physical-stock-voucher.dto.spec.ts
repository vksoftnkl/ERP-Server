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

  // ── Fifteen header fields the SHARED voucher DTO carries and this one omits ──
  //
  // Every one is refused by `forbidNonWhitelisted` alone, because the header is
  // STANDALONE and simply does not declare them — there is no @IsEmpty left in
  // the file, and none of them is rendered in the /api/docs schema any more.
  //
  //   totals   the header carries the NET VARIANCE, read off the ledger by
  //            fn_svh_recompute at post; nothing on the sheet adds up to it
  //   lorry    stock_transit columns, written only by a transfer. They used to
  //            be accepted here and SILENTLY DISCARDED
  //   the rest a count is one godown against its own book figure: no source
  //            side, no counterparty, and nothing outside it caused it.
  //            toBranchId and the four linkSrc columns were 422s from
  //            assertPayloadRules, reported after the whole payload was walked
  it.each([
    ['lineCount', 1],
    ['totalQty', 1],
    ['totalValue', 2400.5],
    ['totalValueWot', 2286.19],
    ['lrNo', 'LR-99'],
    ['vehicleNo', 'TN-01-AB-1234'],
    ['expectedOn', '2026-09-12'],
    ['fromGodownId', '019c6f6c-be87-7a11-8905-36092c46fe0a'],
    ['toBranchId', '019c6f6c-be87-7a11-8905-36092c46fe0c'],
    ['supplierId', '019c6f6c-be87-7a11-8905-36092c46fe0b'],
    ['partyRef', 'DOCKET-1'],
    ['linkSrcModule', 'sales'],
    ['linkSrcDocType', 'SALE_BILL'],
    ['linkSrcDocId', '019c6f6c-be87-7a11-8905-36092c46fe0d'],
    ['linkSrcAccYear', '2026-2027'],
  ])('refuses %s — it describes a document a count is not', async (field, value) => {
    await expect(transform({ [field]: value })).rejects.toBeInstanceOf(BadRequestException);
  });

  // What the STANDALONE header buys that extending never could: a subclass
  // cannot TIGHTEN, because @IsOptional() on the base whitelists undefined for
  // every validator on the property. This was a 422 from assertPayloadRules.
  it('refuses a header with no toGodownId — a count is one godown', async () => {
    const header: Record<string, unknown> = {
      accYear: '2026-2027',
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      deviceId: DEVICE_ID,
      docDate: '2026-06-30',
    };

    await expect(
      validationPipe.transform(
        {
          header,
          lines: [
            { lineNo: 1, itemId: ITEM_ID, godownId: GODOWN_ID, lotId: LOT_ID, countedQty: 118 },
          ],
        },
        { type: 'body', metatype: SavePhysicalStockVoucherDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // The other side of the rewrite: what a count legitimately fills in has to
  // survive the standalone header, since it no longer inherits anything.
  it('still accepts the reason, the offline sync stamp and a rate source', async () => {
    const result = await transform({
      reasonId: '019c6f6c-be87-7a11-8905-36092c46fe09',
      syncDate: '2026-06-30T14:48:33.947Z',
      rateSource: 'AVG_COST',
      usrRefno: 'COUNT-JUN',
      remarks: 'Quarter-end count, aisle 4',
    });

    expect(result.header.syncDate).toBe('2026-06-30T14:48:33.947Z');
    expect(result.header.rateSource).toBe('AVG_COST');
  });
});
